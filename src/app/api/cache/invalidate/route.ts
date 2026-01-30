import { NextResponse } from 'next/server';
import { invalidateYearCache } from '@/lib/redis';

export async function POST() {
  try {
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
