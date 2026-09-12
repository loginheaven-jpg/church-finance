/**
 * API 라우트 인가 가드 — 단일 진입점 (§4-7)
 *
 * 미들웨어 matcher 가 `/api` 를 제외하므로(middleware.ts:123) API 라우트는
 * 각자 세션을 확인해야만 보호된다. 미들웨어가 심는 `x-user-*` 헤더는
 * `/api` 요청에는 설정되지 않으므로 인가 근거로 절대 쓰면 안 된다.
 *
 * 세션 읽기 구현은 `getFinanceSession()` 하나뿐이다.
 * (`finance-permissions.ts` 의 `getServerSession` 은 같은 함수의 재-export 별칭이다.)
 * 새 코드는 이 모듈의 requireSession/requireRole 만 쓴다.
 *
 * 사용법:
 *   const guard = await requireRole('admin');
 *   if ('response' in guard) return guard.response;
 *   const { session } = guard;
 */
import { NextResponse } from 'next/server';
import { getFinanceSession } from './finance-session';
import { hasRole, ROLE_LABELS, type FinanceRole, type FinanceSession } from './finance-permissions';
import { supabaseAdmin } from '@/lib/supabase';

export type SessionGuard =
  | { session: FinanceSession; response?: undefined }
  | { session?: undefined; response: NextResponse };

/** 로그인만 요구한다. 미인증이면 401 JSON. */
export async function requireSession(): Promise<SessionGuard> {
  const session = await getFinanceSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      ),
    };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// §4-8: admin 이상 라우트에서 Supabase users 를 직접 재조회해 강등·승인취소를 즉시 반영.
//   finance-session 의 baked role 은 최대 24h stale 이므로(§4-8 admin 단기세션),
//   민감 작업은 DB 최신값으로 한 번 더 확인한다. DB 가 진실의 원천 → 클라이언트 우회 불가.
//   읽기 핫패스(requireSession·deacon 열람)는 재조회하지 않는다 — admin 이상에만 적용.
//   성능: user_id 당 60초 인메모리 캐시(서버리스 인스턴스별). Supabase 미설정 시 세션값 신뢰.
// ─────────────────────────────────────────────────────────────
const REVALIDATE_TTL_MS = 60_000;
type FreshAuth = { finance_role: FinanceRole | null; is_approved: boolean };
const revalidateCache = new Map<string, { at: number; value: FreshAuth }>();

async function fetchFreshAuth(userId: string): Promise<FreshAuth | null> {
  const cached = revalidateCache.get(userId);
  if (cached && Date.now() - cached.at < REVALIDATE_TTL_MS) return cached.value;
  if (!supabaseAdmin) return null; // DB 미설정(로컬 등) → 세션값을 신뢰

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('finance_role, is_approved')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null; // 조회 실패 시 세션값 신뢰(가용성 우선, 오탐 로그아웃 방지)

  const value: FreshAuth = {
    finance_role: (data.finance_role as FinanceRole) ?? null,
    is_approved: data.is_approved !== false,
  };
  revalidateCache.set(userId, { at: Date.now(), value });
  return value;
}

/**
 * 최소 역할을 요구한다. 미인증이면 401, 권한 부족이면 403 JSON.
 * minRole 이 admin 이상이면 Supabase users 를 재조회해 DB 최신 역할·승인여부로 판정한다(§4-8).
 */
export async function requireRole(minRole: FinanceRole): Promise<SessionGuard> {
  const guard = await requireSession();
  if (guard.response) return guard;

  let effectiveRole = guard.session.finance_role;

  // admin 이상 요구 시에만 DB 재검증(읽기 핫패스 제외)
  if (hasRole(minRole, 'admin')) {
    const fresh = await fetchFreshAuth(guard.session.user_id);
    if (fresh) {
      if (!fresh.is_approved) {
        return {
          response: NextResponse.json(
            { success: false, error: '계정 승인이 취소되었습니다. 관리자에게 문의하세요.' },
            { status: 403 }
          ),
        };
      }
      // DB 값이 있으면 그것으로 판정(강등 즉시 반영). 없으면 세션값 유지.
      if (fresh.finance_role) effectiveRole = fresh.finance_role;
    }
  }

  if (!hasRole(effectiveRole, minRole)) {
    return {
      response: NextResponse.json(
        { success: false, error: `${ROLE_LABELS[minRole]} 이상의 권한이 필요합니다` },
        { status: 403 }
      ),
    };
  }
  return { session: { ...guard.session, finance_role: effectiveRole } };
}
