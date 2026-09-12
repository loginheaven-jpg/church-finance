import { NextResponse } from 'next/server';
import { getExpenseCodes } from '@/lib/google-sheets';
import { requireSession } from '@/lib/auth/require-session';

export async function GET() {
  try {
    // 전역 재정코드 조회(FinanceCodeFab 등, 모든 로그인 사용자) → 로그인만 요구
    const guard = await requireSession();
    if (guard.response) return guard.response;

    const codes = await getExpenseCodes();

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error('Get expense codes error:', error);
    return NextResponse.json(
      { success: false, error: '지출부 코드 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
