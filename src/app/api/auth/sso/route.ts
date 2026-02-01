import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import {
  FinanceSession,
  FinanceRole,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from '@/lib/auth/finance-permissions';

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

    // 리다이렉트 URL 결정
    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    const redirectUrl = new URL(redirect, request.url);

    // 응답 생성 및 세션 쿠키 설정
    const response = NextResponse.redirect(redirectUrl);

    // finance-session 쿠키 설정 (JSON 형식)
    response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(financeSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
      domain: COOKIE_DOMAIN,
    });

    return response;
  } catch (error) {
    console.error('SSO error:', error);
    // 오류 발생 시 로그인 페이지로
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}
