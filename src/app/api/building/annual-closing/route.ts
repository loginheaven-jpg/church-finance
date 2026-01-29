import { NextRequest, NextResponse } from 'next/server';
import {
  getBuildingMaster,
  isAnnualClosingNeeded,
  performAnnualClosing,
  getIncomeRecords,
  getExpenseRecords,
} from '@/lib/google-sheets';

/**
 * 연마감 상태 확인
 * GET /api/building/annual-closing
 */
export async function GET() {
  try {
    const master = await getBuildingMaster();
    const needsClosing = isAnnualClosingNeeded(master.snapshotYear);

    // 연마감 대상 연도 계산
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const targetYear = month === 1 ? currentYear - 1 : currentYear;

    // 대상 연도 데이터 미리보기
    let preview = null;
    if (needsClosing) {
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

      preview = {
        targetYear,
        donation,
        interest,
        principal,
        currentLoanBalance: master.loanBalance,
        newLoanBalance: master.loanBalance - principal,
      };
    }

    return NextResponse.json({
      success: true,
      needsClosing,
      snapshotYear: master.snapshotYear,
      snapshotDate: master.snapshotDate,
      targetYear: needsClosing ? targetYear : null,
      preview,
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
 * 연마감 실행
 * POST /api/building/annual-closing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetYear } = body;

    if (!targetYear) {
      return NextResponse.json(
        { success: false, error: '대상 연도가 지정되지 않았습니다' },
        { status: 400 }
      );
    }

    // 연마감 실행
    const result = await performAnnualClosing(targetYear);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('Annual closing error:', error);
    return NextResponse.json(
      { success: false, error: '연마감 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
