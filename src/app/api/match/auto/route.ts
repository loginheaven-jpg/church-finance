import { NextRequest, NextResponse } from 'next/server';
import {
  getBankTransactions,
  getMatchingRules,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import type {
  BankTransaction,
  IncomeRecord,
  ExpenseRecord,
  MatchingRule,
} from '@/types';

// 미리보기용 매칭 결과 생성 (저장하지 않음)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { transactionIds } = body as { transactionIds?: string[] };

    const rules = await getMatchingRules();
    const allTransactions = await getBankTransactions();

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
      // 말소 대상 체크
      if (shouldSuppressTransaction(tx)) {
        suppressedTransactions.push({
          ...tx,
          suppressed_reason: '자동 말소 (헌금함/카드결제)',
        });
        continue;
      }

      // 매칭 규칙 찾기
      const matchedRule = findBestMatchingRule(tx, rules);

      if (tx.deposit > 0) {
        // 수입 거래
        let income: IncomeRecord;
        let match: MatchingRule | null = null;

        if (matchedRule && matchedRule.confidence >= 0.8) {
          income = createIncomeFromBankTransaction(tx, matchedRule, now);
          match = matchedRule;
        } else {
          // 기본 분류 로직 적용
          const defaultCode = getDefaultIncomeCode(tx.deposit);
          income = createIncomeFromBankTransactionWithCode(tx, defaultCode.code, defaultCode.name, now);
        }

        incomeRecords.push({ transaction: tx, record: income, match });
      } else if (tx.withdrawal > 0) {
        // 지출 거래
        if (matchedRule && matchedRule.confidence >= 0.8) {
          const expense = createExpenseFromBankTransaction(tx, matchedRule, now);
          expenseRecords.push({ transaction: tx, record: expense, match: matchedRule });
        } else {
          // 낮은 신뢰도 → 검토 필요
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

// 말소 대상 판별
function shouldSuppressTransaction(tx: BankTransaction): boolean {
  const text = `${tx.description || ''} ${tx.detail || ''} ${tx.memo || ''}`.toLowerCase();

  // 헌금함 입금 (현금헌금으로 별도 처리)
  if (tx.deposit > 0 && (text.includes('헌금함') || text.includes('현금입금'))) {
    return true;
  }

  // 카드결제 출금 (카드내역으로 별도 처리)
  if (tx.withdrawal > 0 && (
    text.includes('nh카드') ||
    text.includes('신용카드') ||
    text.includes('체크카드') ||
    text.includes('카드결제') ||
    text.includes('카드대금')
  )) {
    return true;
  }

  return false;
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

// 수입 레코드 생성
function createIncomeFromBankTransaction(
  tx: BankTransaction,
  rule: MatchingRule,
  now: string
): IncomeRecord {
  return {
    id: generateId('INC'),
    date: tx.date,
    source: '계좌이체',
    offering_code: rule.target_code,
    donor_name: tx.detail || tx.memo || rule.target_name,
    representative: tx.detail || tx.memo || rule.target_name,
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
  now: string
): IncomeRecord {
  return {
    id: generateId('INC'),
    date: tx.date,
    source: '계좌이체',
    offering_code: code,
    donor_name: tx.detail || name,
    representative: tx.detail || name,
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
    description: tx.detail || tx.description || '',
    amount: tx.withdrawal,
    account_code: rule.target_code,
    category_code: Math.floor(rule.target_code / 10) * 10,
    note: tx.description || '',
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
