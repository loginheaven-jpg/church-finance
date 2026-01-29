import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  addExpenseRecords,
  deleteExpenseRecord,
  generateId,
  getKSTDateTime,
  getCardExpenseTemp,
  updateCardExpenseTempStatus,
} from '@/lib/google-sheets';
import {
  FinanceSession,
  SESSION_COOKIE_NAME,
  hasRole,
} from '@/lib/auth/finance-permissions';
import type { ExpenseRecord } from '@/types';

interface ApplyResponse {
  success: boolean;
  message?: string;
  addedCount?: number;
  deletedRecordId?: string;
  error?: string;
}

// 현재 세션 가져오기 헬퍼
async function getSession(): Promise<FinanceSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) return null;
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    // 권한 확인 (admin 이상만)
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ApplyResponse>(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    if (!hasRole(session.finance_role, 'admin')) {
      return NextResponse.json<ApplyResponse>(
        { success: false, error: '관리자 이상의 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 임시 시트에서 pending 상태 데이터 조회
    const tempRecords = await getCardExpenseTemp();
    const pendingRecords = tempRecords.filter((r) => r.status === 'pending');

    if (pendingRecords.length === 0) {
      return NextResponse.json<ApplyResponse>(
        { success: false, error: '반영할 거래 내역이 없습니다' },
        { status: 400 }
      );
    }

    // 모든 거래에 description과 account_code가 있는지 확인
    const incompleteItems = pendingRecords.filter(
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

    // 매칭된 NH카드대금 정보 (첫 번째 레코드에서)
    const nhCardRecordId = pendingRecords[0].matching_record_id;
    const matchingDate = pendingRecords[0].matching_record_date;

    // CardExpenseTempRecord -> ExpenseRecord 변환
    const createdAt = getKSTDateTime();
    const expenseRecords: ExpenseRecord[] = pendingRecords.map((tx) => ({
      id: generateId('EXP'),
      date: matchingDate || tx.transaction_date, // 매칭된 날짜 또는 거래일
      payment_method: '법인카드',
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

    // 2. 기존 NH카드대금 행 삭제 (ID가 있는 경우)
    let deletedRecordId: string | undefined;
    if (nhCardRecordId) {
      try {
        await deleteExpenseRecord(nhCardRecordId);
        deletedRecordId = nhCardRecordId;
      } catch (deleteError) {
        console.error('Failed to delete NH카드대금 record:', deleteError);
        // 삭제 실패해도 추가는 성공했으므로 계속 진행
      }
    }

    // 3. 임시 데이터 상태를 'applied'로 변경
    const tempIds = pendingRecords.map((r) => r.tempId);
    try {
      await updateCardExpenseTempStatus(tempIds, 'applied');
    } catch (statusError) {
      console.error('Failed to update temp status:', statusError);
      // 상태 업데이트 실패해도 반영은 완료됨
    }

    const message = deletedRecordId
      ? `${expenseRecords.length}건의 거래가 지출부에 반영되었습니다.`
      : `${expenseRecords.length}건의 거래가 추가되었습니다. (주의: NH카드대금 행 삭제 실패 - 수동 확인 필요)`;

    return NextResponse.json<ApplyResponse>({
      success: true,
      message,
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
