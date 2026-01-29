import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getCarryoverBalance } from '@/lib/google-sheets';
import type { MonthlyReport } from '@/types';

// 이월잔액을 동적으로 계산하는 헬퍼 함수
// 시트에 데이터가 없으면 이전 연도의 수입/지출로 계산
async function getCalculatedCarryover(targetYear: number): Promise<number> {
  // 먼저 시트에서 직접 조회
  const carryoverData = await getCarryoverBalance(targetYear);
  if (carryoverData?.balance !== undefined) {
    return carryoverData.balance;
  }

  // 기준 연도 (이 이전은 수동 입력 필요)
  const BASE_YEAR = 2020;
  if (targetYear <= BASE_YEAR) {
    return 0; // 기준 연도 이전 데이터는 0 반환
  }

  // 이전 연도의 이월금 + 이전 연도의 수입 - 지출로 계산
  // targetYear의 이월금 = (targetYear-1)의 이월금 + (targetYear-1)의 수입 - (targetYear-1)의 지출
  const prevYearCarryover = await getCalculatedCarryover(targetYear - 1);
  const prevStartDate = `${targetYear - 1}-01-01`;
  const prevEndDate = `${targetYear - 1}-12-31`;

  const [prevIncomeRecords, prevExpenseRecords] = await Promise.all([
    getIncomeRecords(prevStartDate, prevEndDate),
    getExpenseRecords(prevStartDate, prevEndDate),
  ]);

  const prevIncome = prevIncomeRecords.reduce((sum, r) => sum + r.amount, 0);
  const prevExpense = prevExpenseRecords.reduce((sum, r) => sum + r.amount, 0);

  return prevYearCarryover + prevIncome - prevExpense;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const debug = searchParams.get('debug') === 'true';

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // 해당 연도의 전체 데이터 조회
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [incomeRecords, expenseRecords, calculatedCarryover] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getCalculatedCarryover(year), // 해당 연도 시작 이월잔액 (= 전년도 말 잔액)
    ]);

    if (debug) {
      return NextResponse.json({
        debug: true,
        year,
        startDate,
        endDate,
        incomeCount: incomeRecords.length,
        expenseCount: expenseRecords.length,
        sampleIncome: incomeRecords.slice(0, 2),
        sampleExpense: expenseRecords.slice(0, 2),
        envCheck: {
          hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
          hasFinanceSheetId: !!process.env.FINANCE_SHEET_ID,
        }
      });
    }

    // 월별 집계
    const monthlyData = new Map<number, { income: number; expense: number }>();

    // 초기화
    for (let i = 1; i <= 12; i++) {
      monthlyData.set(i, { income: 0, expense: 0 });
    }

    // 수입 집계
    for (const record of incomeRecords) {
      const month = parseInt(record.date.split('-')[1]);
      const data = monthlyData.get(month)!;
      data.income += record.amount;
    }

    // 지출 집계
    for (const record of expenseRecords) {
      const month = parseInt(record.date.split('-')[1]);
      const data = monthlyData.get(month)!;
      data.expense += record.amount;
    }

    const months = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense,
      }))
      .sort((a, b) => a.month - b.month);

    // 이월잔액 (이미 동적 계산된 값)
    const carryoverBalance = calculatedCarryover;

    // 연간 합계
    const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = months.reduce((sum, m) => sum + m.expense, 0);

    // 현재 KST 시간 기준 현재 연도 확인
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentYear = kst.getFullYear();
    const isCurrentYear = year === currentYear;

    // 현재 잔고 (또는 연말잔고) = 이월금 + 수입 - 지출
    const endBalance = carryoverBalance + totalIncome - totalExpense;

    const report: MonthlyReport = {
      year,
      months,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        carryoverBalance,
        totalIncome,
        totalExpense,
        currentBalance: endBalance,
        isCurrentYear,
      },
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    return NextResponse.json(
      { success: false, error: '월간보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
