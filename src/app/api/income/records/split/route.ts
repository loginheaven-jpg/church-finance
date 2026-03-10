import { NextRequest, NextResponse } from 'next/server';
import { splitIncomeRecord, getIncomeRecords } from '@/lib/google-sheets';
import { invalidateYearCache } from '@/lib/redis';
import { getServerSession, hasRole } from '@/lib/auth/finance-permissions';

// POST: 수입부 레코드 분할
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { originalId, newRecords } = await request.json();

    if (!originalId || !Array.isArray(newRecords) || newRecords.length < 2) {
      return NextResponse.json(
        { success: false, error: '원본 ID와 최소 2개의 분할 레코드가 필요합니다' },
        { status: 400 }
      );
    }

    // 원본 레코드 찾기 (금액 검증용)
    const allRecords = await getIncomeRecords();
    const original = allRecords.find(r => r.id === originalId);

    if (!original) {
      return NextResponse.json(
        { success: false, error: '원본 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 합계 검증
    const splitTotal = newRecords.reduce((sum: number, r: { amount: number }) => sum + (r.amount || 0), 0);
    if (splitTotal !== original.amount) {
      return NextResponse.json(
        { success: false, error: `분할 합계(${splitTotal.toLocaleString()}원)가 원본 금액(${original.amount.toLocaleString()}원)과 일치하지 않습니다` },
        { status: 400 }
      );
    }

    // 분할 실행
    await splitIncomeRecord(originalId, newRecords.map((r: {
      date?: string;
      source?: string;
      offering_code: number;
      donor_name: string;
      representative?: string;
      amount: number;
      note?: string;
      input_method?: string;
      transaction_date?: string;
      created_by?: string;
    }) => ({
      date: r.date || original.date,
      source: r.source || original.source,
      offering_code: r.offering_code,
      donor_name: r.donor_name || original.donor_name,
      representative: r.representative || original.representative,
      amount: r.amount,
      note: r.note || '',
      input_method: r.input_method || original.input_method,
      transaction_date: r.transaction_date || original.transaction_date || '',
      created_by: session.name || '',
    })));

    // 캐시 무효화
    const year = new Date().getFullYear();
    await invalidateYearCache(year);

    return NextResponse.json({
      success: true,
      message: `${newRecords.length}건으로 분할 완료`,
      splitCount: newRecords.length,
    });
  } catch (error) {
    console.error('Income record split error:', error);
    const message = error instanceof Error ? error.message : '수입 레코드 분할 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
