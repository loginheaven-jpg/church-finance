import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { FINANCE_CONFIG } from '@/lib/google-sheets';

// GET: 재정관리 구글시트 URL 반환 (super_admin 전용)
// 클라이언트가 새 탭으로 열 때 사용.
export async function GET() {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }

  const spreadsheetId = FINANCE_CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'FINANCE_SHEET_ID 환경변수 미설정' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  });
}
