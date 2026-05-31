import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { getIncomeCodes } from '@/lib/google-sheets';

// GET: 수입부 코드 매핑 (헌금함 입력 자동완성용)
export async function GET() {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const codes = await getIncomeCodes();
    const active = codes.filter(c => c.active !== false);
    return NextResponse.json({ success: true, codes: active });
  } catch (e) {
    console.error('[cash-offering/codes]', e);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
