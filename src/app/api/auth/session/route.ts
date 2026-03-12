import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';

// 현재 세션 정보 반환
export async function GET() {
  try {
    const session = await getFinanceSession();
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}
