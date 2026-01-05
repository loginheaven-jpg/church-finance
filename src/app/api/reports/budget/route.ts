import { NextRequest, NextResponse } from 'next/server';
import { getBudget, getExpenseRecords } from '@/lib/google-sheets';
import type { BudgetReport } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // 예산 및 지출 데이터 조회
    const [budgetData, expenseRecords] = await Promise.all([
      getBudget(year),
      getExpenseRecords(`${year}-01-01`, `${year}-12-31`),
    ]);

    // 지출을 계정과목별로 집계
    const expenseByAccount = new Map<number, number>();
    for (const record of expenseRecords) {
      const code = record.account_code;
      const current = expenseByAccount.get(code) || 0;
      expenseByAccount.set(code, current + record.amount);
    }

    // 카테고리별 그룹화
    const categoryMap = new Map<number, {
      category_code: number;
      category_item: string;
      accounts: Array<{
        account_code: number;
        account_item: string;
        budgeted: number;
        executed: number;
        percentage: number;
        remaining: number;
      }>;
    }>();

    for (const budget of budgetData) {
      if (!categoryMap.has(budget.category_code)) {
        categoryMap.set(budget.category_code, {
          category_code: budget.category_code,
          category_item: budget.category_item,
          accounts: [],
        });
      }

      const executed = expenseByAccount.get(budget.account_code) || 0;
      const percentage = budget.budgeted_amount > 0
        ? Math.round((executed / budget.budgeted_amount) * 100)
        : 0;

      categoryMap.get(budget.category_code)!.accounts.push({
        account_code: budget.account_code,
        account_item: budget.account_item,
        budgeted: budget.budgeted_amount,
        executed,
        percentage,
        remaining: budget.budgeted_amount - executed,
      });
    }

    const report: BudgetReport = {
      year,
      categories: Array.from(categoryMap.values())
        .sort((a, b) => a.category_code - b.category_code),
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Budget report error:', error);
    return NextResponse.json(
      { success: false, error: '예산대비보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
