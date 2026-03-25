import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath } from '@/lib/auth/finance-permissions';
import { unsealFinanceSession, FINANCE_SESSION_COOKIE, financeSessionOptions } from '@/lib/auth/finance-session';

// 인증이 필요 없는 경로
const publicPaths = ['/login', '/register', '/api/auth'];

// 교적부 세션 쿠키 이름 (SSO 연동용)
const SAINT_RECORD_COOKIE_NAME = 'saint_record_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, API 인증 경로 등은 무시
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // /login 접속 시 기존 세션 쿠키 자동 정리 (깨끗한 로그인 보장)
  if (pathname === '/login' || pathname === '/register') {
    const hasOldCookies = request.cookies.get(FINANCE_SESSION_COOKIE) || request.cookies.get('auth-token');
    if (hasOldCookies) {
      const response = NextResponse.next();
      const cookieOpts = financeSessionOptions.cookieOptions!;
      response.cookies.set(FINANCE_SESSION_COOKIE, '', { ...cookieOpts, maxAge: 0 });
      response.cookies.set('auth-token', '', { ...cookieOpts, maxAge: 0 });
      return response;
    }
    return NextResponse.next();
  }

  // 세션 쿠키 확인
  const sessionCookie = request.cookies.get(FINANCE_SESSION_COOKIE);
  const authToken = request.cookies.get('auth-token');
  const saintRecordCookie = request.cookies.get(SAINT_RECORD_COOKIE_NAME);

  // 재정부 세션 없지만 교적부 세션 있으면 SSO 처리
  if (!sessionCookie && saintRecordCookie) {
    const ssoUrl = new URL('/api/auth/sso', request.url);
    ssoUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(ssoUrl);
  }

  // 인증 확인 (기존 auth-token 또는 새로운 finance-session)
  if (!authToken && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 세션이 있는 경우 역할 기반 접근 제어
  if (sessionCookie) {
    try {
      const session = await unsealFinanceSession(sessionCookie.value);

      if (!session) {
        // 복호화 실패 시 로그인으로
        const loginUrl = new URL('/login', request.url);
        if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

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
      // 세션 복호화 실패 시 로그인으로
      const loginUrl = new URL('/login', request.url);
      if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname);
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
