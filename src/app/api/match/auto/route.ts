import { NextRequest, NextResponse } from 'next/server';
import {
  getBankTransactions,
  getMatchingRules,
  getIncomeRecords,
  getDonorInfo,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import {
  isCashOfferingTransaction,
  findBestMatchingRule,
  getSuggestedRules,
  findRepresentative,
  extractDonorName,
  determineIncomeOfferingCode,
  extractAccountCodeFromDetail,
} from '@/lib/matching-helpers';
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
    note: `${tx.description} | ${tx.detail}`,
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
