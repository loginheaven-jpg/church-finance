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
        // 수입 거래
        let income: IncomeRecord;
        let match: MatchingRule | null = null;

        if (matchedRule && matchedRule.confidence >= 0.8) {
          income = createIncomeFromBankTransaction(tx, matchedRule, donors, now);
          match = matchedRule;
        } else {
          // 기본 분류 로직 적용
          const defaultCode = getDefaultIncomeCode(tx.deposit);
          income = createIncomeFromBankTransactionWithCode(tx, defaultCode.code, defaultCode.name, donors, now);
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
