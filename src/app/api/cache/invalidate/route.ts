import { NextResponse } from 'next/server';
import { invalidateYearCache } from '@/lib/redis';
import { requireSession } from '@/lib/auth/require-session';

export async function POST() {
  try {
    // 대시보드·카드내역(member)에서도 호출 → 로그인만 요구.
    // 현재 연도 캐시만 비우므로 로그인 사용자의 악용 여지는 낮다(쿼터 소진 정도).
    const guard = await requireSession();
    if (guard.response) return guard.response;

    const currentYear = new Date().getFullYear();
    await invalidateYearCache(currentYear);

    console.log(`[Cache] Invalidated all cache for year ${currentYear}`);

    return NextResponse.json({ success: true, year: currentYear });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
