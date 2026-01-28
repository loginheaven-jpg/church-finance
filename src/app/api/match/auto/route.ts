import { NextRequest, NextResponse } from 'next/server';
import {
  getBankTransactions,
  getMatchingRules,
  getIncomeRecords,
  getDonorInfo,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import type {
  BankTransaction,
  IncomeRecord,
  ExpenseRecord,
  MatchingRule,
  DonorInfo,
} from '@/types';

// 헌금함 매칭 현황 타입
interface CashOfferingMatchStatus {
  date: string;
  incomeTotal: number;  // 수입부 헌금함 합계
  bankAmount: number;   // 은행원장 헌금함 금액
  matched: boolean;
}

// 수입부 키워드 매칭 규칙 (우선순위 기반)
interface IncomeMatchingRule {
  priority: number;
  keywords: string[];
  excludeKeywords?: string[];
  code: number;
  name: string;
}

const INCOME_MATCHING_RULES: IncomeMatchingRule[] = [
  { priority: 1, keywords: ['건축', '성전', '봉헌'], code: 501, name: '건축헌금' },
  { priority: 2, keywords: ['이자'], code: 31, name: '이자수입' },
  { priority: 3, keywords: ['십일조', '십일'], code: 12, name: '십일조헌금' },
  { priority: 4, keywords: ['구제'], excludeKeywords: ['선교'], code: 22, name: '구제헌금' },
  { priority: 5, keywords: ['선교'], code: 21, name: '선교헌금' },
  { priority: 6, keywords: ['성탄', '신년'], code: 14, name: '특별헌금' },
  { priority: 7, keywords: ['감사'], code: 13, name: '감사헌금' },
  { priority: 8, keywords: ['큐티', '찬조', '지정', '후원'], code: 24, name: '지정헌금' },
  { priority: 9, keywords: ['커피', '카페'], excludeKeywords: ['주일'], code: 32, name: '기타잡수입' },
  { priority: 10, keywords: ['주일'], code: 11, name: '주일헌금' },
];

// 미리보기용 매칭 결과 생성 (저장하지 않음)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { transactionIds } = body as { transactionIds?: string[] };

    const rules = await getMatchingRules();
    const allTransactions = await getBankTransactions();
    const existingIncomeRecords = await getIncomeRecords();
    const donors = await getDonorInfo();

    // transactionIds가 주어지면 해당 ID만, 아니면 pending 전체
    let targetTransactions: BankTransaction[];
    if (transactionIds && transactionIds.length > 0) {
      targetTransactions = allTransactions.filter(tx =>
        transactionIds.includes(tx.id) && !tx.suppressed
      );
    } else {
      targetTransactions = allTransactions.filter(tx =>
        tx.matched_status === 'pending' && !tx.suppressed
      );
    }

    // 수입부에서 헌금함(source='헌금함') 합계를 기준일별로 계산
    const cashOfferingByDate = new Map<string, number>();
    existingIncomeRecords
      .filter(r => r.source === '헌금함')
      .forEach(r => {
        const existing = cashOfferingByDate.get(r.date) || 0;
        cashOfferingByDate.set(r.date, existing + r.amount);
      });

    // 은행원장에서 헌금함 입금을 기준일별로 수집
    const bankCashOfferingByDate = new Map<string, { total: number; transactions: BankTransaction[] }>();
    targetTransactions
      .filter(tx => tx.deposit > 0 && isCashOfferingTransaction(tx))
      .forEach(tx => {
        const existing = bankCashOfferingByDate.get(tx.date) || { total: 0, transactions: [] };
        bankCashOfferingByDate.set(tx.date, {
          total: existing.total + tx.deposit,
          transactions: [...existing.transactions, tx],
        });
      });

    // 헌금함 매칭 현황 생성 (은행원장에 헌금함 거래가 있는 날짜만)
    const cashOfferingMatchStatus: CashOfferingMatchStatus[] = [];
    bankCashOfferingByDate.forEach((bankData, date) => {
      const incomeTotal = cashOfferingByDate.get(date) || 0;
      const bankAmount = bankData.total;
      cashOfferingMatchStatus.push({
        date,
        incomeTotal,
        bankAmount,
        matched: incomeTotal === bankAmount && bankAmount > 0,
      });
    });
    cashOfferingMatchStatus.sort((a, b) => a.date.localeCompare(b.date));

    const incomeRecords: Array<{
      transaction: BankTransaction;
      record: IncomeRecord;
      match: MatchingRule | null;
    }> = [];

    const expenseRecords: Array<{
      transaction: BankTransaction;
      record: ExpenseRecord;
      match: MatchingRule | null;
    }> = [];

    const suppressedTransactions: BankTransaction[] = [];
    const needsReview: Array<{
      transaction: BankTransaction;
      suggestions: MatchingRule[];
    }> = [];

    const now = getKSTDateTime();

    for (const tx of targetTransactions) {
      // 헌금함 입금 체크 (카드결제와 분리)
      if (tx.deposit > 0 && isCashOfferingTransaction(tx)) {
        const incomeTotal = cashOfferingByDate.get(tx.date) || 0;
        const bankData = bankCashOfferingByDate.get(tx.date);
        const bankAmount = bankData?.total || 0;

        if (incomeTotal === bankAmount && incomeTotal > 0) {
          // 금액 일치 → 말소
          suppressedTransactions.push({
            ...tx,
            suppressed_reason: '자동 말소 (헌금함)',
          });
        } else {
          // 금액 불일치 → 매칭실패로 검토 필요
          needsReview.push({
            transaction: {
              ...tx,
              suppressed_reason: `매칭실패 (수입부: ${incomeTotal.toLocaleString()}, 은행: ${bankAmount.toLocaleString()})`,
            },
            suggestions: [],
          });
        }
        continue;
      }

      // 카드결제는 여기서 말소하지 않음 (카드내역 업로드 시 별도 처리)

      // 매칭 규칙 찾기
      const matchedRule = findBestMatchingRule(tx, rules);

      if (tx.deposit > 0) {
        // 수입 거래: 우선순위 기반 키워드 매칭 (description + memo + detail)
        const offeringResult = determineIncomeOfferingCode(tx.memo, tx.detail, tx.deposit, tx.description);
        const income = createIncomeFromBankTransactionWithCode(
          tx,
          offeringResult.code,
          offeringResult.name,
          donors,
          now
        );

        // 키워드 매칭 성공 시 match 정보 생성
        const match: MatchingRule | null = offeringResult.matchedBy === 'keyword'
          ? {
              id: 'income_keyword',
              pattern: offeringResult.name,
              rule_type: 'bank_income',
              target_type: 'income',
              target_code: offeringResult.code,
              target_name: offeringResult.name,
              confidence: 1.0,
              usage_count: 0,
              created_at: now,
              updated_at: now,
            }
          : null;

        incomeRecords.push({ transaction: tx, record: income, match });
      } else if (tx.withdrawal > 0) {
        // 지출 거래
        // [1순위] detail 앞 2자리 숫자 추출 시도
        const extracted = extractAccountCodeFromDetail(tx.detail || '');

        if (extracted) {
          // 1순위 성공 → 추출된 코드로 지출 레코드 생성
          const expense = createExpenseFromExtractedCode(tx, extracted, now);
          const extractedMatch: MatchingRule = {
            id: 'detail_prefix',
            pattern: extracted.code.toString(),
            rule_type: 'bank_expense',
            target_type: 'expense',
            target_code: extracted.code,
            target_name: `코드${extracted.code}`,
            confidence: 1.0,
            usage_count: 0,
            created_at: now,
            updated_at: now,
          };
          expenseRecords.push({ transaction: tx, record: expense, match: extractedMatch });
        } else if (matchedRule && matchedRule.confidence >= 0.8) {
          // [2순위] 키워드 매칭 성공
          const expense = createExpenseFromBankTransaction(tx, matchedRule, now);
          expenseRecords.push({ transaction: tx, record: expense, match: matchedRule });
        } else {
          // [3순위] 매칭 실패 → 검토 필요
          const suggestions = getSuggestedRules(tx, rules, 3);
          needsReview.push({ transaction: tx, suggestions });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        income: incomeRecords,
        expense: expenseRecords,
        suppressed: suppressedTransactions,
        needsReview,
        cashOfferingMatchStatus,
      },
      summary: {
        incomeCount: incomeRecords.length,
        expenseCount: expenseRecords.length,
        suppressedCount: suppressedTransactions.length,
        needsReviewCount: needsReview.length,
      },
      message: `수입 ${incomeRecords.length}건, 지출 ${expenseRecords.length}건, 말소 ${suppressedTransactions.length}건, 검토필요 ${needsReview.length}건`,
    });
  } catch (error) {
    console.error('Auto match preview error:', error);
    return NextResponse.json(
      { success: false, error: '자동 매칭 미리보기 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 헌금함 거래 판별 (detail 좌측 3자리가 '헌금함'인 경우)
function isCashOfferingTransaction(tx: BankTransaction): boolean {
  const donorName = (tx.detail || '').substring(0, 3);
  return donorName === '헌금함';
}

// 매칭 규칙 찾기
function findBestMatchingRule(
  transaction: BankTransaction,
  rules: MatchingRule[]
): MatchingRule | null {
  let searchText: string;
  if (transaction.deposit > 0) {
    searchText = (transaction.memo || '').toLowerCase();
  } else {
    searchText = `${transaction.detail || ''} ${transaction.description || ''}`.toLowerCase();
  }

  let bestMatch: MatchingRule | null = null;
  let bestScore = 0;

  for (const rule of rules) {
    // 수입/지출 타입 체크
    if (transaction.deposit > 0 && rule.rule_type !== 'bank_income') continue;
    if (transaction.withdrawal > 0 && rule.rule_type !== 'bank_expense') continue;

    const score = calculateMatchScore(searchText, rule);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  return bestMatch;
}

// 매칭 점수 계산
function calculateMatchScore(searchText: string, rule: MatchingRule): number {
  if (searchText.includes(rule.pattern.toLowerCase())) {
    return rule.confidence;
  }
  return 0;
}

// 추천 규칙 조회
function getSuggestedRules(
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

// 헌금자명에서 대표자 조회
function findRepresentative(donorName: string, donors: DonorInfo[]): string {
  const donor = donors.find(d => d.donor_name === donorName);
  return donor?.representative || donorName;
}

// detail에서 헌금자명 추출 (좌측 3자리)
function extractDonorName(detail: string | undefined): string {
  if (!detail) return '';
  return detail.substring(0, 3);
}

// 수입 레코드 생성
function createIncomeFromBankTransaction(
  tx: BankTransaction,
  rule: MatchingRule,
  donors: DonorInfo[],
  now: string
): IncomeRecord {
  const donorName = extractDonorName(tx.detail) || tx.memo || rule.target_name;
  const representative = findRepresentative(donorName, donors);

  return {
    id: generateId('INC'),
    date: tx.date,
    source: '계좌이체',
    offering_code: rule.target_code,
    donor_name: donorName,
    representative: representative,
    amount: tx.deposit,
    note: `${tx.description} | ${tx.detail}`,
    input_method: '은행원장',
    created_at: now,
    created_by: 'auto_matcher',
    transaction_date: tx.transaction_date,
  };
}

// 기본 분류 수입 레코드 생성
function createIncomeFromBankTransactionWithCode(
  tx: BankTransaction,
  code: number,
  name: string,
  donors: DonorInfo[],
  now: string
): IncomeRecord {
  const donorName = extractDonorName(tx.detail) || name;
  const representative = findRepresentative(donorName, donors);

  return {
    id: generateId('INC'),
    date: tx.date,
    source: '계좌이체',
    offering_code: code,
    donor_name: donorName,
    representative: representative,
    amount: tx.deposit,
    note: `${tx.description} | ${tx.detail} (기본분류)`,
    input_method: '은행원장',
    created_at: now,
    created_by: 'auto_matcher',
    transaction_date: tx.transaction_date,
  };
}

// 지출 레코드 생성
function createExpenseFromBankTransaction(
  tx: BankTransaction,
  rule: MatchingRule,
  now: string
): ExpenseRecord {
  return {
    id: generateId('EXP'),
    date: tx.date,
    payment_method: '계좌이체',
    vendor: tx.memo || tx.detail || tx.description || '기타',
    description: '',
    amount: tx.withdrawal,
    account_code: rule.target_code,
    category_code: Math.floor(rule.target_code / 10) * 10,
    note: tx.detail || '',
    created_at: now,
    created_by: 'auto_matcher',
    transaction_date: tx.transaction_date,
  };
}

// 기본 수입 코드 결정
function getDefaultIncomeCode(amount: number): { code: number; name: string } {
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
function determineIncomeOfferingCode(
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
function extractAccountCodeFromDetail(detail: string): { code: number; rest: string } | null {
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

// detail에서 추출한 코드로 지출 레코드 생성 (1순위)
function createExpenseFromExtractedCode(
  tx: BankTransaction,
  extracted: { code: number; rest: string },
  now: string
): ExpenseRecord {
  return {
    id: generateId('EXP'),
    date: tx.date,
    payment_method: '계좌이체',
    vendor: tx.memo || '기타',
    description: '',
    amount: tx.withdrawal,
    account_code: extracted.code,
    category_code: Math.floor(extracted.code / 10) * 10,
    note: extracted.rest,  // "청소년부현수막2800"
    created_at: now,
    created_by: 'auto_matcher',
    transaction_date: tx.transaction_date,
  };
}
