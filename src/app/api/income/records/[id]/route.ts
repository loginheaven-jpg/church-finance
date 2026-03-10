import { NextRequest, NextResponse } from 'next/server';
import { updateIncomeRecord, deleteIncomeRecord } from '@/lib/google-sheets';
import { invalidateYearCache } from '@/lib/redis';
import { getServerSession, hasRole } from '@/lib/auth/finance-permissions';

// PUT: 수입부 레코드 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.date !== undefined) updates.date = body.date;
    if (body.source !== undefined) updates.source = body.source;
    if (body.offering_code !== undefined) updates.offering_code = body.offering_code;
    if (body.donor_name !== undefined) updates.donor_name = body.donor_name;
    if (body.representative !== undefined) updates.representative = body.representative;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.note !== undefined) updates.note = body.note;
    if (body.transaction_date !== undefined) updates.transaction_date = body.transaction_date;

    await updateIncomeRecord(id, updates);

    // 캐시 무효화
    const year = new Date().getFullYear();
    await invalidateYearCache(year);

    return NextResponse.json({
      success: true,
      message: '수입 레코드가 수정되었습니다',
    });
  } catch (error) {
    console.error('Income record update error:', error);
    const message = error instanceof Error ? error.message : '수입 레코드 수정 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE: 수입부 레코드 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id } = await params;
    await deleteIncomeRecord(id);

    // 캐시 무효화
    const year = new Date().getFullYear();
    await invalidateYearCache(year);

    return NextResponse.json({
      success: true,
      message: '수입 레코드가 삭제되었습니다',
    });
  } catch (error) {
    console.error('Income record delete error:', error);
    const message = error instanceof Error ? error.message : '수입 레코드 삭제 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
