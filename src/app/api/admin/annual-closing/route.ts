import { NextRequest, NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getCarryoverBalance,
  setCarryoverBalance,
  getBankTransactions,
  getKSTDateTime,
} from '@/lib/google-sheets';
import { getServerSession } from '@/lib/auth/finance-permissions';

/**
 * 연마감 상태 확인 (이월잔액) - super_admin만
 * GET /api/admin/annual-closing
 */
export async function GET() {
  try {
    // 권한 확인 (super_admin만)
    const session = await getServerSession();
    if (!session || session.finance_role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;

    // 연마감은 1월에만 확인 (전년도 마감)
    // 예: 2027년 1월에 2026년 마감
    if (month !== 1) {
      return NextResponse.json({
        success: true,
        needsClosing: false,
        targetYear: null,
        carryover: {
          needsClosing: false,
          currentData: null,
          preview: null,
        },
      });
    }

    // 1월인 경우 전년도 마감 확인
    const targetYear = currentYear - 1;

    // 이월잔액 상태 확인
    const carryoverData = await getCarryoverBalance(targetYear);
    const needsClosing = !carryoverData || carryoverData.balance === 0;

    // 이월잔액 미리보기
    let carryoverPreview = null;
    if (needsClosing) {
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
        difference: calculatedBalance - lastBankBalance,
      };
    }

    return NextResponse.json({
      success: true,
      needsClosing,
      targetYear,
      carryover: {
        needsClosing,
        currentData: carryoverData,
        preview: carryoverPreview,
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
 * 연마감 실행 (이월잔액 저장) - super_admin만
 * POST /api/admin/annual-closing
 *
 * body: {
 *   targetYear: number,
 *   carryover: { balance: number, construction_balance?: number, note?: string }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 권한 확인 (super_admin만)
    const session = await getServerSession();
    if (!session || session.finance_role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetYear, carryover } = body;

    if (!targetYear) {
      return NextResponse.json(
        { success: false, error: '대상 연도가 지정되지 않았습니다' },
        { status: 400 }
      );
    }

    if (!carryover) {
      return NextResponse.json(
        { success: false, error: '이월잔액 정보가 없습니다' },
        { status: 400 }
      );
    }

    // 이월잔액 저장
    await setCarryoverBalance({
      year: targetYear,
      balance: carryover.balance,
      construction_balance: carryover.construction_balance || 0,
      note: carryover.note || `${targetYear}년 연마감`,
      updated_at: getKSTDateTime(),
      updated_by: session.name,
    });

    return NextResponse.json({
      success: true,
      message: '이월잔액이 저장되었습니다',
    });
  } catch (error) {
    console.error('Annual closing error:', error);
    return NextResponse.json(
      { success: false, error: '연마감 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
