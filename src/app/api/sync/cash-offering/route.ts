import { NextRequest, NextResponse } from 'next/server';
import { fetchCashOfferings } from '@/lib/google-sheets';
import { syncCashOfferingsWithDuplicatePrevention } from '@/lib/matching-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '시작일과 종료일을 입력하세요' },
        { status: 400 }
      );
    }

    // 현금헌금 조회
    const cashOfferings = await fetchCashOfferings(startDate, endDate);

    if (cashOfferings.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        totalAmount: 0,
        suppressedBankTransactions: 0,
        warnings: [],
        message: '해당 기간에 현금헌금이 없습니다',
      });
    }

    // 동기화 실행
    const result = await syncCashOfferingsWithDuplicatePrevention(
      cashOfferings,
      startDate,
      endDate
    );

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.processed}건의 현금헌금이 동기화되었습니다`,
    });
  } catch (error) {
    console.error('Cash offering sync error:', error);
    return NextResponse.json(
      { success: false, error: '현금헌금 동기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
