import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'expense-receipts';

export async function GET(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: '파일 경로가 필요합니다' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage가 설정되지 않았습니다' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: '영수증 URL 생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: data.signedUrl });
  } catch (error) {
    console.error('Receipt signed URL error:', error);
    return NextResponse.json(
      { error: '영수증 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
