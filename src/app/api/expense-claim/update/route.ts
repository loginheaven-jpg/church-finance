import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { updateExpenseClaim } from '@/lib/google-sheets';

// PUT: 지출청구 수정 (admin 전용)
export async function PUT(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session?.name) {
      return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    }
    if (!hasRole(session.finance_role, 'admin')) {
      return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });
    }

    const { rowIndex, ...updates } = await request.json();
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ success: false, error: '행 번호가 필요합니다' }, { status: 400 });
    }

    await updateExpenseClaim(rowIndex, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('청구 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '청구 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
