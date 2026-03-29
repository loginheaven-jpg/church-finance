import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway20251125.up.railway.app';

const RECEIPT_ANALYSIS_PROMPT = `이 이미지에 포함된 모든 영수증을 각각 분석하여 JSON 배열로 추출해주세요.
이미지에 영수증이 1장이면 배열에 1개, 2장이면 2개, 최대 5장까지 각각 객체를 포함하세요.
반드시 아래 형식의 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.

[
  {
    "amount": 숫자(총액, 원 단위),
    "store": "가맹점/상호명",
    "date": "YYYY-MM-DD 또는 null",
    "items": ["품목1", "품목2"],
    "confidence": "high/medium/low"
  }
]

규칙:
- 이미지에 여러 장의 영수증이 함께 촬영되어 있으면 각각 별도 객체로 분리
- amount: 총액/합계/결제금액 우선. 없으면 개별 항목 합산. 숫자만 (콤마/원 제거)
- store: 상호명, 사업자명 등. 없으면 null
- date: 거래일/발행일. 없으면 null
- items: 주요 품목명 (최대 5개)
- confidence: 글씨가 선명하면 high, 일부 불명확하면 medium, 대부분 못읽으면 low`;

export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session || session.finance_role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { image_base64, image_media_type } = await request.json();
    if (!image_base64) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 });
    }

    const startTime = Date.now();

    const res = await fetch(`${AI_GATEWAY_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'claude-haiku',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image_media_type || 'image/jpeg',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: RECEIPT_ANALYSIS_PROMPT,
            },
          ],
        }],
        max_tokens: 1500,
        temperature: 0,
        caller: 'church-finance:receipt-test',
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown' }));
      return NextResponse.json({
        error: `AI Gateway 오류: ${res.status}`,
        detail: err.detail || err.error,
        elapsed,
      }, { status: 502 });
    }

    const aiResult = await res.json();

    // AI 응답에서 JSON 배열 추출 (복수 영수증 지원)
    let parsed: Array<{amount: number | null; store: string | null; date: string | null; items: string[]; confidence: string}> | null = null;
    let parseError = null;
    try {
      // 배열 형태 먼저 시도
      const arrayMatch = aiResult.content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        parsed = Array.isArray(arr) ? arr : [arr];
      } else {
        // 단일 객체 fallback (하위 호환)
        const objMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsed = [JSON.parse(objMatch[0])];
        } else {
          parseError = 'JSON을 찾을 수 없습니다';
        }
      }
    } catch (e) {
      parseError = `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json({
      success: true,
      raw: aiResult.content,
      parsed,
      parseError,
      model: aiResult.model,
      provider: aiResult.provider,
      usage: aiResult.usage,
      elapsed,
    });
  } catch (error) {
    console.error('[receipt-test]', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
