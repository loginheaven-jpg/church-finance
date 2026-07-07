// 은행 tx → 수입/지출 record 변환 시 사용되는 결정 로직 (2026-07-07)
// 이전에 src/app/api/match/auto/route.ts 에만 존재했던 로직을 재사용 가능하도록 추출.
// autoTransferBankToLedger 및 매칭 API 모두 이 파일을 참조하여 divergence 방지.
//
// 원본 로직 그대로 유지 — 회귀 없음.

import type { BankTransaction, DonorInfo, MatchingRule } from '@/types';

// 수입부 키워드 매칭 규칙 (우선순위 기반)
export interface IncomeMatchingRule {
  priority: number;
  keywords: string[];
  excludeKeywords?: string[];
  code: number;
  name: string;
}

export const INCOME_MATCHING_RULES: IncomeMatchingRule[] = [
  { priority: 1, keywords: ['건축', '성전', '봉헌'], code: 501, name: '건축헌금' },
  { priority: 2, keywords: ['예금이자', '이자'], code: 31, name: '이자수입' },
  { priority: 3, keywords: ['십일조', '십일'], code: 12, name: '십일조헌금' },
  { priority: 4, keywords: ['구제'], excludeKeywords: ['선교'], code: 22, name: '구제헌금' },
  { priority: 5, keywords: ['선교'], code: 21, name: '선교헌금' },
  { priority: 6, keywords: ['성탄', '신년'], code: 14, name: '특별헌금' },
  { priority: 7, keywords: ['감사'], code: 13, name: '감사헌금' },
  { priority: 8, keywords: ['큐티', '찬조', '지정', '후원'], code: 24, name: '지정헌금' },
  { priority: 9, keywords: ['커피', '카페'], excludeKeywords: ['주일'], code: 32, name: '기타잡수입' },
  { priority: 10, keywords: ['주일'], code: 11, name: '주일헌금' },
];

// 지출부 키워드 매칭 규칙 (우선순위 기반, 사용자 지시 2026-07-07)
// 은행원장의 description/memo/detail 에 이 키워드가 있으면 자동으로 해당 account_code 로 분류.
// detail 앞 2자리 숫자 추출(extractAccountCodeFromDetail) 실패 시 fallback 으로 사용.
export interface ExpenseMatchingRule {
  priority: number;
  keywords: string[];
  excludeKeywords?: string[];
  code: number;
  name: string;
}

export const EXPENSE_KEYWORD_RULES: ExpenseMatchingRule[] = [
  { priority: 1, keywords: ['결산지방세', '결산법인세', '법인세', '지방세'], code: 94, name: '법인세' },
];

/**
 * 지출 account_code 결정 (우선순위 기반 키워드 매칭)
 * - description + memo + detail 검토
 * - 매칭 시 { code, name, matchedBy: 'keyword' } 반환
 * - 실패 시 null
 */
export function determineExpenseAccountCode(
  memo: string | undefined,
  detail: string | undefined,
  description?: string
): { code: number; name: string; matchedBy: 'keyword' } | null {
  const searchText = `${description || ''} ${memo || ''} ${detail || ''}`.toLowerCase();

  for (const rule of EXPENSE_KEYWORD_RULES) {
    const hasKeyword = rule.keywords.some(kw => searchText.includes(kw.toLowerCase()));
    if (!hasKeyword) continue;

    if (rule.excludeKeywords) {
      const hasExclude = rule.excludeKeywords.some(kw => searchText.includes(kw.toLowerCase()));
      if (hasExclude) continue;
    }

    return { code: rule.code, name: rule.name, matchedBy: 'keyword' };
  }

  return null;
}

// 헌금 키워드 (이 키워드로 시작하면 뒤에서 이름 추출)
export const OFFERING_KEYWORDS = ['십일', '주일', '감사', '선교', '구제', '건축', '성전', '특별'];

// 헌금함 거래 판별 (detail 좌측 3자리가 '헌금함'인 경우)
export function isCashOfferingTransaction(tx: BankTransaction): boolean {
  const donorName = (tx.detail || '').substring(0, 3);
  return donorName === '헌금함';
}

// 헌금자명에서 대표자 조회 (헌금자정보 시트 기반)
// 매칭 없으면 donor_name 자체를 반환 (그룹핑 안전)
export function findRepresentative(donorName: string, donors: DonorInfo[]): string {
  const donor = donors.find(d => d.donor_name === donorName);
  return donor?.representative || donorName;
}

// detail에서 헌금자명 추출
// 규칙:
// 1. 특수문자(괄호 등) 모두 제거
// 2. 헌금 키워드로 시작하면 → 뒤 3자리: "십일조최병희" → "최병희", "감사(김윤희)" → "김윤희"
// 3. 그 외 → 앞 3자리: "김길동십일조" → "김길동", "오재혁(주일헌금)" → "오재혁"
export function extractDonorName(detail: string | undefined): string {
  if (!detail || detail.length < 2) return detail || '';

  // 특수문자 모두 제거 (한글, 영문, 숫자만 유지)
  const cleaned = detail.replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (!cleaned) return detail.substring(0, 3);

  // 헌금 키워드로 시작하면 뒤 3자리
  const startsWithKeyword = OFFERING_KEYWORDS.some(kw => cleaned.startsWith(kw));
  if (startsWithKeyword) {
    return cleaned.slice(-3);
  }

  // 그 외 앞 3자리
  return cleaned.substring(0, 3);
}

