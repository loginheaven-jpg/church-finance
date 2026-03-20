import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { unmarkExpenseClaimsProcessed } from '@/lib/google-sheets';

// POST: 입금완료 취소 (K컬럼 초기화)
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session?.name) {
      return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    }
    if (!hasRole(session.finance_role, 'admin')) {
      return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });
    }

    const { rowIndices } = await request.json();
    if (!Array.isArray(rowIndices) || rowIndices.length === 0) {
      return NextResponse.json({ success: false, error: '행 번호가 필요합니다' }, { status: 400 });
    }

    await unmarkExpenseClaimsProcessed(rowIndices);

    return NextResponse.json({
      success: true,
      message: `${rowIndices.length}건 입금완료 취소됨`,
    });
  } catch (error) {
    console.error('입금완료 취소 오류:', error);
    return NextResponse.json(
      { success: false, error: '입금완료 취소 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
