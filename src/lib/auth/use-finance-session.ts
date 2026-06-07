'use client';

import { useState, useEffect } from 'react';
import { FinanceSession, FinanceRole } from './finance-permissions';

export function useFinanceSession(): FinanceSession | null {
  const [session, setSession] = useState<FinanceSession | null>(null);

  useEffect(() => {
    // API에서 세션 정보 가져오기
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        // 양쪽 응답 형식 지원:
        //   1) { session: { ... } }   ← wrap된 표준
        //   2) { user_id, finance_role, ... }  ← raw session 객체
        const candidate = (data && typeof data === 'object' && 'session' in data)
          ? data.session
          : data;
        if (candidate && candidate.finance_role) {
          setSession(candidate as FinanceSession);
        } else {
          setSession(null);
        }
      } catch {
        setSession(null);
      }
    };

    fetchSession();
  }, []);

  return session;
}

export function useFinanceRole(): FinanceRole {
  const session = useFinanceSession();
  return session?.finance_role || 'member';
}
