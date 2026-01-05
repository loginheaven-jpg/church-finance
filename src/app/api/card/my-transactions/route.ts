import { NextRequest, NextResponse } from 'next/server';
import { getUnmatchedCardTransactions } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cardOwner = searchParams.get('owner');

    let transactions = await getUnmatchedCardTransactions();

    // 소유자 필터링 (선택적)
    if (cardOwner) {
      transactions = transactions.filter(tx => tx.card_owner === cardOwner);
    }

    // 날짜순 정렬 (최신순)
    transactions.sort((a, b) => {
      const dateA = new Date(a.sale_date || a.billing_date);
      const dateB = new Date(b.sale_date || b.billing_date);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      total: transactions.length,
    });
  } catch (error) {
    console.error('Get card transactions error:', error);
    return NextResponse.json(
      { success: false, error: '카드 거래 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
