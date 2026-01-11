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
        setSession(data.session);
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
