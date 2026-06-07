import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  initWeeklyClosingSheet,
  addWeeklyClosing,
  getWeeklyClosings,
} from '@/lib/google-sheets';

// POST: 초기 시작점 설정 (super_admin)
// body: { closing_week: 'YYYY-MM-DD', closed_at: 'YYYY-MM-DD HH:mm:ss' }
// 이전 마감이 전혀 없을 때 1회만 호출. 시트도 자동 생성.
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { closing_week, closed_at } = body;
    if (!closing_week || !closed_at) {
      return NextResponse.json({ error: 'closing_week와 closed_at 필요' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closing_week)) {
      return NextResponse.json({ error: 'closing_week 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(closed_at)) {
      return NextResponse.json({ error: 'closed_at 형식 오류 (YYYY-MM-DD HH:mm:ss)' }, { status: 400 });
    }

    // 시트 보장
    await initWeeklyClosingSheet();

    // 이미 행이 있으면 거부 (혼란 방지)
    const existing = await getWeeklyClosings();
    if (existing.length > 0) {
      return NextResponse.json({
        error: '이미 마감 이력이 존재합니다. 초기 시작점은 1회만 설정 가능합니다.',
        existing: existing.length,
      }, { status: 409 });
    }

    await addWeeklyClosing({
      closing_week,
      closed_at,
      closed_by: session.name,
      note: '초기 시작점',
    });

    return NextResponse.json({
      success: true,
      message: '초기 시작점이 설정되었습니다',
    });
  } catch (e) {
    console.error('[weekly-closing/init POST]', e);
    return NextResponse.json({ error: '초기 시작점 설정 실패' }, { status: 500 });
  }
}
