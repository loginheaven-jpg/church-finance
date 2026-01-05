import { NextRequest, NextResponse } from 'next/server';
import {
  updateCardTransaction,
  addExpenseRecords,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import type { CardTransaction, ExpenseRecord } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, transaction, details } = body as {
      transactionId: string;
      transaction: CardTransaction;
      details: {
        purpose: string;
        account_code: number;
        note?: string;
      };
    };

    if (!transactionId || !details || !details.purpose || !details.account_code) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    const now = getKSTDateTime();

    // 지출부에 기록 추가
    const expenseRecord: ExpenseRecord = {
      id: generateId('EXP'),
      date: transaction.sale_date || transaction.billing_date,
      payment_method: '법인카드',
      vendor: transaction.merchant,
      description: details.purpose,
      amount: transaction.sale_amount,
      account_code: details.account_code,
      category_code: Math.floor(details.account_code / 10) * 10,
      note: details.note || `카드소유자: ${transaction.card_owner || '미지정'}`,
      created_at: now,
      created_by: transaction.card_owner || 'card_input',
    };

    await addExpenseRecords([expenseRecord]);

    // 카드 거래 상태 업데이트
    await updateCardTransaction(transactionId, {
      purpose: details.purpose,
      account_code: details.account_code,
      detail_completed: true,
      matched_status: 'matched',
      matched_id: expenseRecord.id,
    });

    return NextResponse.json({
      success: true,
      recordId: expenseRecord.id,
      message: '카드내역이 저장되었습니다',
    });
  } catch (error) {
    console.error('Submit card details error:', error);
    return NextResponse.json(
      { success: false, error: '카드내역 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
