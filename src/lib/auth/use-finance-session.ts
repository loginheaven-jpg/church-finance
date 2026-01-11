'use client';

import { useState, useEffect } from 'react';
import { FinanceSession, FinanceRole, SESSION_COOKIE_NAME } from './finance-permissions';

export function useFinanceSession(): FinanceSession | null {
  const [session, setSession] = useState<FinanceSession | null>(null);

  useEffect(() => {
    // 클라이언트에서 쿠키 읽기
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift();
        return cookieValue ? decodeURIComponent(cookieValue) : null;
      }
      return null;
    };

    const sessionCookie = getCookie(SESSION_COOKIE_NAME);
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie);
        setSession(parsed);
      } catch {
        setSession(null);
      }
    }
  }, []);

  return session;
}

export function useFinanceRole(): FinanceRole {
  const session = useFinanceSession();
  return session?.finance_role || 'member';
}
