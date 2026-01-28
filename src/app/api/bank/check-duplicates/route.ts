import { NextResponse } from 'next/server';
import { getBankTransactions } from '@/lib/google-sheets';

// 중복 체크용 복합키 생성: transaction_date + deposit + withdrawal + balance
function getDuplicateKey(
  transactionDate: string,
  deposit: number,
  withdrawal: number,
  balance: number
): string {
  return `${transactionDate}|${deposit}|${withdrawal}|${balance}`;
}

export async function GET() {
  try {
    // 은행원장에서 모든 거래 조회
    const bankTransactions = await getBankTransactions();

    // 기존 데이터의 중복 체크 키 Set 생성
    const existingKeys = new Set<string>();
    for (const tx of bankTransactions) {
      const key = getDuplicateKey(
        tx.transaction_date,
        Number(tx.deposit) || 0,
        Number(tx.withdrawal) || 0,
        Number(tx.balance) || 0
      );
      existingKeys.add(key);
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
