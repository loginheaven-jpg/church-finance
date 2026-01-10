import { NextRequest, NextResponse } from 'next/server';

const TEMP_PASSWORD = '860316!';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === TEMP_PASSWORD) {
      const response = NextResponse.json({ success: true });

      // 인증 쿠키 설정 (7일 유효)
      response.cookies.set('auth-token', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: '암호가 일치하지 않습니다' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { success: false, error: '인증 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 로그아웃
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
