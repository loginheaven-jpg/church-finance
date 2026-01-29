import { NextRequest, NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getIncomeCodes,
  getExpenseCodes,
  getCarryoverBalance,
} from '@/lib/google-sheets';
import type { WeeklyReport } from '@/types';

// 주어진 날짜의 주일(일요일)을 계산
function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ISO 주차 계산
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// 날짜를 YYYY-MM-DD 형식으로
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    const weekOffset = searchParams.get('week');

    // 기준 날짜 계산
    let baseDate = new Date();

    if (weekOffset) {
      // week 파라미터로 주차 이동
      const offset = parseInt(weekOffset, 10);
      baseDate.setDate(baseDate.getDate() + offset * 7);
    } else if (dateParam) {
      baseDate = new Date(dateParam);
    }

    // 해당 주의 일요일 계산 (주일 중심)
    const sunday = getSundayOfWeek(baseDate);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    // 전주 토요일 (전주최종잔고 계산용)
    const prevSaturday = new Date(sunday);
    prevSaturday.setDate(sunday.getDate() - 1);

    const startDate = formatDate(sunday);
    const endDate = formatDate(saturday);
    const year = sunday.getFullYear();
    const weekNumber = getWeekNumber(sunday);
    const reportId = startDate.replace(/-/g, '');

    // 데이터 조회
    const [incomeRecords, expenseRecords, incomeCodes, expenseCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getIncomeCodes(),
      getExpenseCodes(),
    ]);

    // 이월잔액 조회 (전년도 말 잔액 = 해당 연도 시작 이월금)
    const carryover = await getCarryoverBalance(year - 1);
    const yearStartBalance = carryover?.balance || 0;

    // 전주까지의 누적 계산 (연초 ~ 전주 토요일)
    const yearStart = `${year}-01-01`;
    const prevEndDate = formatDate(prevSaturday);

    const [prevIncomeRecords, prevExpenseRecords] = await Promise.all([
      getIncomeRecords(yearStart, prevEndDate),
      getExpenseRecords(yearStart, prevEndDate),
    ]);

    // 전주까지 누적 수입/지출 (자본이동 제외, 건축 포함)
    // - 자본수입(40번대): 내부 자금 이동이므로 제외
    // - 자본지출(92, 93): 내부 자금 이동이므로 제외
    // - 건축(500번대): 포함 (편의상 분류일 뿐 통합 관리)
    let prevTotalIncome = 0;
    for (const r of prevIncomeRecords) {
      const code = r.offering_code;
      // 자본수입(40번대) 제외, 나머지 모두 포함 (건축 포함)
      if (!(code >= 40 && code < 50)) {
        prevTotalIncome += r.amount;
      }
    }

    let prevTotalExpense = 0;
    for (const r of prevExpenseRecords) {
      const accountCode = r.account_code;
      // 자본지출(92, 93) 제외, 나머지 모두 포함 (건축 포함)
      if (accountCode !== 92 && accountCode !== 93) {
        prevTotalExpense += r.amount;
      }
    }

    // 전주최종잔고 = 연초이월 + 전주까지누적수입 - 전주까지누적지출
    const previousBalance = yearStartBalance + prevTotalIncome - prevTotalExpense;

    // 코드 매핑 생성
    const incomeCodeMap = new Map(incomeCodes.map(c => [c.code, c]));
    const expenseCodeMap = new Map(expenseCodes.map(c => [c.code, c]));

    // 수입 카테고리 정의 (순서 유지)
    const incomeCategoryOrder = [10, 20, 30, 40];
    const incomeCategoryNames: Record<number, string> = {
      10: '일반헌금',
      20: '목적헌금',
      30: '잡수입',
      40: '자본수입',
    };

    // 지출 카테고리 정의 (순서 유지)
    const expenseCategoryOrder = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
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
      100: '예비비',
    };

    // 금주 수입 집계 (자본이동 제외, 건축 포함)
    const incomeByCategory = new Map<number, number>();
    const incomeByCode = new Map<number, number>();
    let weeklyIncome = 0;
    let weeklyIncomeSubtotal = 0;  // 잔고 계산용 (자본이동 제외)
    let constructionIncome = 0;    // 표시용 (건축 별도 집계)
    let capitalIncome = 0;         // 자본수입 (제외됨)

    for (const record of incomeRecords) {
      const code = record.offering_code;
      const codeInfo = incomeCodeMap.get(code);
      const categoryCode = codeInfo?.category_code || Math.floor(code / 10) * 10;

      weeklyIncome += record.amount;

      // 건축(500번대) 별도 집계 (표시용)
      if (categoryCode >= 500) {
        constructionIncome += record.amount;
      }

      // 자본수입(40번대) 제외, 나머지는 잔고 계산에 포함
      if (code >= 40 && code < 50) {
        capitalIncome += record.amount;
      } else {
        weeklyIncomeSubtotal += record.amount;
        // 카테고리/코드별 집계 (건축 제외하여 표시)
        if (categoryCode < 500) {
          incomeByCategory.set(categoryCode, (incomeByCategory.get(categoryCode) || 0) + record.amount);
          incomeByCode.set(code, (incomeByCode.get(code) || 0) + record.amount);
        }
      }
    }

    // 금주 지출 집계 (자본이동 제외, 건축 포함)
    const expenseByCategory = new Map<number, number>();
    const expenseByCode = new Map<number, number>();
    let weeklyExpense = 0;
    let weeklyExpenseSubtotal = 0;  // 잔고 계산용 (자본이동 제외)
    let constructionExpense = 0;    // 표시용 (건축 별도 집계)
    let capitalExpense = 0;         // 자본지출 (제외됨)

    for (const record of expenseRecords) {
      const categoryCode = record.category_code;
      const accountCode = record.account_code;

      weeklyExpense += record.amount;

      // 건축(500번대) 별도 집계 (표시용)
      if (categoryCode >= 500) {
        constructionExpense += record.amount;
      }

      // 자본지출(92, 93) 제외, 나머지는 잔고 계산에 포함
      if (accountCode === 92 || accountCode === 93) {
        capitalExpense += record.amount;
      } else {
        weeklyExpenseSubtotal += record.amount;
        // 카테고리/코드별 집계 (건축 제외하여 표시)
        if (categoryCode < 500) {
          expenseByCategory.set(categoryCode, (expenseByCategory.get(categoryCode) || 0) + record.amount);
          expenseByCode.set(accountCode, (expenseByCode.get(accountCode) || 0) + record.amount);
        }
      }
    }

    // 현재잔고 = 전주최종잔고 + 금주수입 - 금주지출 (자본이동 제외, 건축 포함)
    const currentBalance = previousBalance + weeklyIncomeSubtotal - weeklyExpenseSubtotal;

    // 수입 카테고리별 배열 생성
    const incomeByCategoryArray = incomeCategoryOrder.map(catCode => ({
      categoryCode: catCode,
      categoryName: incomeCategoryNames[catCode],
      amount: incomeByCategory.get(catCode) || 0,
    }));

    // 수입 코드별 배열 생성
    const incomeByCodeArray = Array.from(incomeByCode.entries())
      .map(([code, amount]) => {
        const codeInfo = incomeCodeMap.get(code);
        return {
          code,
          name: codeInfo?.item || `코드 ${code}`,
          categoryCode: codeInfo?.category_code || Math.floor(code / 10) * 10,
          amount,
        };
      })
      .sort((a, b) => a.code - b.code);

    // 지출 카테고리별 배열 생성
    const expenseByCategoryArray = expenseCategoryOrder.map(catCode => ({
      categoryCode: catCode,
      categoryName: expenseCategoryNames[catCode],
      amount: expenseByCategory.get(catCode) || 0,
    }));

    // 지출 코드별 배열 생성
    const expenseByCodeArray = Array.from(expenseByCode.entries())
      .map(([code, amount]) => {
        const codeInfo = expenseCodeMap.get(code);
        return {
          code,
          name: codeInfo?.item || `코드 ${code}`,
          categoryCode: codeInfo?.category_code || Math.floor(code / 10) * 10,
          amount,
        };
      })
      .sort((a, b) => a.code - b.code);

    const report: WeeklyReport = {
      year,
      weekNumber,
      sundayDate: startDate,
      reportId,
      dateRange: { start: startDate, end: endDate },
      previousBalance,
      currentBalance,
      income: {
        total: weeklyIncome,
        subtotal: weeklyIncomeSubtotal,
        byCategory: incomeByCategoryArray,
        byCode: incomeByCodeArray,
      },
      expense: {
        total: weeklyExpense,
        subtotal: weeklyExpenseSubtotal,
        byCategory: expenseByCategoryArray,
        byCode: expenseByCodeArray,
      },
      construction: {
        income: constructionIncome,
        expense: constructionExpense,
      },
      balance: weeklyIncomeSubtotal - weeklyExpenseSubtotal,
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
