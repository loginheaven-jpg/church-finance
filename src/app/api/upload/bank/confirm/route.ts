import { NextRequest, NextResponse } from 'next/server';
import { addBankTransactions, getWeekEndingSunday } from '@/lib/google-sheets';
import type { BankTransaction } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: '저장할 데이터가 없습니다' },
        { status: 400 }
      );
    }

    // 안 α (K3): client 페이로드 신뢰 제거 — date 재계산 + 매칭상태 초기화 강제
    const sanitized = (transactions as BankTransaction[]).map(t => ({
      ...t,
      date: getWeekEndingSunday(t.transaction_date),
      matched_status: 'pending' as const,
      matched_type: '',
      matched_ids: '',
      suppressed: false,
      suppressed_reason: '',
    }));

    // Google Sheets에 저장
    await addBankTransactions(sanitized);

    return NextResponse.json({
      success: true,
      uploaded: transactions.length,
      message: `${transactions.length}건의 은행 거래가 저장되었습니다`,
    });
  } catch (error) {
    console.error('Bank confirm error:', error);
    return NextResponse.json(
      { success: false, error: '은행원장 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
