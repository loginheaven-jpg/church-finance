import { NextRequest, NextResponse } from 'next/server';
import {
  addExpenseRecords,
  deleteExpenseRecord,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import type { ExpenseRecord, CardExpenseItem } from '@/types';

interface ApplyRequest {
  transactions: CardExpenseItem[];
  nhCardRecordId: string;
}

interface ApplyResponse {
  success: boolean;
  message?: string;
  addedCount?: number;
  deletedRecordId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ApplyRequest = await request.json();
    const { transactions, nhCardRecordId } = body;

    // 유효성 검사
    if (!transactions || transactions.length === 0) {
      return NextResponse.json<ApplyResponse>(
        { success: false, error: '반영할 거래 내역이 없습니다' },
        { status: 400 }
      );
    }

    // 모든 거래에 description과 account_code가 있는지 확인
    const incompleteItems = transactions.filter(
      (tx) => !tx.description || tx.account_code === null || tx.account_code === undefined
    );

    if (incompleteItems.length > 0) {
      return NextResponse.json<ApplyResponse>(
        {
          success: false,
          error: `${incompleteItems.length}건의 거래에 내역 또는 계정코드가 입력되지 않았습니다`,
        },
        { status: 400 }
      );
    }

    // CardExpenseItem -> ExpenseRecord 변환
    const createdAt = getKSTDateTime();
    const expenseRecords: ExpenseRecord[] = transactions.map((tx) => ({
      id: generateId('EXP'),
      date: tx.date,
      payment_method: tx.payment_method,
      vendor: tx.vendor,
      description: tx.description,
      amount: tx.amount,
      account_code: tx.account_code as number,
      category_code: Math.floor((tx.account_code as number) / 10) * 10,
      note: tx.note,
      created_at: createdAt,
      created_by: '카드대금반영',
      transaction_date: tx.transaction_date,
    }));

    // 1. 지출부에 세부내역 추가
    await addExpenseRecords(expenseRecords);

    // 2. 기존 NH카드대금 행 삭제 (ID가 제공된 경우)
    let deletedRecordId: string | undefined;
    if (nhCardRecordId) {
      try {
        await deleteExpenseRecord(nhCardRecordId);
        deletedRecordId = nhCardRecordId;
      } catch (deleteError) {
        console.error('Failed to delete NH카드대금 record:', deleteError);
        // 삭제 실패해도 추가는 성공했으므로 경고만 반환
        return NextResponse.json<ApplyResponse>({
          success: true,
          message: `${expenseRecords.length}건의 거래가 추가되었습니다. (주의: NH카드대금 행 삭제 실패 - 수동 삭제 필요)`,
          addedCount: expenseRecords.length,
        });
      }
    }

    return NextResponse.json<ApplyResponse>({
      success: true,
      message: `${expenseRecords.length}건의 거래가 지출부에 반영되었습니다.`,
      addedCount: expenseRecords.length,
      deletedRecordId,
    });
  } catch (error) {
    console.error('Card expense apply error:', error);
    return NextResponse.json<ApplyResponse>(
      { success: false, error: '카드대금 반영 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
