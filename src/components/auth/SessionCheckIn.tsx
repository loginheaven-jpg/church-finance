'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clearDeviceData } from '@/lib/auth/clear-device';
import { SAINT_CHECKIN_URL, canCheckIn } from '@/lib/auth/saint-sso';
import type { FinanceRole } from '@/lib/auth/finance-permissions';

/** 재-민트 루프 가드 — 탭 세션당 1회만 허용 (§4-6). ref/모듈 변수는 페이지 이동으로 초기화되므로 쓰지 않는다. */
const REMINT_MARKER = 'finance_remint_done';

/** 포커스가 자주 오갈 때 교적부를 두드리지 않도록 하는 최소 간격 */
const MIN_CHECKIN_INTERVAL_MS = 30_000;

export interface CheckInUser {
  finance_role?: FinanceRole;
  name?: string;
}

interface SessionCheckInProps {
  /** 체크인 200 응답의 user — 화면 권한의 기준값으로 쓴다(로컬 저장 권한을 신뢰하지 않음) */
  onCheckIn?: (user: CheckInUser) => void;
}

/**
 * 교적부 체크인 (§2-2, §4-5, §4-6)
 *
 * 앱을 열 때와 탭 포커스 복귀 시 교적부에 현재 세션을 확인한다.
 *
 * ⚠️ 반드시 res.status 로만 분기한다. 교적부 /api/auth/session 은 DB 오류 시
 *    **HTTP 500 에도 body 가 { isLoggedIn:false }** 로 나간다(교적부 session/route.ts:77-80).
 *    body.isLoggedIn 을 읽어 분기하면 일시 오류·네트워크 장애에 사용자를 잘못 로그아웃시킨다(§6-6).
 */
export function SessionCheckIn({ onCheckIn }: SessionCheckInProps) {
  const pathname = usePathname();
  const lastRunRef = useRef(0);
  const runningRef = useRef(false);

  const runCheckIn = useCallback(async () => {
    // 로컬·프리뷰는 교적부와 cross-site 라 쿠키가 안 실려 항상 401 → 개발자가 계속 튕긴다(§4-5)
    if (!canCheckIn()) return;
    // 로그인 진행 중 무한 루프 방지 — 로그인/가입 경로에서는 리다이렉트·재-민트를 돌리지 않는다
    if (pathname === '/login' || pathname === '/register') return;

    if (runningRef.current) return;
    const now = Date.now();
    if (now - lastRunRef.current < MIN_CHECKIN_INTERVAL_MS) return;
    lastRunRef.current = now;
    runningRef.current = true;

    try {
      let res: Response;
      try {
        res = await fetch(SAINT_CHECKIN_URL, { credentials: 'include' });
      } catch {
        // 네트워크 실패 — 일시 오류로 보고 기존 상태 유지. 절대 로그아웃시키지 않는다.
        return;
      }

      // 401 = 로그인 아님(만료·타앱 로그아웃·강제 로그아웃 등, 이유는 구분하지 않음) → §2-4
      if (res.status === 401) {
        try { await clearDeviceData(); } catch { /* 무시 */ }
        try { await fetch('/api/auth/logout', { method: 'DELETE' }); } catch { /* 무시 */ }
        // 교적부 통합 로그아웃 경유가 아니다 — 세션은 이미 없으므로 자체 로그인 화면으로 유도한다
        window.location.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      // 500·그 외 — 일시 오류. 아무 것도 하지 않는다.
      if (res.status !== 200) return;

      let remoteRole: FinanceRole | undefined;
      let remoteName: string | undefined;
      try {
        const body = await res.json();
        remoteRole = body?.user?.finance_role;
        remoteName = body?.user?.name;
      } catch {
        return;
      }
      if (!remoteRole) return;

      // 화면 권한의 기준값을 체크인 응답으로 갱신
      onCheckIn?.({ finance_role: remoteRole, name: remoteName });

      // ── 권한 신선도: finance-session 의 baked role 과 다르면 재-민트 (§4-6)
      let localRole: FinanceRole | undefined;
      try {
        const local = await fetch('/api/auth/session');
        const data = await local.json();
        localRole = data?.session?.finance_role;
      } catch {
        return;
      }
      if (!localRole || localRole === remoteRole) return;

      // 탭 세션당 1회. 마커를 재-민트 **직전에** 세운다.
      // 재-민트 후에도 불일치가 남으면(공용PC에서 교적부가 saint 쿠키를 reseal 하지 않는 경우)
      // 다시 시도하지 않는다 — UI 는 체크인 응답값을 쓰고, 미들웨어 반영은 세션 만료로 미룬다.
      try {
        if (sessionStorage.getItem(REMINT_MARKER)) return;
        sessionStorage.setItem(REMINT_MARKER, '1');
      } catch {
        // sessionStorage 를 못 쓰면 가드가 없으므로 재-민트하지 않는다(루프 방지)
        return;
      }

      // ⚠️ 역할 값을 클라이언트가 전달하지 않는다. 서버가 saint 쿠키에서 재도출한다(위조 방지).
      window.location.replace(`/api/auth/sso?redirect=${encodeURIComponent(pathname)}`);
    } finally {
      runningRef.current = false;
    }
  }, [pathname, onCheckIn]);

  useEffect(() => {
    runCheckIn();

    const onFocus = () => { runCheckIn(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') runCheckIn();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runCheckIn]);

  return null;
}
