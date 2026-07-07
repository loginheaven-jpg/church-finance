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

// 지출부 키워드 매칭 규칙 (2026-07-07 β‴ 대폭 확장, 감사 P0-2/P1-5 반영)
// 은행원장의 description/memo/detail 에 이 키워드가 있으면 자동으로 해당 account_code 로 분류.
// detail 앞 2자리 숫자 추출(extractAccountCodeFromDetail) 실패 시 fallback 으로 사용.
export interface ExpenseMatchingRule {
  priority: number;
  keywords: string[];
  excludeKeywords?: string[];
  code: number;
  name: string;
}

// 은행 이체 채널 노이즈 (지출 keyword 매칭 전 stripping, 감사 P1-5)
// 2026-07-07 β⁴ 확장: E-/G-/S- 계열 실 데이터 verbatim 추가
export const CHANNEL_NOISE = [
  'G-국민은행', 'G-신한은행', 'G-하나은행', 'G-우리은행', 'G-제일은행',
  'G-토스뱅크', 'G-카카오', 'G-기업은행', 'G-신용협동',
  'E-SC제일', 'E-국민은행', 'E-하나은행', 'E-기업은행',
  'S-국민은행', 'S-토스뱅크', 'S-신한은행', 'S-하나은행', 'S-카카오', 'S-새마을',
  'PC신한은행', 'PC국민은행', 'PC하나은행', 'PC우리은행',
  'PC부산은행', 'PC카카오', 'PC토스뱅크',
  '폰토스뱅크', 'NH올원뱅크', 'NH콕송금',
  '폰국민은행', '폰신한은행', '폰우리은행', '폰하나은행', '폰카카오', '폰카뱅', '폰토스',
  '인터넷당행', '인터넷타행', '인터넷뱅킹', '폰뱅킹', '오픈뱅킹', '은행간입금',
  '자동이체', '자동납부', 'ATM출금', 'CD출금', '창구출금',
  '이체수수료', '타행이체', '대체', '지로',
  '전기료', '가스료', '수도료', '전화료',
];

/**
 * 이체 채널 노이즈 제거 (지출 keyword 매칭 정확도 향상용).
 * 채널명이 keyword 와 우연 충돌하여 오분류되는 것을 방지.
 * 예: "폰신한은행 전기료 한전전기요금05월" → " 한전전기요금05월"
 */
export function stripChannelNoise(s: string | undefined): string {
  let out = s || '';
  for (const kw of CHANNEL_NOISE) out = out.split(kw).join(' ');
  return out.replace(/\s+/g, ' ').trim();
}

