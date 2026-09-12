/**
 * 교적부(saint.yebom.org) SSO 공통 계약 — 단일 출처 (§2, §3)
 *
 * 재정부는 비밀번호를 직접 받지 않는다. 로그인·가입·통합 로그아웃은 모두 교적부로 보낸다.
 */

export const SAINT_BASE_URL = 'https://saint.yebom.org'

/** 교적부 체크인 — 200/401/그 외를 status 로만 분기할 것 (§2-2, §6-6) */
export const SAINT_CHECKIN_URL = `${SAINT_BASE_URL}/api/auth/session`

/**
 * 교적부 로그인 화면 — `?from=finance&redirect=<절대 URL>` (§2-1)
 * redirect 는 https://finance.yebom.org/... 형태여야 교적부가 허용한다.
 */
export function saintLoginUrl(redirectAbsoluteUrl: string): string {
  return `${SAINT_BASE_URL}/login?from=finance&redirect=${encodeURIComponent(redirectAbsoluteUrl)}`
}

/** 교적부 가입 화면 (§2-1, §3) */
export function saintJoinUrl(): string {
  return `${SAINT_BASE_URL}/join?from=finance`
}

/**
 * 교적부 통합 로그아웃 — 모든 SSO 쿠키 삭제 + Clear-Site-Data + yebom_reauth 표식 후 return 으로 복귀 (§2-3)
 * 명시적 로그아웃 버튼만 이 경로를 탄다. 체크인 401 은 타지 않는다(§2-4).
 */
export function saintLogoutUrl(returnAbsoluteUrl: string): string {
  return `${SAINT_BASE_URL}/api/auth/logout?return=${encodeURIComponent(returnAbsoluteUrl)}`
}

/**
 * 원격 교적부 체크인을 수행해도 되는 호스트인가 (§4-5 dev/preview 가드)
 *
 * finance.yebom.org 는 교적부와 같은 site(.yebom.org)라 SameSite=Lax 쿠키가 실려 체크인이 성립한다.
 * 반면 localhost·vercel 프리뷰(*.vercel.app)는 cross-site 라 쿠키가 아예 전송되지 않아
 * 교적부가 **항상 401** 을 준다 → 401 핸들러가 저장소 정리 + 로그아웃 + 리다이렉트를 돌려
 * 개발자가 계속 튕겨 나간다. 그래서 호스트가 *.yebom.org 일 때만 체크인한다.
 * (NODE_ENV 기준보다 호스트 기준이 안전하다 — 프리뷰 배포도 함께 걸러진다)
 */
export function canCheckIn(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('.yebom.org')
}
