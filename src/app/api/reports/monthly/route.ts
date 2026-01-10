import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getCarryoverBalance, getBankTransactions } from '@/lib/google-sheets';
import type { MonthlyReport } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const debug = searchParams.get('debug') === 'true';

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // 해당 연도의 전체 데이터 조회
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [incomeRecords, expenseRecords, carryoverData, bankTransactions] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getCarryoverBalance(year - 1), // 전년도 말 이월잔액
      getBankTransactions(),
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

    // 이월잔액
    const carryoverBalance = carryoverData?.balance || 0;

    // 연간 합계
    const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = months.reduce((sum, m) => sum + m.expense, 0);

    // 현재 잔고 (은행원장의 마지막 잔액)
    const sortedBank = bankTransactions
      .filter(t => t.balance > 0)
      .sort((a, b) => {
        if (a.transaction_date === b.transaction_date) {
          return (b.time || '').localeCompare(a.time || '');
        }
        return b.transaction_date.localeCompare(a.transaction_date);
      });
    const currentBalance = sortedBank[0]?.balance || 0;

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
        currentBalance,
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
