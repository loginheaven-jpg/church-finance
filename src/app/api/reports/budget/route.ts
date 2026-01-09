import { NextRequest, NextResponse } from 'next/server';
import { getBudget, getExpenseRecords } from '@/lib/google-sheets';

// 경과일수 계산
function getDaysPassed(year: number, endDate: string): number {
  const startOfYear = new Date(year, 0, 1);
  const end = new Date(endDate);
  const diffTime = end.getTime() - startOfYear.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// 윤년 확인
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const endDateParam = searchParams.get('endDate'); // 기준일 (옵션)

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // 기준일 결정 (기본값: 오늘 또는 연말)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let endDate: string;

    if (endDateParam) {
      endDate = endDateParam;
    } else if (year < today.getFullYear()) {
      // 과거년도는 연말까지
      endDate = `${year}-12-31`;
    } else if (year === today.getFullYear()) {
      // 현재년도는 오늘까지
      endDate = todayStr;
    } else {
      // 미래년도는 연말 (예측)
      endDate = `${year}-12-31`;
    }

    const daysPassed = getDaysPassed(year, endDate);
    const daysInYear = isLeapYear(year) ? 366 : 365;

    // 예산 및 지출 데이터 조회
    const [budgetData, expenseRecords] = await Promise.all([
      getBudget(year),
      getExpenseRecords(`${year}-01-01`, endDate),
    ]);

    // 지출을 계정과목별로 집계
    const expenseByAccount = new Map<number, number>();
    for (const record of expenseRecords) {
      const code = record.account_code;
      const current = expenseByAccount.get(code) || 0;
      expenseByAccount.set(code, current + record.amount);
    }

    // 동기집행률 계산 함수
    const calculateSyncRate = (executed: number, budget: number): number => {
      const syncBudget = (budget / daysInYear) * daysPassed;
      return syncBudget > 0 ? (executed / syncBudget) * 100 : 0;
    };

    // 카테고리별 그룹화
    const categoryMap = new Map<number, {
      category_code: number;
      category_item: string;
      budget: number;
      executed: number;
      executionRate: number;
      syncRate: number;
      accounts: Array<{
        account_code: number;
        account_item: string;
        budgeted: number;
        executed: number;
        percentage: number;
        syncRate: number;
        remaining: number;
      }>;
    }>();

    for (const budget of budgetData) {
      if (!categoryMap.has(budget.category_code)) {
        categoryMap.set(budget.category_code, {
          category_code: budget.category_code,
          category_item: budget.category_item,
          budget: 0,
          executed: 0,
          executionRate: 0,
          syncRate: 0,
          accounts: [],
        });
      }

      const executed = expenseByAccount.get(budget.account_code) || 0;
      const percentage = budget.budgeted_amount > 0
        ? Math.round((executed / budget.budgeted_amount) * 100)
        : 0;
      const syncRate = calculateSyncRate(executed, budget.budgeted_amount);

      const category = categoryMap.get(budget.category_code)!;
      category.budget += budget.budgeted_amount;
      category.executed += executed;

      category.accounts.push({
        account_code: budget.account_code,
        account_item: budget.account_item,
        budgeted: budget.budgeted_amount,
        executed,
        percentage,
        syncRate: Math.round(syncRate * 10) / 10,
        remaining: budget.budgeted_amount - executed,
      });
    }

    // 카테고리별 집행률/동기집행률 계산
    for (const category of categoryMap.values()) {
      category.executionRate = category.budget > 0
        ? Math.round((category.executed / category.budget) * 100 * 10) / 10
        : 0;
      category.syncRate = Math.round(calculateSyncRate(category.executed, category.budget) * 10) / 10;
    }

    // 전체 합계 계산
    let totalBudget = 0;
    let totalExecuted = 0;
    for (const category of categoryMap.values()) {
      totalBudget += category.budget;
      totalExecuted += category.executed;
    }

    const totalExecutionRate = totalBudget > 0
      ? Math.round((totalExecuted / totalBudget) * 100 * 10) / 10
      : 0;
    const totalSyncRate = Math.round(calculateSyncRate(totalExecuted, totalBudget) * 10) / 10;

    // 초과 항목 추출 (동기집행률 100% 초과)
    const overBudgetItems: Array<{
      code: number;
      name: string;
      syncRate: number;
    }> = [];

    for (const category of categoryMap.values()) {
      for (const account of category.accounts) {
        if (account.syncRate > 100) {
          overBudgetItems.push({
            code: account.account_code,
            name: account.account_item,
            syncRate: account.syncRate,
          });
        }
      }
    }
    overBudgetItems.sort((a, b) => b.syncRate - a.syncRate);

    const report = {
      year,
      referenceDate: endDate,
      daysPassed,
      daysInYear,
      totalBudget,
      totalExecuted,
      executionRate: totalExecutionRate,
      syncRate: totalSyncRate,
      overBudgetItems: overBudgetItems.slice(0, 10),
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
