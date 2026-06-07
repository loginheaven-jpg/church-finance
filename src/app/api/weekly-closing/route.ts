import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  getWeeklyClosings,
  getLastActiveClosing,
  addWeeklyClosing,
  getKSTDateTime,
} from '@/lib/google-sheets';

// GET: 마감 이력 + 가장 최근 활성 마감 조회 (admin 이상)
export async function GET() {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const [all, last] = await Promise.all([
      getWeeklyClosings(),
      getLastActiveClosing(),
    ]);
    return NextResponse.json({
      success: true,
      closings: all,
      lastActive: last,
    });
  } catch (e) {
    console.error('[weekly-closing GET]', e);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

// POST: 마감 확정 (super_admin)
// body: { closing_week: 'YYYY-MM-DD', closed_at: 'YYYY-MM-DD HH:mm:ss', note?: string }
// Phase 1에서는 마감 행만 추가 (거래 보정은 Phase 3에서)
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { closing_week, closed_at, note } = body;
    if (!closing_week || !closed_at) {
      return NextResponse.json({ error: 'closing_week와 closed_at 필요' }, { status: 400 });
    }
    // 형식 간단 검증 (YYYY-MM-DD, YYYY-MM-DD HH:mm:ss)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closing_week)) {
      return NextResponse.json({ error: 'closing_week 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(closed_at)) {
      return NextResponse.json({ error: 'closed_at 형식 오류 (YYYY-MM-DD HH:mm:ss)' }, { status: 400 });
    }
    // 이전 마감보다 미래여야 함 (단조 증가)
    const prev = await getLastActiveClosing();
    if (prev && prev.closed_at >= closed_at) {
      return NextResponse.json({
        error: `이전 마감(${prev.closed_at})보다 이후 시각이어야 합니다`,
      }, { status: 400 });
    }
    await addWeeklyClosing({
      closing_week,
      closed_at,
      closed_by: session.name,
      note: note || '',
    });
    return NextResponse.json({
      success: true,
      closing: { closing_week, closed_at, closed_by: session.name, note: note || '' },
      kstNow: getKSTDateTime(),
    });
  } catch (e) {
    console.error('[weekly-closing POST]', e);
    return NextResponse.json({ error: '마감 확정 실패' }, { status: 500 });
  }
}
