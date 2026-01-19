import { NextRequest, NextResponse } from 'next/server';
import { getMatchingRules, addMatchingRule, getKSTDateTime } from '@/lib/google-sheets';
import type { MatchingRule } from '@/types';

// GET: 모든 매칭규칙 조회
export async function GET() {
  try {
    const rules = await getMatchingRules();
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('Get matching rules error:', error);
    return NextResponse.json(
      { success: false, error: '매칭규칙 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: 매칭규칙 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rules } = body as { rules: Omit<MatchingRule, 'id' | 'created_at' | 'updated_at'>[] };

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json(
        { success: false, error: '규칙 데이터가 필요합니다' },
        { status: 400 }
      );
    }

    const now = getKSTDateTime();
    const addedIds: string[] = [];

    for (const rule of rules) {
      const id = await addMatchingRule({
        rule_type: rule.rule_type,
        pattern: rule.pattern,
        target_type: rule.target_type,
        target_code: rule.target_code,
        target_name: rule.target_name,
        confidence: rule.confidence || 0.9,
        usage_count: 0,
        created_at: now,
        updated_at: now,
      });
      addedIds.push(id);
    }

    return NextResponse.json({
      success: true,
      added: addedIds.length,
      ids: addedIds,
      message: `${addedIds.length}개의 매칭규칙이 추가되었습니다`,
    });
  } catch (error) {
    console.error('Add matching rules error:', error);
    return NextResponse.json(
      { success: false, error: '매칭규칙 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
