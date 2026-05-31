import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { supabase } from '@/lib/supabase';

// GET ?q=두글자이상 : 헌금자 자동완성 (교적부)
export async function GET(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  if (!supabase) return NextResponse.json({ donors: [] });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ donors: [] });

  try {
    const { data, error } = await supabase
      .from('members')
      .select('name')
      .ilike('name', `%${q}%`)
      .limit(20);
    if (error) {
      console.error('donor search:', error);
      return NextResponse.json({ donors: [] });
    }
    return NextResponse.json({
      donors: (data || []).map(m => m.name).filter(Boolean),
    });
  } catch (e) {
    console.error('[cash-offering/donors-search]', e);
    return NextResponse.json({ donors: [] });
  }
}
