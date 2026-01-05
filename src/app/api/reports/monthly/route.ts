import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords } from '@/lib/google-sheets';
import type { MonthlyReport } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // 해당 연도의 전체 데이터 조회
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [incomeRecords, expenseRecords] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
    ]);

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

    const report: MonthlyReport = {
      year,
      months: Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          income: data.income,
          expense: data.expense,
          balance: data.income - data.expense,
        }))
        .sort((a, b) => a.month - b.month),
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    return NextResponse.json(
      { success: false, error: '월간보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
