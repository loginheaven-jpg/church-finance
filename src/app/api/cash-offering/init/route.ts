import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { initCashOfferingEntrySheet } from '@/lib/google-sheets';

// POST: 헌금함입력 시트 초기화 (없으면 생성 + 헤더 설정)
export async function POST() {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }
  try {
    await initCashOfferingEntrySheet();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[cash-offering/init]', e);
    return NextResponse.json({ error: '초기화 실패' }, { status: 500 });
  }
}
