import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { cancelLastActiveClosing } from '@/lib/google-sheets';

// DELETE: 직전 활성 마감 취소 (super_admin)
// Phase 1에서는 마감 행만 cancelled로 표시. 거래 보정 원복은 Phase 3에서.
export async function DELETE() {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }
  try {
    const cancelled = await cancelLastActiveClosing(session.name);
    if (!cancelled) {
      return NextResponse.json({ error: '취소할 활성 마감이 없습니다' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      cancelled,
      message: `마감 ${cancelled.closing_week} 취소 완료`,
    });
  } catch (e) {
    console.error('[weekly-closing/last DELETE]', e);
    return NextResponse.json({ error: '마감 취소 실패' }, { status: 500 });
  }
}
