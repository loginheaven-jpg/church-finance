import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'expense-receipts';

/**
 * 클라이언트 직접 업로드용 signed URL 발급
 * POST { fileName, contentType }
 * → { success, uploadUrl, filePath }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage가 설정되지 않았습니다' }, { status: 500 });
    }

    const { fileName, contentType } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: '파일명이 필요합니다' }, { status: 400 });
    }

    // 파일 경로 생성: user_id/year/claim_timestamp_random.ext
    const year = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 4);
    const ext = fileName.split('.').pop() || 'jpg';
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `${session.user_id}/${year}/receipt_${uniqueId}.${ext}`;

    // Signed upload URL 생성 (5분 유효)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('Signed upload URL error:', error);
      return NextResponse.json({ error: 'Upload URL 생성 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      uploadUrl: data.signedUrl,
      token: data.token,
      filePath,
    });
  } catch (error) {
    console.error('Upload URL API error:', error);
    return NextResponse.json(
      { error: 'Upload URL 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