export const EXPENSE_KEYWORD_RULES: ExpenseMatchingRule[] = [
  // 세금과공과 (최우선)
  { priority: 1, keywords: ['결산법인세', '결산지방세', '재산세', '자동차세', '부가세', '법인세', '지방세'], code: 94, name: '세금과공과' },
  // 공과금 - 전기/가스/수도
  { priority: 2, keywords: ['전기요금', '한국전력', '한전'], code: 61, name: '전기료' },
  { priority: 3, keywords: ['도시가스', '코원에너지', '가스공사'], code: 62, name: '도시가스' },
  { priority: 4, keywords: ['상수도', '수도요금', '국민건강', '국민연금', '건강보험', '고용보험', '산재보험'], code: 63, name: '수도료/보험' },
  // 시설관리
  { priority: 5, keywords: ['현대렌탈', '정수기', '공기청정기', '엘리베이터', '승강기', '소방', '전기안전', '진성전기'], code: 64, name: '시설관리비' },
  { priority: 6, keywords: ['주유', '자동차', '차량정비', '오일'], code: 65, name: '차량유지비' },
  { priority: 7, keywords: ['수리', '수선', '보수'], code: 66, name: '수선비' },
  // 통신비
  { priority: 8, keywords: ['LGU+', 'LG유플러스', 'KT', 'SK텔레콤', 'SKT', '통신료', '인터넷요금'], code: 71, name: '통신비' },
  // 사무·인쇄
  { priority: 9, keywords: ['인쇄', '주보', '현수막', '플래카드'], code: 72, name: '인쇄비' },
  { priority: 10, keywords: ['회의', '간담'], code: 73, name: '회의비' },
  { priority: 11, keywords: ['사무용품', '문구', '토너', 'A4'], code: 74, name: '사무용품비' },
  // 인건비
  { priority: 12, keywords: ['급여', '월급'], code: 11, name: '급여' },
  { priority: 13, keywords: ['사례비', '월사례'], code: 12, name: '사례비' },
  { priority: 14, keywords: ['수당', '상여'], code: 13, name: '수당' },
  { priority: 15, keywords: ['식대', '식사', '만나'], code: 14, name: '식대' },
  // 선교·전도·교육
  { priority: 16, keywords: ['선교', '미션', '파송'], code: 33, name: '선교비' },
  { priority: 17, keywords: ['전도'], code: 31, name: '전도비' },
  { priority: 18, keywords: ['교육', '세미나', '컨퍼런스'], code: 41, name: '교육비' },
  { priority: 19, keywords: ['어린이부', '유치부', '유년부'], code: 42, name: '어린이부' },
  { priority: 20, keywords: ['청년부', '대학부'], code: 44, name: '청년부' },
  // 경조·구제·후원
  { priority: 21, keywords: ['경조', '축의', '부의'], code: 51, name: '경조비' },
  { priority: 22, keywords: ['구제', '구호', '재난'], code: 52, name: '구제비' },
  { priority: 23, keywords: ['어린이재단', '후원', '기부'], code: 53, name: '후원비' },
  // 노회비
  { priority: 24, keywords: ['상회비', '노회비', '총회비'], code: 81, name: '상회비' },
  // 적립
  { priority: 25, keywords: ['적립', '예비비'], code: 91, name: '예비비적립' },
  // 대출
  { priority: 26, keywords: ['대출금이자', '대출이자'], code: 501, name: '대출이자' },
  { priority: 27, keywords: ['대출원금상환', '원금상환'], code: 502, name: '대출원금상환' },
  { priority: 28, keywords: ['건축', '성전건축'], code: 500, name: '건축비' },
];

/**
 * 지출 account_code 결정 (우선순위 기반 키워드 매칭)
 * - description + memo + detail 검토 (CHANNEL_NOISE stripping 적용)
 * - 매칭 시 { code, name, matchedBy: 'keyword' } 반환
 * - 실패 시 null
 */
export function determineExpenseAccountCode(
  memo: string | undefined,
  detail: string | undefined,
  description?: string
): { code: number; name: string; matchedBy: 'keyword'; matchedKeyword?: string } | null {
  // 채널 노이즈 stripping 후 검색
  const searchText = stripChannelNoise(
    `${description || ''} ${memo || ''} ${detail || ''}`
  ).toLowerCase();

  for (const rule of EXPENSE_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const kwLower = kw.toLowerCase();
      if (!searchText.includes(kwLower)) continue;
      if (rule.excludeKeywords) {
        const hasExclude = rule.excludeKeywords.some(ex => searchText.includes(ex.toLowerCase()));
        if (hasExclude) continue;
      }
      return { code: rule.code, name: rule.name, matchedBy: 'keyword', matchedKeyword: kw };
    }
  }

  return null;
}

// 헌금 키워드 (이 키워드로 시작하면 뒤에서 이름 추출)
// P1-6: 맥추/추수/부활/성탄/무명 + 전도/지정 추가 (감사 리포트)
export const OFFERING_KEYWORDS = [
  '십일', '주일', '감사', '선교', '구제', '건축', '성전', '특별',
  '맥추', '추수', '부활', '성탄', '무명', '전도', '지정',
];

// 지출 상세 keyword (사람 이름 앞뒤에 붙는 지출 유형/사유 keyword)
// "33서현철선교" → 서현철 / "방민혁사례" → 방민혁 / "사례현소희" → 현소희
export const EXPENSE_DETAIL_KEYWORDS = [
  '사례', '수업료', '보험료', '식사', '점심', '만나', '교통비', '적립',
  '실김치', '식사재료', '지원', '수당',
  // P1-7 확장 (감사 리포트)
  '월사례', '반주', '노회', '후원', '학술원', '찬양단', '간사', '님',
  // 국가/지역 (선교 관련)
  '카메룬', '튀르키에', '일본', '필리핀', '대만', '네팔', '북한', '북재위',
  '판교', '철원', '청송',
];

