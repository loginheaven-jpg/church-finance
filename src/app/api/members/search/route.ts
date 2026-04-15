import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { supabase } from '@/lib/supabase';

// GET /api/members/search?q=검색어 — 교적부 회원 이름 검색 (admin 이상만)
export async function GET(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 미설정' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, members: [] });
    }

    const { data, error } = await supabase
      .from('members')
      .select('name')
      .ilike('name', `%${q}%`)
      .limit(20);

    if (error) {
      console.error('member search error:', error);
      return NextResponse.json({ error: '검색 중 오류' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      members: (data || []).map(m => m.name).filter(Boolean),
    });
  } catch (error) {
    console.error('[members/search]', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
