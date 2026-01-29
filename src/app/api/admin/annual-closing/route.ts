import { NextRequest, NextResponse } from 'next/server';
import {
  getBuildingMaster,
  isAnnualClosingNeeded,
  performAnnualClosing,
  getIncomeRecords,
  getExpenseRecords,
  getCarryoverBalance,
  setCarryoverBalance,
  getBankTransactions,
  getKSTDateTime,
} from '@/lib/google-sheets';

/**
 * 연마감 상태 확인 (통합)
 * GET /api/admin/annual-closing
 *
 * 이월잔액 + 성전봉헌 연마감 상태를 함께 반환
 */
export async function GET() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;

    // 연마감 대상 연도: 1월이면 전년도, 아니면 현재 연도
    const targetYear = month === 1 ? currentYear - 1 : currentYear;

    // 1. 성전봉헌 연마감 상태
    const buildingMaster = await getBuildingMaster();
    const buildingNeedsClosing = isAnnualClosingNeeded(buildingMaster.snapshotYear);

    let buildingPreview = null;
    if (buildingNeedsClosing) {
      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;

      const [incomeRecords, expenseRecords] = await Promise.all([
        getIncomeRecords(startDate, endDate),
        getExpenseRecords(startDate, endDate),
      ]);

      const donation = incomeRecords
        .filter(r => r.offering_code === 501)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const interest = expenseRecords
        .filter(r => r.account_code === 501)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const principal = expenseRecords
        .filter(r => r.account_code === 502)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      buildingPreview = {
        targetYear,
        donation,
        interest,
        principal,
        currentLoanBalance: buildingMaster.loanBalance,
        newLoanBalance: buildingMaster.loanBalance - principal,
      };
    }

    // 2. 이월잔액 상태 확인
    const carryoverData = await getCarryoverBalance(targetYear);
    const carryoverNeedsClosing = !carryoverData || carryoverData.balance === 0;

    // 이월잔액 미리보기: 전년도 마지막 은행 잔액 기준 계산
    let carryoverPreview = null;
    if (carryoverNeedsClosing) {
      // 전년도 마지막 거래의 잔액 조회
      const allBankTransactions = await getBankTransactions();
      const bankTransactions = allBankTransactions.filter(
        t => t.transaction_date >= `${targetYear}-01-01` && t.transaction_date <= `${targetYear}-12-31`
      );

      // 시간 정규화 함수
      const normalizeTime = (time: string | undefined) => (time || '00:00:00').padStart(8, '0');

      // 날짜+시간으로 정렬하여 마지막 거래 찾기
      const sortedBank = bankTransactions
        .filter(t => t.balance > 0)
        .sort((a, b) => {
          const aDateTime = `${a.transaction_date} ${normalizeTime(a.time)}`;
          const bDateTime = `${b.transaction_date} ${normalizeTime(b.time)}`;
          return bDateTime.localeCompare(aDateTime);
        });

      const lastBankBalance = sortedBank[0]?.balance || 0;
      const lastBankDate = sortedBank[0]?.transaction_date || null;

      // 수입/지출 계산
      const [yearlyIncome, yearlyExpense] = await Promise.all([
        getIncomeRecords(`${targetYear}-01-01`, `${targetYear}-12-31`),
        getExpenseRecords(`${targetYear}-01-01`, `${targetYear}-12-31`),
      ]);

      const totalIncome = yearlyIncome.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalExpense = yearlyExpense.reduce((sum, r) => sum + (r.amount || 0), 0);

      // 기존 이월잔액 (전전년도)
      const prevCarryover = await getCarryoverBalance(targetYear - 1);
      const prevBalance = prevCarryover?.balance || 0;

      // 계산 잔액 = 전년이월 + 수입 - 지출
      const calculatedBalance = prevBalance + totalIncome - totalExpense;

      carryoverPreview = {
        targetYear,
        prevBalance,
        totalIncome,
        totalExpense,
        calculatedBalance,
        lastBankBalance,
        lastBankDate,
        // 차액 (계산 vs 은행)
        difference: calculatedBalance - lastBankBalance,
      };
    }

    // 연마감 필요 여부 (둘 중 하나라도 필요하면 true)
    const needsClosing = buildingNeedsClosing || carryoverNeedsClosing;

    return NextResponse.json({
      success: true,
      needsClosing,
      targetYear,
      carryover: {
        needsClosing: carryoverNeedsClosing,
        currentData: carryoverData,
        preview: carryoverPreview,
      },
      building: {
        needsClosing: buildingNeedsClosing,
        snapshotYear: buildingMaster.snapshotYear,
        preview: buildingPreview,
      },
    });
  } catch (error) {
    console.error('Annual closing check error:', error);
    return NextResponse.json(
      { success: false, error: '연마감 상태 확인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 연마감 실행 (통합)
 * POST /api/admin/annual-closing
 *
 * body: {
 *   targetYear: number,
 *   carryover?: { balance: number, construction_balance?: number, note?: string },
 *   building?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetYear, carryover, building } = body;

    if (!targetYear) {
      return NextResponse.json(
        { success: false, error: '대상 연도가 지정되지 않았습니다' },
        { status: 400 }
      );
    }

    const results = {
      carryover: null as { success: boolean; message: string } | null,
      building: null as { success: boolean; message: string; data?: unknown } | null,
    };

    // 1. 이월잔액 저장
    if (carryover) {
      try {
        await setCarryoverBalance({
          year: targetYear,
          balance: carryover.balance,
          construction_balance: carryover.construction_balance || 0,
          note: carryover.note || `${targetYear}년 연마감`,
          updated_at: getKSTDateTime(),
          updated_by: 'super_admin',
        });
        results.carryover = { success: true, message: '이월잔액이 저장되었습니다' };
      } catch (error) {
        results.carryover = { success: false, message: String(error) };
      }
    }

    // 2. 성전봉헌 연마감
    if (building) {
      try {
        const result = await performAnnualClosing(targetYear);
        results.building = {
          success: result.success,
          message: result.message,
          data: result.data,
        };
      } catch (error) {
        results.building = { success: false, message: String(error) };
      }
    }

    // 전체 성공 여부
    const allSuccess =
      (!carryover || results.carryover?.success) &&
      (!building || results.building?.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? '연마감이 완료되었습니다' : '일부 작업이 실패했습니다',
      results,
    });
  } catch (error) {
    console.error('Annual closing error:', error);
    return NextResponse.json(
      { success: false, error: '연마감 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