// 이름 파싱용 통합 keyword (헌금 + 지출)
export const NAME_STRIPPER_KEYWORDS = [
  ...OFFERING_KEYWORDS,
  ...EXPENSE_DETAIL_KEYWORDS,
];

/**
 * 문자열에서 사람 이름 부분만 추출 (지출 vendor 파싱용).
 * - 접두 keyword 제거: "사례현소희" → "현소희"
 * - 접미 keyword 제거: "서현철선교" → "서현철", "방민혁사례" → "방민혁"
 * - 매칭 없으면 앞 3자리
 * - 이체 채널 keyword 면 즉시 실패
 */
export function extractPersonName(text: string | undefined): string {
  if (!text || text.length < 2) return '';
  if (isTransferChannel(text)) return '';
  const cleaned = text.replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (!cleaned) return '';

  // 접두 keyword 제거 (예: "사례현소희" → "현소희")
  for (const kw of NAME_STRIPPER_KEYWORDS) {
    if (cleaned.startsWith(kw)) {
      const rest = cleaned.slice(kw.length);
      if (rest.length >= 2) return rest.slice(0, 3);
    }
  }

  // 접미 keyword 제거 (예: "서현철선교" → "서현철", "방민혁사례" → "방민혁")
  for (const kw of NAME_STRIPPER_KEYWORDS) {
    if (cleaned.endsWith(kw)) {
      const front = cleaned.slice(0, cleaned.length - kw.length);
      if (front.length >= 2) return front.slice(0, 3);
    }
  }

  // 그 외 앞 3자리
  return cleaned.substring(0, 3);
}

// 이체 채널 keyword — 이 값이 오면 실제 이체 문구는 다른 컬럼에 있음
// (예: 농협 이체 수입에서 G="폰신한은행", H="정의태주일헌금")
// 2026-07-07 β⁴ 확장: E-SC제일 오탐 사례 (donor_name="ESC") + 잠재 오탐 357 tx 대응
export const TRANSFER_CHANNEL_PATTERNS: RegExp[] = [
  /은행$/,
  /뱅크$/,
  /뱅킹$/,               // ADD: 오픈뱅킹, 인터넷뱅킹
  /^폰[가-힣]/,
  /^PC[가-힣]/,
  /^NH/,
  /^스마트/,
  /카카오/,
  /^ATM/i,
  /올원/,
  /콕송금/,
  /^당행/,
  /^전자금융/,
  /^E-/,                 // ADD: E-SC제일 (29 tx), E-* 계열
  /^G-/,                 // ADD: G-신용협동 등 (은행$ 로 대부분 커버되나 완전화)
  /^S-/,                 // ADD: S-새마을, S-* 계열
  /^오픈/,               // ADD: 오픈뱅킹 (24 tx)
  /^인터넷/,             // ADD: 인터넷당행 (38 tx), 인터넷타행, 인터넷뱅킹
  /^자동(이체|납부)/,    // ADD: 자동이체 (30), 자동납부 (28)
  /^타행/,               // ADD: 타행이체 (173 tx)
  /^은행간/,             // ADD: 은행간입금
  /^(대체|지로)$/,       // ADD: 대체 (2), 지로 (24)
  /^예금이자$/,          // ADD: 이자 수입 (donor_name="예금이" 오탐 방지)
  /^대출금?이자$/,       // ADD: 이자 지출 오탐 방지
];

/**
 * 문자열이 이체 채널 keyword(은행명, 이체 방식) 인지 판정.
 * "폰신한은행", "NH올원뱅크", "PC하나은행", "스마트당행", "NH콕송금" 등.
 */
