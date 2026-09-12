import { NextResponse } from 'next/server';
import { getMatchingRules } from '@/lib/google-sheets';
import { requireRole } from '@/lib/auth/require-session';

export async function GET() {
  try {
    const guard = await requireRole('admin');
    if (guard.response) return guard.response;

    const rules = await getMatchingRules();

    // 사용량순으로 정렬
    rules.sort((a, b) => b.usage_count - a.usage_count);

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Get matching rules error:', error);
    return NextResponse.json(
      { success: false, error: '매칭 규칙 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
