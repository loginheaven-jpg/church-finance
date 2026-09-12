import { NextResponse } from 'next/server';
import { appendDeleteCookie, appendClearFinanceCookies } from '@/lib/auth/finance-session';

/**
 * 로컬 로그아웃 — 이 기기의 재정부 쿠키를 조용히 무효화한다.
 *
 * 쓰이는 곳 두 군데:
 *  1) 명시적 로그아웃(§2-3 3단계) — 저장소 정리 뒤, 교적부 통합 로그아웃으로 이동하기 전
 *  2) 교적부 체크인 401(§2-4) — 세션이 이미 없어졌으므로 로컬 쿠키만 정리하고 /login 으로 유도
 *
 * ⚠️ 반드시 헤더 직접 append 방식이어야 한다. response.cookies.set() 은 같은 이름을
 *    하나만 남기므로 호스트 전용 사본과 .yebom.org 사본을 동시에 지울 수 없다(§6-2).
 *    호스트 전용 사본이 남으면 다음 요청에서 그게 먼저 읽혀 로그아웃이 풀린다.
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // finance-session · 구 auth-token — 두 사본 모두 만료
  appendClearFinanceCookies(response);

  // 교적부 SSO 쿠키도 이 기기에서 만료시킨다.
  // (명시적 로그아웃은 이어서 교적부 통합 로그아웃이 다시 지우고,
  //  체크인 401 에서는 이미 죽은 쿠키가 남아 SSO 라우트를 헛돌게 하는 것을 막는다)
  appendDeleteCookie(response, 'saint_record_session');

  return response;
}