// 기본 수입 코드 결정 (금액 기반 fallback)
export function getDefaultIncomeCode(amount: number): { code: number; name: string } {
  if (amount < 50000) {
    return { code: 11, name: '주일헌금' };
  }

  const hasThousands = (amount % 10000) !== 0;
  if (hasThousands) {
    return { code: 12, name: '십일조' };
  } else {
    return { code: 13, name: '감사헌금' };
  }
}

/**
 * 수입부 offering_code 결정 (우선순위 기반 키워드 매칭)
 * - description + memo + detail 필드 모두 검토
 * - 키워드 매칭 실패 시 금액 기반 기본 분류
 */
export function determineIncomeOfferingCode(
  memo: string | undefined,
  detail: string | undefined,
  amount: number,
  description?: string
): { code: number; name: string; matchedBy: 'keyword' | 'default' } {
  const searchText = `${description || ''} ${memo || ''} ${detail || ''}`.toLowerCase();

  for (const rule of INCOME_MATCHING_RULES) {
    const hasKeyword = rule.keywords.some(kw => searchText.includes(kw));
    if (!hasKeyword) continue;

    if (rule.excludeKeywords) {
      const hasExclude = rule.excludeKeywords.some(kw => searchText.includes(kw));
      if (hasExclude) continue;
    }

    return { code: rule.code, name: rule.name, matchedBy: 'keyword' };
  }

  return { ...getDefaultIncomeCode(amount), matchedBy: 'default' };
}

/**
 * detail 필드에서 account_code 추출 (지출부 1순위 규칙)
 * - 숫자로 시작하면 좌측 2자리 추출
 * - 단, 50으로 시작하면 좌측 3자리 추출 (예: 501대출상환)
 * - 50 다음이 숫자가 아니면 매칭 실패 → needsReview
 */
export function extractAccountCodeFromDetail(detail: string): { code: number; rest: string } | null {
  if (!detail || detail.length < 2) return null;

  // 숫자로 시작하지 않으면 실패
  if (!/^\d/.test(detail)) return null;

  const first2 = detail.substring(0, 2);

  // 50으로 시작하면 3자리 추출 시도
  if (first2 === '50') {
    const first3 = detail.substring(0, 3);
    // 3자리가 모두 숫자여야 함 (예: 501)
    if (/^\d{3}/.test(first3)) {
      return { code: parseInt(first3, 10), rest: detail.substring(3) };
    }
    // 50 다음이 숫자가 아니면 매칭 실패 → null 반환 → needsReview
    return null;
  }

  // 그 외: 좌측 2자리 추출
  if (/^\d{2}/.test(first2)) {
    return { code: parseInt(first2, 10), rest: detail.substring(2) };
  }

  return null;
}

// 매칭 규칙 찾기 (matching_rules 시트 활용, amount_min/max 조건 포함)
export function findBestMatchingRule(
  transaction: BankTransaction,
  rules: MatchingRule[]
): MatchingRule | null {
  let searchText: string;
  if (transaction.deposit > 0) {
    searchText = (transaction.memo || '').toLowerCase();
  } else {
    searchText = `${transaction.detail || ''} ${transaction.description || ''}`.toLowerCase();
  }

  const amount = transaction.deposit > 0 ? transaction.deposit : transaction.withdrawal;

  let bestMatch: MatchingRule | null = null;
  let bestScore = 0;

  for (const rule of rules) {
    // 수입/지출 타입 체크
    if (transaction.deposit > 0 && rule.rule_type !== 'bank_income') continue;
    if (transaction.withdrawal > 0 && rule.rule_type !== 'bank_expense') continue;

    // amount 범위 체크 (b466b42 도입)
    if (typeof rule.amount_min === 'number' && amount < rule.amount_min) continue;
    if (typeof rule.amount_max === 'number' && amount > rule.amount_max) continue;

    const score = calculateMatchScore(searchText, rule);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  return bestMatch;
}

// 매칭 점수 계산 (pattern substring 검사)
export function calculateMatchScore(searchText: string, rule: MatchingRule): number {
  if (searchText.includes(rule.pattern.toLowerCase())) {
    return rule.confidence;
  }
  return 0;
}

// 추천 규칙 조회 (needsReview 큐 UI 지원용)
export function getSuggestedRules(
  transaction: BankTransaction,
  rules: MatchingRule[],
  limit: number
): MatchingRule[] {
  let searchText: string;
  if (transaction.deposit > 0) {
    searchText = (transaction.memo || '').toLowerCase();
  } else {
    searchText = `${transaction.detail || ''} ${transaction.description || ''}`.toLowerCase();
  }

  return rules
    .filter(rule => {
      if (transaction.deposit > 0 && rule.rule_type !== 'bank_income') return false;
      if (transaction.withdrawal > 0 && rule.rule_type !== 'bank_expense') return false;
      return true;
    })
    .map(rule => ({ rule, score: calculateMatchScore(searchText, rule) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.rule);
}