export function isTransferChannel(text: string | undefined): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;
  return TRANSFER_CHANNEL_PATTERNS.some(p => p.test(trimmed));
}

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
// 0. 이체 채널 keyword("폰신한은행", "NH올원뱅크" 등) 이면 즉시 실패 (fallback 유도)
// 0-b. (β⁴) 한글이 하나도 없으면 헌금자 아님 — "ESC", "LGU", "NH연" 등 순수 영문 원천 차단
// 1. 특수문자(괄호 등) 모두 제거
// 2. 헌금 키워드로 시작하면 → 뒤 3자리: "십일조최병희" → "최병희", "감사(김윤희)" → "김윤희"
// 3. 그 외 → 앞 3자리 (단 앞 3자에 한글이 있어야 유효)
export function extractDonorName(detail: string | undefined): string {
  if (!detail || detail.length < 2) return '';

  // 이체 채널이면 헌금자명 아님 → 빈 문자열 반환 (호출측 || fallback 유도)
  if (isTransferChannel(detail)) return '';

  // 특수문자 모두 제거 (한글, 영문, 숫자만 유지)
  const cleaned = detail.replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (!cleaned) return '';

  // β⁴ 안전망: 한글이 하나도 없으면 헌금자 아님 (2차 방어)
  if (!/[가-힣]/.test(cleaned)) return '';

  // 헌금 키워드로 시작하면 뒤 3자리
  const startsWithKeyword = OFFERING_KEYWORDS.some(kw => cleaned.startsWith(kw));
  if (startsWithKeyword) {
    return cleaned.slice(-3);
  }

  // 그 외 앞 3자리 (앞 3자에 한글이 있어야 유효)
  const head = cleaned.substring(0, 3);
  return /[가-힣]/.test(head) ? head : '';
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
  // 수입/지출 공통 — description(G) + memo(J) + detail(H) 모두 검사
  // (2026-07-07 수정: 기존은 수입 = memo 만 봤음. G 적요에 "전병문성전" 같은 문구가 있는데 놓쳤음.)
  let searchText: string;
  if (transaction.deposit > 0) {
    searchText = `${transaction.description || ''} ${transaction.memo || ''} ${transaction.detail || ''}`.toLowerCase();
  } else {
    searchText = `${transaction.detail || ''} ${transaction.description || ''} ${transaction.memo || ''}`.toLowerCase();
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

// 매칭 점수 계산 — P1-4 3-tier (substring + regex + 부분단어 70%)
// 감사 리포트: engine.ts:249-275 의 원본 로직 복원
export function calculateMatchScore(searchText: string, rule: MatchingRule): number {
  const s = searchText.toLowerCase();
  const p = (rule.pattern || '').toLowerCase();
  if (!p) return 0;

  // Tier 1: substring (완전 일치)
  if (s.includes(p)) return rule.confidence;

  // Tier 2: regex (pattern이 정규식일 수 있음)
  try {
    if (new RegExp(p, 'i').test(searchText)) return rule.confidence * 0.9;
  } catch { /* invalid regex - skip */ }

  // Tier 3: 부분단어 매칭 (words의 70% 이상 hit)
  const words = p.split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return 0;
  const hits = words.filter(w => s.includes(w)).length;
  const ratio = hits / words.length;
  return ratio >= 0.7 ? rule.confidence * ratio * 0.8 : 0;
}

// P1-3: extractKeyPattern — 학습 시 pattern 정규화 (은행명/채널/숫자 제거)
// 감사 리포트: engine.ts:432 의 dead code 복원
const LEARN_CHANNEL_REGEX = /(국민|신한|우리|하나|농협|NH|KB|SC|씨티|카카오|토스|기업|산업)/g;
const LEARN_PREFIX_REGEX = /(G-|S-|E-|PC|폰|NH콕송금|오픈뱅킹|자동이체|자동납부|인터넷당행|인터넷타행|ATM출금|CD출금|창구출금)/g;

export function extractKeyPattern(text: string): string {
  return (text || '')
    .replace(/\d+/g, '')
    .replace(LEARN_CHANNEL_REGEX, '')
    .replace(LEARN_PREFIX_REGEX, '')
    .replace(/[^\w가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15);
}

// 추천 규칙 조회 (needsReview 큐 UI 지원용)
export function getSuggestedRules(
  transaction: BankTransaction,
  rules: MatchingRule[],
  limit: number
): MatchingRule[] {
  // findBestMatchingRule 과 동일한 searchText 정책
  let searchText: string;
  if (transaction.deposit > 0) {
    searchText = `${transaction.description || ''} ${transaction.memo || ''} ${transaction.detail || ''}`.toLowerCase();
  } else {
    searchText = `${transaction.detail || ''} ${transaction.description || ''} ${transaction.memo || ''}`.toLowerCase();
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
