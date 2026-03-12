/**
 * 재정부 세션 관리 (iron-session 기반)
 *
 * 기존 JSON 평문 쿠키 → iron-session 암호화로 전환
 * SESSION_SECRET은 교적부/기도의 집과 동일
 */
import { getIronSession, sealData, unsealData, type SessionOptions } from 'iron-session'
import type { FinanceSession } from './finance-permissions'

const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.yebom.org' : undefined

export const FINANCE_SESSION_COOKIE = 'finance-session'

export const financeSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: FINANCE_SESSION_COOKIE,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
    domain: COOKIE_DOMAIN,
  },
}

/**
 * API Route에서 iron-session 세션 가져오기 (Node.js Runtime)
 */
export async function getFinanceSession(): Promise<FinanceSession | null> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const session = await getIronSession<FinanceSession & { isLoggedIn?: boolean }>(
      cookieStore,
      financeSessionOptions
    )
    if (!session.user_id) return null
    return {
      user_id: session.user_id,
      name: session.name,
      email: session.email,
      member_id: session.member_id,
      finance_role: session.finance_role,
    }
  } catch {
    return null
  }
}

/**
 * iron-session 세션을 Response 쿠키에 직접 설정 (SSO/로그인용)
 * NextResponse에 Set-Cookie 헤더를 추가
 */
export async function sealFinanceSession(data: FinanceSession): Promise<string> {
  return sealData(data, { password: process.env.SESSION_SECRET! })
}

/**
 * 미들웨어(Edge Runtime)에서 세션 복호화
 */
export async function unsealFinanceSession(cookieValue: string): Promise<FinanceSession | null> {
  try {
    const data = await unsealData<FinanceSession>(cookieValue, {
      password: process.env.SESSION_SECRET!,
    })
    if (!data.user_id) return null
    return data
  } catch {
    return null
  }
}
