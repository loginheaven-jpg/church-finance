import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FinanceSession, SESSION_COOKIE_NAME } from '@/lib/auth/finance-permissions';

// 현재 세션 정보 반환
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json({ session: null });
    }

    const session: FinanceSession = JSON.parse(sessionCookie.value);
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}
