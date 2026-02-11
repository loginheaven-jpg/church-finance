import { NextRequest, NextResponse } from 'next/server';
import { getBudget, getIncomeRecords, getCarryoverBalance } from '@/lib/google-sheets';

// 지출 카테고리 → 은행 표시명 매핑
const EXPENSE_DISPLAY_NAMES: Record<number, string> = {
  10: '인건비',
  20: '예배비',
  30: '선교비',
  40: '교육비',
  50: '봉사비',
  60: '관리비',
  70: '운영비',
  80: '상회비',
  90: '기타비용',
  100: '예비비',
  500: '건축비',
};

// 수입 카테고리명
const INCOME_CATEGORY_NAMES: Record<number, string> = {
  10: '헌금',
  20: '목적헌금',
  30: '잡수입',
  40: '자본수입',
  500: '건축헌금',
};

// 수입 상세코드명
const INCOME_CODE_NAMES: Record<number, string> = {
  11: '주일헌금',
  12: '십일조헌금',
  13: '감사헌금',
  14: '특별(절기)헌금',
  15: '어린이부',
  16: '중고',
  17: '청년부',
  21: '선교헌금',
  22: '구제헌금',
  23: '전도회비',
  24: '지정헌금',
  30: '잡수입',
  31: '이자수입',
  32: '기타잡수입',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (!yearParam) {
      return NextResponse.json(
        { success: false, error: '연도를 지정해주세요' },
        { status: 400 }
      );
    }

    const year = Number(yearParam);

    // 3개 데이터 소스 병렬 호출
    const [budgetData, incomeRecords, carryover] = await Promise.all([
      getBudget(year),
      getIncomeRecords(`${year - 1}-01-01`, `${year - 1}-12-31`),
      getCarryoverBalance(year - 1),
    ]);

    // === 수입 집계 (전년 실적) ===
    const incomeByCode = new Map<number, number>();
    for (const r of incomeRecords) {
      const code = r.offering_code;
      incomeByCode.set(code, (incomeByCode.get(code) || 0) + r.amount);
    }

    // 카테고리별 집계
    const incomeByCat = new Map<number, number>();
    for (const r of incomeRecords) {
      const catCode = r.offering_code >= 500 ? 500 : Math.floor(r.offering_code / 10) * 10;
      incomeByCat.set(catCode, (incomeByCat.get(catCode) || 0) + r.amount);
    }

    // 수입 카테고리 구성
    const incomeCategories = [10, 20, 30, 40, 500].map(catCode => {
      // 해당 카테고리에 속하는 상세 코드 추출
      const codes: Array<{ code: number; name: string; amount: number }> = [];
      for (const [code, amount] of incomeByCode.entries()) {
        const belongsToCat = code >= 500 ? catCode === 500 : Math.floor(code / 10) * 10 === catCode;
        if (belongsToCat && amount > 0) {
          codes.push({
            code,
            name: INCOME_CODE_NAMES[code] || `코드${code}`,
            amount,
          });
        }
      }
      codes.sort((a, b) => a.code - b.code);

      return {
        categoryCode: catCode,
        categoryName: INCOME_CATEGORY_NAMES[catCode] || `기타`,
        total: incomeByCat.get(catCode) || 0,
        codes,
      };
    });

    const incomeGeneralSubtotal = [10, 20, 30, 40].reduce(
      (sum, cat) => sum + (incomeByCat.get(cat) || 0), 0
    );
    const incomeConstructionTotal = incomeByCat.get(500) || 0;
    const incomeGrandTotal = incomeGeneralSubtotal + incomeConstructionTotal;

    // === 지출 집계 (해당연도 예산) ===
    const expenseByCat = new Map<number, number>();
    for (const b of budgetData) {
      const cat = b.category_code;
      expenseByCat.set(cat, (expenseByCat.get(cat) || 0) + b.budgeted_amount);
    }

    const expenseCategories = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 500]
      .filter(cat => (expenseByCat.get(cat) || 0) > 0 || cat === 500)
      .map(cat => ({
        categoryCode: cat,
        categoryName: EXPENSE_DISPLAY_NAMES[cat] || `기타`,
        total: expenseByCat.get(cat) || 0,
      }));

    const expenseGeneralSubtotal = expenseCategories
      .filter(c => c.categoryCode < 500)
      .reduce((sum, c) => sum + c.total, 0);
    const expenseConstructionTotal = expenseByCat.get(500) || 0;
    const expenseGrandTotal = expenseGeneralSubtotal + expenseConstructionTotal;

    return NextResponse.json({
      success: true,
      data: {
        year,
        carryover: {
          general: carryover?.balance || 0,
          construction: carryover?.construction_balance || 0,
        },
        income: {
          categories: incomeCategories,
          generalSubtotal: incomeGeneralSubtotal,
          constructionTotal: incomeConstructionTotal,
          grandTotal: incomeGrandTotal,
        },
        expense: {
          categories: expenseCategories,
          generalSubtotal: expenseGeneralSubtotal,
          constructionTotal: expenseConstructionTotal,
          grandTotal: expenseGrandTotal,
        },
      },
    });
  } catch (error) {
    console.error('Bank budget report error:', error);
    return NextResponse.json(
      { success: false, error: '은행제출용 예산안 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
