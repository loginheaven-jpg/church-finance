import { NextResponse } from 'next/server';
import { getBankTransactions } from '@/lib/google-sheets';
import { getBankDuplicateKey } from '@/lib/bank-dedup';

// 중복 체크용 복합키: transaction_date | time | signedAmount | detail
// (안 β⁶ 2026-07-13) 키 로직은 @/lib/bank-dedup 로 일원화 — 클라이언트와 동일 키 보장.

export async function GET() {
  try {
    // 은행원장에서 모든 거래 조회
    const bankTransactions = await getBankTransactions();

    // 기존 데이터의 중복 체크 키 Set 생성
    const existingKeys = new Set<string>();
    for (const tx of bankTransactions) {
      existingKeys.add(getBankDuplicateKey(tx));
    }

    return NextResponse.json({
      success: true,
      existingKeys: Array.from(existingKeys),
      count: existingKeys.size,
    });
  } catch (error) {
    console.error('Bank duplicate check error:', error);
    return NextResponse.json(
      { success: false, error: '은행원장 중복 체크 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
