import { NextResponse } from 'next/server';
import { getMatchingRules } from '@/lib/google-sheets';

export async function GET() {
  try {
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
