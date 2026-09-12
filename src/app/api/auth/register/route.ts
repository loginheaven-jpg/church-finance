import { NextResponse } from 'next/server';

/**
 * 재정부 자체 가입 — 폐기됨 (410 Gone)
 *
 * 가입은 교적부에서만 이뤄진다: https://saint.yebom.org/join?from=finance (§2-1, §3).
 * 이전 구현은 bcrypt 로 비밀번호를 해싱해 공유 Supabase `users` 에 직접 insert 했다.
 * 재정부 `/register` 페이지도 미들웨어에서 교적부 가입으로 리다이렉트된다(§4-2).
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: '재정부 자체 가입은 폐지되었습니다. 예봄서비스 가입을 이용해 주세요.' },
    { status: 410 }
  );
}
