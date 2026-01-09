import { NextRequest, NextResponse } from 'next/server';
import { getExpenseRecords, getExpenseCodes, getBudget } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year')) || new Date().getFullYear();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [expenseRecords, expenseCodes, budgetData] = await Promise.all([
      getExpenseRecords(startDate, endDate),
      getExpenseCodes(),
      getBudget(year),
    ]);

    // 코드 맵 생성
    const codeMap = new Map<number, { category: string; item: string }>();
    expenseCodes.forEach(c => {
      codeMap.set(c.code, { category: c.category_item, item: c.item });
    });

    // 예산 맵 생성
    const budgetMap = new Map<number, number>();
    budgetData.forEach(b => {
      budgetMap.set(b.account_code, b.budgeted_amount);
    });

    // 카테고리별 집계
    const byCategory = new Map<number, { name: string; amount: number; count: number; budget: number }>();
    // 항목별 집계
    const byCode = new Map<number, { name: string; category: string; amount: number; count: number; budget: number }>();
    // 월별 집계
    const byMonth = Array(12).fill(null).map(() => ({ expense: 0, count: 0 }));
    // 경로별 집계 (계좌이체, 법인카드 등)
    const byPaymentMethod = new Map<string, { amount: number; count: number }>();
    // 거래처별 집계
    const byVendor = new Map<string, { amount: number; count: number }>();

    expenseRecords.forEach(r => {
      const code = r.account_code;
      const categoryCode = r.category_code || Math.floor(code / 10) * 10;
      const codeInfo = codeMap.get(code);
      const month = new Date(r.date).getMonth();

      // 카테고리별
      if (!byCategory.has(categoryCode)) {
        const catInfo = codeMap.get(categoryCode);
        byCategory.set(categoryCode, {
          name: catInfo?.item || `카테고리${categoryCode}`,
          amount: 0,
          count: 0,
          budget: 0,
        });
      }
      const cat = byCategory.get(categoryCode)!;
      cat.amount += r.amount;
      cat.count += 1;

      // 항목별
      if (!byCode.has(code)) {
        byCode.set(code, {
          name: codeInfo?.item || `항목${code}`,
          category: codeInfo?.category || '',
          amount: 0,
          count: 0,
          budget: budgetMap.get(code) || 0,
        });
      }
      const item = byCode.get(code)!;
      item.amount += r.amount;
      item.count += 1;

      // 월별
      byMonth[month].expense += r.amount;
      byMonth[month].count += 1;

      // 경로별
      const method = r.payment_method || '기타';
      if (!byPaymentMethod.has(method)) {
        byPaymentMethod.set(method, { amount: 0, count: 0 });
      }
      const pm = byPaymentMethod.get(method)!;
      pm.amount += r.amount;
      pm.count += 1;

      // 거래처별
      const vendor = r.vendor || '미지정';
      if (!byVendor.has(vendor)) {
        byVendor.set(vendor, { amount: 0, count: 0 });
      }
      const vd = byVendor.get(vendor)!;
      vd.amount += r.amount;
      vd.count += 1;
    });

    // 카테고리별 예산 합계
    byCategory.forEach((cat, categoryCode) => {
      let categoryBudget = 0;
      budgetData.forEach(b => {
        if (b.category_code === categoryCode) {
          categoryBudget += b.budgeted_amount;
        }
      });
      cat.budget = categoryBudget;
    });

    // 총 합계
    const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalBudget = budgetData.reduce((sum, b) => sum + b.budgeted_amount, 0);
    const totalCount = expenseRecords.length;

    // 상위 거래처
    const topVendors = Array.from(byVendor.entries())
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: {
        year,
        summary: {
          totalExpense,
          totalBudget,
          executionRate: totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0,
          totalCount,
          averagePerTransaction: totalCount > 0 ? Math.round(totalExpense / totalCount) : 0,
        },
        byCategory: Array.from(byCategory.entries())
          .map(([code, data]) => ({
            code,
            ...data,
            executionRate: data.budget > 0 ? Math.round((data.amount / data.budget) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byCode: Array.from(byCode.entries())
          .map(([code, data]) => ({
            code,
            ...data,
            executionRate: data.budget > 0 ? Math.round((data.amount / data.budget) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        byMonth: byMonth.map((data, idx) => ({
          month: idx + 1,
          ...data,
        })),
        byPaymentMethod: Array.from(byPaymentMethod.entries())
          .map(([method, data]) => ({ method, ...data }))
          .sort((a, b) => b.amount - a.amount),
        topVendors,
      },
    });
  } catch (error) {
    console.error('Expense analysis error:', error);
    return NextResponse.json(
      { success: false, error: '지출 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
