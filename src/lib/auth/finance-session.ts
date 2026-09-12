/**
 * 재정부 세션 관리 (iron-session 기반)
 *
 * 기존 JSON 평문 쿠키 → iron-session 암호화로 전환
 * SESSION_SECRET은 교적부/기도의 집과 동일
 */
import { getIronSession, sealData, unsealData, type SessionOptions } from 'iron-session'
import type { NextResponse } from 'next/server'
import type { FinanceSession } from './finance-permissions'

export const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.yebom.org' : undefined

export const FINANCE_SESSION_COOKIE = 'finance-session'

// 재정부 구 인증 쿠키 — 더 이상 인증 근거로 쓰지 않고, 로그아웃 시 만료만 시킨다
export const LEGACY_AUTH_TOKEN_COOKIE = 'auth-token'

// 로그인 유지(기본): 크롬의 쿠키 수명 상한인 400일. 교적부와 동일 값.
export const PERSISTENT_SESSION_TTL = 60 * 60 * 24 * 400
// 로그인 유지 해제(공용 PC): 브라우저 세션 쿠키 + 봉인 12시간.
export const NON_PERSISTENT_SESSION_TTL = 60 * 60 * 12
// admin 이상: 로그인 유지여도 24시간 상한(§4-8). 강등된 관리자의 elevated 접근 창을 좁힌다.
// 만료 시 미들웨어 SSO 재-민트가 최신 역할을 반영 → 페이지 레벨 stale ≤ 24h.
export const ADMIN_SESSION_TTL = 60 * 60 * 24

export const financeSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: FINANCE_SESSION_COOKIE,
  // 읽기 측 ttl — iron-session v8에서 만료 판정에 쓰이지 않지만(no-op) 교적부와 형태를 맞춘다.
  // 실제 수명은 sealFinanceSession()의 ttl(봉인에 baked) + 쿠키 Max-Age 로만 구속된다.
  ttl: PERSISTENT_SESSION_TTL,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    // 이 옵션은 읽기(getFinanceSession)와 삭제에만 쓰인다. 쿠키 발급은
    // appendFinanceSessionCookie()가 persistent 여부에 따라 직접 헤더로 내보낸다.
    maxAge: PERSISTENT_SESSION_TTL,
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
 * 세션 데이터를 봉인한다.
 *
 * ⚠️ ttlSeconds 는 필수다. iron-session v8은 seal 시 ttl 을 생략하면 봉인에 기본 14일을
 *    baked 하므로(실측 확인: iron-session/dist/index.js:58, `ttl * 1e3` → 단위는 **초**),
 *    ttl 을 빠뜨리면 400일 쿠키를 발급해도 14일에 세션이 죽는다.
 *    읽기(unseal) 측 ttl 로는 이 만료를 늘리거나 줄일 수 없다(no-op).
 */
export async function sealFinanceSession(data: FinanceSession, ttlSeconds: number): Promise<string> {
  return sealData(data, { password: process.env.SESSION_SECRET!, ttl: ttlSeconds })
}

// ─────────────────────────────────────────────────────────────
// 쿠키 헤더 직접 작성 (교적부 src/lib/auth/session.ts:87-104 복사 이식)
// ⚠️ Next의 response.cookies.set()은 호출할 때마다 set-cookie 헤더 전체를 지우고 다시 쓰며
//    같은 이름은 하나만 남긴다. 아래 헬퍼는 헤더를 직접 덧붙이므로, 한 응답에서
//    response.cookies.set()을 함께 쓴다면 반드시 그보다 "뒤에" 호출해야 한다.
// ─────────────────────────────────────────────────────────────

function serializeCookie(name: string, value: string, opts: { maxAge?: number; domain?: string } = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.maxAge !== undefined) {
    parts.push(`Max-Age=${opts.maxAge}`)
    if (opts.maxAge === 0) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  }
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

/** 쿠키 하나를 이 기기에서 삭제 — 호스트 전용 사본과 도메인 사본 모두 */
export function appendDeleteCookie(response: NextResponse, name: string) {
  response.headers.append('set-cookie', serializeCookie(name, '', { maxAge: 0 }))
  if (COOKIE_DOMAIN) {
    response.headers.append('set-cookie', serializeCookie(name, '', { maxAge: 0, domain: COOKIE_DOMAIN }))
  }
}

/** 재정부 자체 쿠키(finance-session·구 auth-token)를 두 사본 모두 만료 */
export function appendClearFinanceCookies(response: NextResponse) {
  appendDeleteCookie(response, FINANCE_SESSION_COOKIE)
  appendDeleteCookie(response, LEGACY_AUTH_TOKEN_COOKIE)
}

/**
 * finance-session 쿠키 발급 (교적부 appendSessionCookie: session.ts:111-126 미러)
 * - persistent: 400일 봉인 + 400일 쿠키
 * - 비-persistent(공용PC): 12시간 봉인 + 브라우저 세션 쿠키(Max-Age 키 자체를 뺀다)
 */
export async function appendFinanceSessionCookie(
  response: NextResponse,
  data: FinanceSession,
  persistent: boolean,
  ttlSecondsOverride?: number
) {
  const ttl = ttlSecondsOverride ?? (persistent ? PERSISTENT_SESSION_TTL : NON_PERSISTENT_SESSION_TTL)
  const sealed = await sealFinanceSession(data, ttl)
  // 도메인 쿠키로 발급할 때, 예전에 남은 호스트 전용 사본이 먼저 읽히지 않도록 지운다
  if (COOKIE_DOMAIN) {
    response.headers.append('set-cookie', serializeCookie(FINANCE_SESSION_COOKIE, '', { maxAge: 0 }))
  }
  response.headers.append('set-cookie', serializeCookie(FINANCE_SESSION_COOKIE, sealed, {
    domain: COOKIE_DOMAIN,
    ...(persistent ? { maxAge: ttl } : {}),
  }))
}

/**
 * 미들웨어(Edge Runtime)에서 세션 복호화
 *
 * ⚠️ iron-session v8의 unsealData 는 만료·위조("Expired seal"/"Bad hmac value") 시
 *    예외를 던지지 않고 빈 객체 {} 를 반환한다(iron-session/dist/index.js:91-98).
 *    따라서 반드시 아래처럼 user_id 유무로 판정해야 하며 try/catch 에 의존하면 안 된다.
 *    (만료 판정에는 60초의 clock skew 관용이 있다 — iron-webcrypto timestampSkewSec)
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
