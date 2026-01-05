import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getIncomeCodes, getExpenseCodes } from '@/lib/google-sheets';
import type { WeeklyReport } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // 기준 날짜 (기본: 오늘)
    const baseDate = dateParam ? new Date(dateParam) : new Date();

    // 해당 주의 일요일 ~ 토요일 계산
    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const startDate = sunday.toISOString().split('T')[0];
    const endDate = saturday.toISOString().split('T')[0];

    // 데이터 조회
    const [incomeRecords, expenseRecords, incomeCodes, expenseCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getIncomeCodes(),
      getExpenseCodes(),
    ]);

    // 코드 -> 이름 매핑 생성
    const incomeCodeMap = new Map(incomeCodes.map(c => [c.code, c.item]));
    const expenseCodeMap = new Map(expenseCodes.map(c => [c.code, c.item]));
    const expenseCategoryMap = new Map(expenseCodes.map(c => [c.category_code, c.category_item]));

    // 수입 집계
    const incomeByType = new Map<string, { type: string; code: number; amount: number }>();
    let totalIncome = 0;

    for (const record of incomeRecords) {
      totalIncome += record.amount;
      const key = `${record.offering_code}`;
      const existing = incomeByType.get(key);
      if (existing) {
        existing.amount += record.amount;
      } else {
        incomeByType.set(key, {
          type: incomeCodeMap.get(record.offering_code) || `코드 ${record.offering_code}`,
          code: record.offering_code,
          amount: record.amount,
        });
      }
    }

    // 지출 집계 (대코드 기준)
    const expenseByCategory = new Map<string, { category: string; code: number; amount: number }>();
    let totalExpense = 0;

    for (const record of expenseRecords) {
      totalExpense += record.amount;
      const key = `${record.category_code}`;
      const existing = expenseByCategory.get(key);
      if (existing) {
        existing.amount += record.amount;
      } else {
        expenseByCategory.set(key, {
          category: expenseCategoryMap.get(record.category_code) || expenseCodeMap.get(record.account_code) || `코드 ${record.category_code}`,
          code: record.category_code,
          amount: record.amount,
        });
      }
    }

    const report: WeeklyReport = {
      week: `${sunday.getMonth() + 1}/${sunday.getDate()} - ${saturday.getMonth() + 1}/${saturday.getDate()}`,
      dateRange: { start: startDate, end: endDate },
      income: {
        total: totalIncome,
        byType: Array.from(incomeByType.values()).sort((a, b) => b.amount - a.amount),
      },
      expense: {
        total: totalExpense,
        byCategory: Array.from(expenseByCategory.values()).sort((a, b) => b.amount - a.amount),
      },
      balance: totalIncome - totalExpense,
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Weekly report error:', error);
    return NextResponse.json(
      { success: false, error: '주간보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
