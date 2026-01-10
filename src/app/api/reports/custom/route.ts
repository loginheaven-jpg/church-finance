import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getBudget } from '@/lib/google-sheets';

interface PeriodData {
  startDate: string;
  endDate: string;
  label: string;
  income: {
    total: number;
    byCategory: Array<{ code: number; name: string; amount: number }>;
  };
  expense: {
    total: number;
    byCategory: Array<{ code: number; name: string; amount: number }>;
  };
  budget?: {
    total: number;
    executed: number;
    rate: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periods, includeIncome, includeExpense, includeBudget } = body;

    if (!periods || periods.length === 0) {
      return NextResponse.json(
        { success: false, error: '최소 하나의 기간을 선택해주세요' },
        { status: 400 }
      );
    }

    const results: PeriodData[] = [];

    for (const period of periods) {
      const { startDate, endDate, label } = period;
      const periodData: PeriodData = {
        startDate,
        endDate,
        label,
        income: { total: 0, byCategory: [] },
        expense: { total: 0, byCategory: [] },
      };

      // 수입 분석
      if (includeIncome) {
        const incomeRecords = await getIncomeRecords(startDate, endDate);
        const incomeByCategory = new Map<number, { name: string; amount: number }>();

        // 카테고리 코드별 이름 매핑
        const categoryNames: Record<number, string> = {
          10: '일반헌금',
          20: '감사헌금',
          30: '선교헌금',
          40: '자본수입',
          500: '건축헌금',
        };

        incomeRecords.forEach(r => {
          const categoryCode = Math.floor(r.offering_code / 10) * 10;
          if (!incomeByCategory.has(categoryCode)) {
            incomeByCategory.set(categoryCode, { name: categoryNames[categoryCode] || `기타수입`, amount: 0 });
          }
          incomeByCategory.get(categoryCode)!.amount += r.amount;
        });

        periodData.income = {
          total: incomeRecords.reduce((sum, r) => sum + r.amount, 0),
          byCategory: Array.from(incomeByCategory.entries())
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.amount - a.amount),
        };
      }

      // 지출 분석
      if (includeExpense) {
        const expenseRecords = await getExpenseRecords(startDate, endDate);
        const expenseByCategory = new Map<number, { name: string; amount: number }>();

        // 지출 카테고리 코드별 이름 매핑
        const expenseCategoryNames: Record<number, string> = {
          10: '사례비',
          20: '예배비',
          30: '선교비',
          40: '교육비',
          50: '봉사비',
          60: '관리비',
          70: '운영비',
          80: '상회비',
          90: '기타비용',
          500: '건축비',
        };

        expenseRecords.forEach(r => {
          const categoryCode = r.category_code;
          if (!expenseByCategory.has(categoryCode)) {
            expenseByCategory.set(categoryCode, { name: expenseCategoryNames[categoryCode] || `기타지출`, amount: 0 });
          }
          expenseByCategory.get(categoryCode)!.amount += r.amount;
        });

        periodData.expense = {
          total: expenseRecords.reduce((sum, r) => sum + r.amount, 0),
          byCategory: Array.from(expenseByCategory.entries())
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.amount - a.amount),
        };
      }

      // 예산 대비 분석
      if (includeBudget) {
        const year = new Date(startDate).getFullYear();
        const budgetData = await getBudget(year);
        const expenseRecords = await getExpenseRecords(startDate, endDate);

        const totalBudget = budgetData
          .filter(b => b.category_code < 500)
          .reduce((sum, b) => sum + b.budgeted_amount, 0);
        const totalExpense = expenseRecords
          .filter(r => r.category_code < 500)
          .reduce((sum, r) => sum + r.amount, 0);

        periodData.budget = {
          total: totalBudget,
          executed: totalExpense,
          rate: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0,
        };
      }

      results.push(periodData);
    }

    // 비교 분석 (기간이 2개 이상인 경우)
    let comparison = null;
    if (results.length >= 2) {
      const base = results[0];
      comparison = results.slice(1).map((period, idx) => ({
        label: `${base.label} vs ${period.label}`,
        incomeChange: period.income.total - base.income.total,
        incomeChangeRate: base.income.total > 0
          ? Math.round(((period.income.total - base.income.total) / base.income.total) * 100)
          : 0,
        expenseChange: period.expense.total - base.expense.total,
        expenseChangeRate: base.expense.total > 0
          ? Math.round(((period.expense.total - base.expense.total) / base.expense.total) * 100)
          : 0,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        periods: results,
        comparison,
      },
    });
  } catch (error) {
    console.error('Custom report error:', error);
    return NextResponse.json(
      { success: false, error: '커스텀 보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
