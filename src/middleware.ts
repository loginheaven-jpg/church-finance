import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  FinanceSession,
  SESSION_COOKIE_NAME,
  canAccessPath
} from '@/lib/auth/finance-permissions';

// 인증이 필요 없는 경로
const publicPaths = ['/login', '/register', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, API 인증 경로 등은 무시
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    publicPaths.some(path => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  // 세션 쿠키 확인
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const authToken = request.cookies.get('auth-token');

  // 인증 확인 (기존 auth-token 또는 새로운 finance-session)
  if (!authToken && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 세션이 있는 경우 역할 기반 접근 제어
  if (sessionCookie) {
    try {
      const session: FinanceSession = JSON.parse(sessionCookie.value);

      // 경로 접근 권한 확인
      if (!canAccessPath(pathname, session.finance_role)) {
        // 권한 없으면 대시보드로 리다이렉트
        const dashboardUrl = new URL('/dashboard', request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // 세션 정보를 헤더에 추가 (서버 컴포넌트에서 사용)
      const response = NextResponse.next();
      response.headers.set('x-user-id', session.user_id);
      response.headers.set('x-user-name', encodeURIComponent(session.name));
      response.headers.set('x-user-email', session.email);
      response.headers.set('x-user-role', session.finance_role);
      if (session.member_id) {
        response.headers.set('x-member-id', session.member_id);
      }
      return response;
    } catch {
      // 세션 파싱 실패 시 로그인으로
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // auth-token만 있는 경우 (기존 호환) - 기본 접근 허용
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 경로에 적용:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
