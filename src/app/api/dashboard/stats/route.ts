import { NextRequest, NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getUnmatchedBankTransactions,
  getUnmatchedCardTransactions,
  getBankTransactions,
  getBudget,
  getCarryoverBalance,
} from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    // week offset 파라미터 처리
    const { searchParams } = new URL(request.url);
    const weekOffset = parseInt(searchParams.get('week') || '0');
    const debug = searchParams.get('debug') === 'true';

    // 현재 KST 시간
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentYear = kst.getFullYear();

    // 이번 주 날짜 범위 계산 (월요일 ~ 일요일)
    const dayOfWeek = kst.getDay();
    const monday = new Date(kst);
    monday.setDate(kst.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    // week offset 적용
    monday.setDate(monday.getDate() + weekOffset * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split('T')[0];
    const endDate = sunday.toISOString().split('T')[0];

    // 연간 날짜 범위
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    // 데이터 조회
    const [
      weeklyIncomeRecords,
      weeklyExpenseRecords,
      yearlyIncomeRecords,
      yearlyExpenseRecords,
      unmatchedBank,
      unmatchedCard,
      bankTransactions,
      budgetData,
      carryoverData,
    ] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getIncomeRecords(yearStart, yearEnd),
      getExpenseRecords(yearStart, yearEnd),
      getUnmatchedBankTransactions(),
      getUnmatchedCardTransactions(),
      getBankTransactions(),
      getBudget(currentYear),
      getCarryoverBalance(currentYear - 1), // 전년도 말 이월잔액
    ]);

    // 디버그 모드 응답
    if (debug) {
      return NextResponse.json({
        debug: true,
        currentYear,
        weekOffset,
        startDate,
        endDate,
        yearStart,
        yearEnd,
        counts: {
          weeklyIncome: weeklyIncomeRecords.length,
          weeklyExpense: weeklyExpenseRecords.length,
          yearlyIncome: yearlyIncomeRecords.length,
          yearlyExpense: yearlyExpenseRecords.length,
          bankTransactions: bankTransactions.length,
          unmatchedBank: unmatchedBank.length,
          unmatchedCard: unmatchedCard.length,
          budgetItems: budgetData.length,
        },
        sampleData: {
          weeklyIncome: weeklyIncomeRecords.slice(0, 2),
          weeklyExpense: weeklyExpenseRecords.slice(0, 2),
          lastBankTransaction: bankTransactions.slice(-1)[0],
          carryoverData,
        },
        envCheck: {
          hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
          hasFinanceSheetId: !!process.env.FINANCE_SHEET_ID,
        },
      });
    }

    // 주간 수입/지출 합계
    const weeklyIncome = weeklyIncomeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const weeklyExpense = weeklyExpenseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 연간 수입/지출 합계 (자본수입/건축 제외한 일반회계만)
    const yearlyIncome = yearlyIncomeRecords
      .filter(r => r.offering_code < 40 || r.offering_code >= 500)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const yearlyExpense = yearlyExpenseRecords
      .filter(r => r.category_code < 500) // 건축비 제외
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // 이월잔액
    const carryoverBalance = carryoverData?.balance || 0;

    // 현재 잔액 (은행원장의 마지막 잔액)
    // 은행원장이 없으면 이월금 + 연간수입 - 연간지출로 계산
    const sortedBank = bankTransactions
      .filter(t => t.balance > 0)
      .sort((a, b) => {
        if (a.transaction_date === b.transaction_date) {
          return (b.time || '').localeCompare(a.time || '');
        }
        return b.transaction_date.localeCompare(a.transaction_date);
      });
    const lastBankBalance = sortedBank[0]?.balance;
    const balance = lastBankBalance ?? (carryoverBalance + yearlyIncome - yearlyExpense);

    // 미분류 거래 수
    const unmatchedCount = unmatchedBank.length + unmatchedCard.length;

    // 동기집행률 계산
    // 동기예산 = 연간예산 / 365 * 경과일수
    const totalBudget = budgetData
      .filter(b => b.category_code < 500) // 건축비 제외
      .reduce((sum, b) => sum + (b.budgeted_amount || 0), 0);

    // 올해 경과일수 계산
    const yearStartDate = new Date(currentYear, 0, 1);
    const daysPassed = Math.floor((kst.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInYear = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365;

    // 동기예산
    const syncBudget = Math.round(totalBudget / daysInYear * daysPassed);

    // 동기집행률 = (실제지출 / 동기예산) * 100
    const syncExecutionRate = syncBudget > 0 ? Math.round((yearlyExpense / syncBudget) * 100) : 0;

    // 연간집행률 = (실제지출 / 연간예산) * 100
    const yearlyExecutionRate = totalBudget > 0 ? Math.round((yearlyExpense / totalBudget) * 100) : 0;

    // 8주 데이터 계산 (7주 전부터 이번 주까지)
    const eightWeeksAgo = new Date(monday);
    eightWeeksAgo.setDate(monday.getDate() - 7 * 7); // 7주 전 월요일
    const eightWeekStart = eightWeeksAgo.toISOString().split('T')[0];

    // 8주간 데이터 조회
    const [eightWeekIncomeRecords, eightWeekExpenseRecords] = await Promise.all([
      getIncomeRecords(eightWeekStart, endDate),
      getExpenseRecords(eightWeekStart, endDate),
    ]);

    // 주별로 집계
    const weeklyData: Array<{ date: string; income: number; expense: number }> = [];
    for (let i = 0; i < 8; i++) {
      const weekMonday = new Date(eightWeeksAgo);
      weekMonday.setDate(eightWeeksAgo.getDate() + i * 7);
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);

      const weekStart = weekMonday.toISOString().split('T')[0];
      const weekEnd = weekSunday.toISOString().split('T')[0];

      // 해당 주의 수입/지출 합계
      const weekIncome = eightWeekIncomeRecords
        .filter(r => r.date >= weekStart && r.date <= weekEnd)
        .reduce((sum, r) => sum + (r.amount || 0), 0);
      const weekExpense = eightWeekExpenseRecords
        .filter(r => r.date >= weekStart && r.date <= weekEnd)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      // 주의 일요일 날짜를 M/d 형식으로
      const displayDate = `${weekSunday.getMonth() + 1}/${weekSunday.getDate()}`;

      weeklyData.push({
        date: displayDate,
        income: weekIncome,
        expense: weekExpense,
      });
    }

    return NextResponse.json({
      weeklyIncome,
      weeklyExpense,
      balance,
      unmatchedCount,
      // 새로운 동기집행률 관련 데이터
      yearlyIncome,
      yearlyExpense,
      carryoverBalance,
      totalBudget,
      syncBudget,
      syncExecutionRate,
      yearlyExecutionRate,
      daysPassed,
      daysInYear,
      currentYear,
      weeklyData,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({
      weeklyIncome: 0,
      weeklyExpense: 0,
      balance: 0,
      unmatchedCount: 0,
      yearlyIncome: 0,
      yearlyExpense: 0,
      carryoverBalance: 0,
      totalBudget: 0,
      syncBudget: 0,
      syncExecutionRate: 0,
      yearlyExecutionRate: 0,
      daysPassed: 0,
      daysInYear: 365,
      currentYear: new Date().getFullYear(),
      weeklyData: [],
    });
  }
}
