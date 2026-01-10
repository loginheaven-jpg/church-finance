import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getIncomeCodes, getExpenseCodes } from '@/lib/google-sheets';

interface YearlyData {
  year: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeByCategory: Record<number, { name: string; amount: number }>;
  expenseByCategory: Record<number, { name: string; amount: number }>;
  monthlyIncome: number[];
  monthlyExpense: number[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endYear = Number(searchParams.get('year')) || new Date().getFullYear();
    const yearCount = Number(searchParams.get('count')) || 10; // 기본 10개년
    const years = Array.from({ length: yearCount }, (_, i) => endYear - yearCount + 1 + i);
    const years3 = [endYear - 2, endYear - 1, endYear]; // 월별 추이용 3개년

    // 코드 정보 조회
    const [incomeCodes, expenseCodes] = await Promise.all([
      getIncomeCodes(),
      getExpenseCodes(),
    ]);

    // 카테고리 맵 생성
    const incomeCategoryMap = new Map<number, string>();
    const expenseCategoryMap = new Map<number, string>();

    incomeCodes.forEach(c => {
      if (c.code % 10 === 0) {
        incomeCategoryMap.set(c.category_code, c.category_item);
      }
    });
    expenseCodes.forEach(c => {
      if (c.code % 10 === 0) {
        expenseCategoryMap.set(c.category_code, c.category_item);
      }
    });

    // 각 연도별 데이터 조회 및 집계
    const yearlyDataPromises = years.map(async (year) => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const [incomeRecords, expenseRecords] = await Promise.all([
        getIncomeRecords(startDate, endDate),
        getExpenseRecords(startDate, endDate),
      ]);

      // 카테고리별 수입 집계
      const incomeByCategory: Record<number, { name: string; amount: number }> = {};
      incomeRecords.forEach(r => {
        const categoryCode = Math.floor(r.offering_code / 10) * 10;
        if (!incomeByCategory[categoryCode]) {
          incomeByCategory[categoryCode] = {
            name: incomeCategoryMap.get(categoryCode) || `카테고리${categoryCode}`,
            amount: 0,
          };
        }
        incomeByCategory[categoryCode].amount += r.amount;
      });

      // 카테고리별 지출 집계
      const expenseByCategory: Record<number, { name: string; amount: number }> = {};
      expenseRecords.forEach(r => {
        const categoryCode = r.category_code || Math.floor(r.account_code / 10) * 10;
        if (!expenseByCategory[categoryCode]) {
          expenseByCategory[categoryCode] = {
            name: expenseCategoryMap.get(categoryCode) || `카테고리${categoryCode}`,
            amount: 0,
          };
        }
        expenseByCategory[categoryCode].amount += r.amount;
      });

      // 월별 집계
      const monthlyIncome = Array(12).fill(0);
      const monthlyExpense = Array(12).fill(0);

      incomeRecords.forEach(r => {
        const month = new Date(r.date).getMonth();
        monthlyIncome[month] += r.amount;
      });

      expenseRecords.forEach(r => {
        const month = new Date(r.date).getMonth();
        monthlyExpense[month] += r.amount;
      });

      const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);

      return {
        year,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        incomeByCategory,
        expenseByCategory,
        monthlyIncome,
        monthlyExpense,
      } as YearlyData;
    });

    const yearlyData = await Promise.all(yearlyDataPromises);

    // 증감률 계산
    const calculateGrowthRate = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // 비교 데이터 생성
    const comparison = {
      years,
      summary: years.map((year, idx) => {
        const data = yearlyData[idx];
        const prevData = idx > 0 ? yearlyData[idx - 1] : null;

        return {
          year,
          totalIncome: data.totalIncome,
          totalExpense: data.totalExpense,
          balance: data.balance,
          incomeGrowth: prevData ? calculateGrowthRate(data.totalIncome, prevData.totalIncome) : 0,
          expenseGrowth: prevData ? calculateGrowthRate(data.totalExpense, prevData.totalExpense) : 0,
        };
      }),
      incomeByCategory: years.map((year, idx) => ({
        year,
        categories: yearlyData[idx].incomeByCategory,
      })),
      expenseByCategory: years.map((year, idx) => ({
        year,
        categories: yearlyData[idx].expenseByCategory,
      })),
      // 월별 추이는 3개년만 (years3)
      monthlyTrend: years3.map((year) => {
        const data = yearlyData.find(d => d.year === year);
        return {
          year,
          income: data?.monthlyIncome || Array(12).fill(0),
          expense: data?.monthlyExpense || Array(12).fill(0),
        };
      }),
    };

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('Comparison report error:', error);
    return NextResponse.json(
      { success: false, error: '연간 비교 보고서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
