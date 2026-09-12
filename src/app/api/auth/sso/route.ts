import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import {
  FinanceSession,
  FinanceRole,
  hasRole,
} from '@/lib/auth/finance-permissions';
import { appendFinanceSessionCookie, ADMIN_SESSION_TTL } from '@/lib/auth/finance-session';

// 교적부 세션 타입 정의
interface SaintRecordSession {
  user_id: string;
  name: string;
  email: string;
  permission_level: string;
  is_approved: boolean;
  member_id: string | null;
  group_id: string | null;
  group_role: string | null;
  needs_profile_completion?: boolean;
  finance_role?: FinanceRole;
  isLoggedIn: boolean;
  // 로그인 유지 여부 — 교적부가 봉인에 항상 포함한다(교적부 session.ts:112-113).
  // 아주 오래된 레거시 쿠키만 방어적으로 "유지"로 간주한다(!== false).
  persistent?: boolean;
}

/**
 * redirect 파라미터는 반드시 자기 사이트의 상대 경로여야 한다.
 * (`//evil.com` 이나 절대 URL 을 그대로 new URL() 에 넘기면 외부로 튕기는 오픈 리다이렉트가 된다)
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

// SSO를 위한 쿠키 도메인 (프로덕션: .yebom.org)
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.yebom.org' : undefined;

// 교적부 세션 쿠키 설정 (동일한 SECRET 사용)
const saintRecordSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_change_this_in_production',
  cookieName: 'saint_record_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: COOKIE_DOMAIN,
  },
};

/**
 * SSO 처리 API
 * 교적부 세션(iron-session 암호화)을 읽어서 재정부 세션(JSON)을 생성
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // iron-session을 사용하여 교적부 세션 복호화
    const saintSession = await getIronSession<SaintRecordSession>(
      cookieStore,
      saintRecordSessionOptions
    );

    // 교적부 세션이 유효하지 않으면 로그인 페이지로
    if (!saintSession.isLoggedIn || !saintSession.user_id) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // 재정부 세션 생성
    const financeSession: FinanceSession = {
      user_id: saintSession.user_id,
      name: saintSession.name,
      email: saintSession.email,
      member_id: saintSession.member_id,
      finance_role: saintSession.finance_role || 'member',
    };

    // 리다이렉트 URL 결정 (자기 사이트 상대 경로만 허용)
    const redirect = safeRedirectPath(request.nextUrl.searchParams.get('redirect'));
    const redirectUrl = new URL(redirect, request.url);

    // 응답 생성 및 세션 쿠키 설정
    const response = NextResponse.redirect(redirectUrl);

    // ★ finance-session 발급 — 교적부의 "로그인 유지"를 존중한다.
    //   봉인 ttl 을 여기서 반드시 넘겨야 한다. 빠뜨리면 iron-session 기본값 14일이
    //   봉인에 baked 되어 400일 쿠키를 줘도 14일에 세션이 죽는다(§4-4).
    const persistent = saintSession.persistent !== false;
    // §4-8: admin 이상은 로그인 유지여도 24h 상한. non-persistent(12h)는 더 짧으므로 그대로 둔다.
    const ttlOverride =
      persistent && hasRole(financeSession.finance_role, 'admin') ? ADMIN_SESSION_TTL : undefined;
    await appendFinanceSessionCookie(response, financeSession, persistent, ttlOverride);

    return response;
  } catch (error) {
    console.error('SSO error:', error);
    // 오류 발생 시 로그인 페이지로
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}
