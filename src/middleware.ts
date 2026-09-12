import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath } from '@/lib/auth/finance-permissions';
import {
  unsealFinanceSession,
  FINANCE_SESSION_COOKIE,
  LEGACY_AUTH_TOKEN_COOKIE,
  appendClearFinanceCookies,
} from '@/lib/auth/finance-session';
import { saintJoinUrl } from '@/lib/auth/saint-sso';

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

  // 자체 가입은 폐지 — 교적부 가입으로 보낸다 (§4-2)
  if (pathname === '/register') {
    return NextResponse.redirect(saintJoinUrl());
  }

  // /login 접속 시 기존 세션 쿠키 자동 정리 (깨끗한 로그인 보장)
  if (pathname === '/login') {
    const hasOldCookies =
      request.cookies.get(FINANCE_SESSION_COOKIE) || request.cookies.get(LEGACY_AUTH_TOKEN_COOKIE);
    if (hasOldCookies) {
      const response = NextResponse.next();
      // 호스트 전용 사본과 .yebom.org 사본을 모두 지운다.
      // response.cookies.set() 은 같은 이름을 하나만 남겨 한쪽이 살아남는다(§6-2).
      appendClearFinanceCookies(response);
      return response;
    }
    return NextResponse.next();
  }

  // 세션 쿠키 확인
  // ⚠️ 구 auth-token 은 값이 서명 없는 정적 문자열('authenticated')이라 누구나 위조할 수 있다.
  //    더 이상 인증 근거로 읽지 않는다(§4-1). 만료 처리만 /login·로그아웃에 남아 있다.
  const sessionCookie = request.cookies.get(FINANCE_SESSION_COOKIE);
  const saintRecordCookie = request.cookies.get(SAINT_RECORD_COOKIE_NAME);

  // 재정부 세션 없지만 교적부 세션 있으면 SSO 처리
  if (!sessionCookie && saintRecordCookie) {
    const ssoUrl = new URL('/api/auth/sso', request.url);
    ssoUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(ssoUrl);
  }

  // 인증 확인 — finance-session 만 신뢰한다
  if (!sessionCookie) {
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

  // 도달 불가(위 if (sessionCookie) 블록이 항상 return 한다).
  // 방어적으로 로그인 리다이렉트 — 권한 확인 없는 통과는 절대 두지 않는다(§4-1).
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
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
