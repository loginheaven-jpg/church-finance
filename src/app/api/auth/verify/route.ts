import { NextResponse } from 'next/server';

/**
 * 재정부 자체 비밀번호 로그인 — 폐기됨 (410 Gone)
 *
 * 비밀번호 입력은 오직 교적부(saint.yebom.org)에서만 이뤄진다(§2-1).
 * 재정부 세션은 `/api/auth/sso` 가 교적부 세션을 읽어 발급하는 경로 하나만 남는다.
 *
 * 이전 구현은 bcrypt 로 이메일·비밀번호를 직접 검증하고 finance-session 과
 * 서명 없는 정적 쿠키 `auth-token='authenticated'` 를 함께 발급했다. 그 정적 토큰은
 * 위조가 가능했고 미들웨어가 그것만으로 통과시켰으므로(§4-1) 설정·수용 양쪽을 모두 제거했다.
 *
 * 로그아웃(구 DELETE 핸들러)은 `/api/auth/logout` 으로 이전했다(§4-3, §9-1).
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: '재정부 자체 로그인은 폐지되었습니다. 예봄성도 로그인을 이용해 주세요.' },
    { status: 410 }
  );
}
