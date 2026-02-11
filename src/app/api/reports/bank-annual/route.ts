import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords, getCarryoverBalance } from '@/lib/google-sheets';

// 수입 카테고리 코드 → 카테고리 매핑
function incomeCategory(offeringCode: number): string {
  if (offeringCode >= 500) return 'construction';
  const cat = Math.floor(offeringCode / 10) * 10;
  switch (cat) {
    case 10: return 'general';
    case 20: return 'purpose';
    case 30: return 'misc';
    case 40: return 'capital';
    default: return 'general';
  }
}

// 지출 카테고리 코드 → 키 매핑
function expenseCatKey(categoryCode: number): string {
  if (categoryCode >= 500) return 'construction';
  const map: Record<number, string> = {
    10: 'personnel', 20: 'worship', 30: 'mission', 40: 'education',
    50: 'service', 60: 'admin', 70: 'operation', 80: 'assembly',
    90: 'misc', 100: 'reserve',
  };
  return map[categoryCode] || 'misc';
}

// 수입 상세코드명
const INCOME_CODE_NAMES: Record<number, string> = {
  11: '주일헌금', 12: '십일조헌금', 13: '감사헌금', 14: '특별(절기)헌금',
  21: '선교헌금', 22: '구제헌금', 24: '지정헌금',
  30: '잡수입', 31: '이자수입', 32: '기타잡수입',
  500: '건축헌금',
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
    const [incomeRecords, expenseRecords, carryover] = await Promise.all([
      getIncomeRecords(`${year}-01-01`, `${year}-12-31`),
      getExpenseRecords(`${year}-01-01`, `${year}-12-31`),
      getCarryoverBalance(year - 1),
    ]);

    const carryoverGeneral = carryover?.balance || 0;
    const carryoverConstruction = carryover?.construction_balance || 0;
    const carryoverTotal = carryoverGeneral + carryoverConstruction;

    // 월별 수입 집계 (12개월)
    const monthlyIncome = Array.from({ length: 12 }, () => ({
      general: 0, purpose: 0, misc: 0, capital: 0,
      generalSubtotal: 0, construction: 0, total: 0,
    }));

    for (const r of incomeRecords) {
      const month = parseInt(r.date.split('-')[1]) - 1; // 0-indexed
      if (month < 0 || month > 11) continue;
      const cat = incomeCategory(r.offering_code);
      const mi = monthlyIncome[month];
      switch (cat) {
        case 'general': mi.general += r.amount; break;
        case 'purpose': mi.purpose += r.amount; break;
        case 'misc': mi.misc += r.amount; break;
        case 'capital': mi.capital += r.amount; break;
        case 'construction': mi.construction += r.amount; break;
      }
    }

    // 소계/총계 계산
    for (const mi of monthlyIncome) {
      mi.generalSubtotal = mi.general + mi.purpose + mi.misc + mi.capital;
      mi.total = mi.generalSubtotal + mi.construction;
    }

    // 월별 지출 집계
    const monthlyExpense = Array.from({ length: 12 }, () => ({
      personnel: 0, worship: 0, mission: 0, education: 0,
      service: 0, admin: 0, operation: 0, assembly: 0,
      misc: 0, reserve: 0,
      generalSubtotal: 0, construction: 0, total: 0,
    }));

    for (const r of expenseRecords) {
      const month = parseInt(r.date.split('-')[1]) - 1;
      if (month < 0 || month > 11) continue;
      const key = expenseCatKey(r.category_code);
      const me = monthlyExpense[month];
      if (key in me) {
        (me as Record<string, number>)[key] += r.amount;
      }
    }

    // 지출 소계/총계
    for (const me of monthlyExpense) {
      me.generalSubtotal = me.personnel + me.worship + me.mission + me.education +
        me.service + me.admin + me.operation + me.assembly + me.misc + me.reserve;
      me.total = me.generalSubtotal + me.construction;
    }

    // 월별 잔고 계산
    const months = Array.from({ length: 12 }, (_, i) => {
      const periodBalance = monthlyIncome[i].total - monthlyExpense[i].total;
      return {
        income: monthlyIncome[i],
        expense: monthlyExpense[i],
        periodBalance,
        totalBalance: 0, // 아래서 누적 계산
      };
    });

    // 총잔고 누적 (전기이월 기반)
    let runningBalance = carryoverTotal;
    for (const m of months) {
      runningBalance += m.periodBalance;
      m.totalBalance = runningBalance;
    }

    // 수입부 상세내역 (연간 합계)
    const incomeByCode = new Map<number, number>();
    for (const r of incomeRecords) {
      incomeByCode.set(r.offering_code, (incomeByCode.get(r.offering_code) || 0) + r.amount);
    }

    const makeDetail = (codes: number[]) =>
      codes
        .map(c => ({ name: INCOME_CODE_NAMES[c] || `코드${c}`, amount: incomeByCode.get(c) || 0 }))
        .filter(d => d.amount > 0 || codes.length <= 4); // 주요 항목은 0이어도 표시

    const offeringDetail = makeDetail([11, 12, 13, 14]);
    const purposeDetail = makeDetail([21, 22, 24]);
    const constructionAmount = Array.from(incomeByCode.entries())
      .filter(([code]) => code >= 500)
      .reduce((sum, [, amt]) => sum + amt, 0);
    const miscAmount = (incomeByCode.get(30) || 0) + (incomeByCode.get(32) || 0);
    const interestAmount = incomeByCode.get(31) || 0;

    return NextResponse.json({
      success: true,
      data: {
        year,
        carryover: { general: carryoverGeneral, construction: carryoverConstruction, total: carryoverTotal },
        months,
        incomeDetail: {
          offering: offeringDetail,
          purposeOffering: purposeDetail,
          constructionAmount,
          miscAmount,
          interestAmount,
        },
      },
    });
  } catch (error) {
    console.error('Bank annual report error:', error);
    return NextResponse.json(
      { success: false, error: '은행제출용 연간보고 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
