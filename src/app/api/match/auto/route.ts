import { NextResponse } from 'next/server';
import { autoMatchBankTransactions } from '@/lib/matching-engine';

export async function POST() {
  try {
    const result = await autoMatchBankTransactions();

    return NextResponse.json({
      success: true,
      autoMatched: result.autoMatched.length,
      suppressed: result.suppressed.length,
      needsReview: result.needsReview.length,
      message: `자동 매칭 ${result.autoMatched.length}건, 말소 ${result.suppressed.length}건, 검토 필요 ${result.needsReview.length}건`,
      data: result,
    });
  } catch (error) {
    console.error('Auto match error:', error);
    return NextResponse.json(
      { success: false, error: '자동 매칭 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
