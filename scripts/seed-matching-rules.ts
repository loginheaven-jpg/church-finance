/**
 * 매칭규칙 시드 데이터
 * 실행: npx tsx scripts/seed-matching-rules.ts
 */

const MATCHING_RULES = [
  // ============================================
  // 수입부 규칙 (bank_income)
  // ============================================
  // 기존 엑셀 수식 기반:
  // "십일" → 12, "건축" → 501, "감사" → 13, "선교" → 21, "주일" → 11, "구제" → 22, "큐티" → 24

  { rule_type: 'bank_income', pattern: '십일', target_type: 'income', target_code: 12, target_name: '십일조', confidence: 0.95 },
  { rule_type: 'bank_income', pattern: '건축', target_type: 'income', target_code: 501, target_name: '건축헌금', confidence: 0.95 },
  { rule_type: 'bank_income', pattern: '감사', target_type: 'income', target_code: 13, target_name: '감사헌금', confidence: 0.9 },
  { rule_type: 'bank_income', pattern: '선교', target_type: 'income', target_code: 21, target_name: '선교헌금', confidence: 0.95 },
  { rule_type: 'bank_income', pattern: '주일', target_type: 'income', target_code: 11, target_name: '주일헌금', confidence: 0.85 },
  { rule_type: 'bank_income', pattern: '구제', target_type: 'income', target_code: 22, target_name: '구제헌금', confidence: 0.95 },
  { rule_type: 'bank_income', pattern: '큐티', target_type: 'income', target_code: 24, target_name: '큐티', confidence: 0.95 },

  // ============================================
  // 지출부 규칙 (bank_expense)
  // ============================================
  // 기존 엑셀 수식 기반:
  // "수도" → 수도, "코원" → 가스, "어린이재단" → 53, "대출" → 501,
  // "결산" → 94, "현대엘리" → 64, "KT801691" → 71, "전기" → 61/62,
  // "LGU" → 91, "진성전기" → 64, "렌탈" → 64, "배지윤" → 23

  { rule_type: 'bank_expense', pattern: '수도', target_type: 'expense', target_code: 63, target_name: '수도료', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: '코원', target_type: 'expense', target_code: 62, target_name: '가스비', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: '어린이재단', target_type: 'expense', target_code: 53, target_name: '어린이재단', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: '대출', target_type: 'expense', target_code: 501, target_name: '대출상환', confidence: 0.9 },
  { rule_type: 'bank_expense', pattern: '결산', target_type: 'expense', target_code: 94, target_name: '결산', confidence: 0.85 },
  { rule_type: 'bank_expense', pattern: '현대엘리', target_type: 'expense', target_code: 64, target_name: '엘리베이터', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: 'KT801691', target_type: 'expense', target_code: 71, target_name: '통신비(KT)', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: '전기', target_type: 'expense', target_code: 61, target_name: '전기료', confidence: 0.85 },
  { rule_type: 'bank_expense', pattern: '한국전력', target_type: 'expense', target_code: 61, target_name: '전기료', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: 'LGU', target_type: 'expense', target_code: 91, target_name: '통신비(LGU)', confidence: 0.9 },
  { rule_type: 'bank_expense', pattern: '진성전기', target_type: 'expense', target_code: 64, target_name: '전기시설', confidence: 0.95 },
  { rule_type: 'bank_expense', pattern: '렌탈', target_type: 'expense', target_code: 64, target_name: '렌탈비', confidence: 0.9 },
  { rule_type: 'bank_expense', pattern: '배지윤', target_type: 'expense', target_code: 23, target_name: '배지윤', confidence: 0.95 },
];

async function seedMatchingRules() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  console.log('매칭규칙 시드 데이터 추가 중...');
  console.log(`총 ${MATCHING_RULES.length}개 규칙`);

  try {
    const response = await fetch(`${baseUrl}/api/match/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: MATCHING_RULES }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ ${result.added}개 규칙 추가 완료`);
    } else {
      console.error('❌ 오류:', result.error);
    }
  } catch (error) {
    console.error('❌ 요청 실패:', error);
  }
}

seedMatchingRules();
