import {
  getSheetData,
  getBankTransactions,
  getMatchingRules,
  addIncomeRecords,
  addExpenseRecords,
  updateBankTransaction,
  updateMatchingRule,
  addMatchingRule,
  getCardOwners,
  generateId,
  getKSTDateTime,
} from './google-sheets';
import type {
  BankTransaction,
  CardTransaction,
  IncomeRecord,
  ExpenseRecord,
  MatchingRule,
  CashOffering,
  AutoMatchResult,
  SyncResult,
  CardOwner,
} from '@/types';

// ============================================
// 1. 현금헌금 동기화 (중복 방지 포함)
// ============================================

export async function syncCashOfferingsWithDuplicatePrevention(
  cashOfferings: CashOffering[],
  startDate: string,
  endDate: string
): Promise<SyncResult> {
  const totalAmount = cashOfferings.reduce((sum, co) => sum + co.amount, 0);
  const warnings: string[] = [];
  let suppressedCount = 0;

  // 해당 기간의 은행 입금 내역 조회
  const allBankTransactions = await getBankTransactions();
  const bankDeposits = allBankTransactions.filter(tx =>
    tx.transaction_date >= startDate &&
    tx.transaction_date <= endDate &&
    tx.deposit > 0 &&
    !tx.suppressed &&
    tx.matched_status === 'pending'
  );

  // "헌금함" 키워드가 있는 입금 찾기
  const cashDepositCandidates = bankDeposits.filter(tx => {
    const text = `${tx.description || ''} ${tx.detail || ''} ${tx.memo || ''}`.toLowerCase();
    return text.includes('헌금함') || text.includes('헌금') || text.includes('현금');
  });

  // 금액이 일치하는 입금 찾기 (오차 1000원 허용)
  const matchingDeposit = cashDepositCandidates.find(tx =>
    Math.abs(tx.deposit - totalAmount) < 1000
  );

  if (matchingDeposit) {
    await updateBankTransaction(matchingDeposit.id, {
      matched_status: 'suppressed',
      matched_type: 'cash_offering_batch',
      suppressed: true,
      suppressed_reason: `현금헌금 합산 (${totalAmount.toLocaleString()}원), ${cashOfferings.length}건`,
    });
    suppressedCount = 1;
  } else if (totalAmount > 10000) {
    warnings.push(
      `현금헌금 합계 ${totalAmount.toLocaleString()}원과 일치하는 은행 입금을 찾지 못했습니다.`
    );
  }

  // 현금헌금을 수입부로 변환 및 저장
  const incomeRecords = cashOfferings.map(co => convertCashOfferingToIncome(co));
  await addIncomeRecords(incomeRecords);

  return {
    processed: incomeRecords.length,
    totalAmount,
    suppressedBankTransactions: suppressedCount,
    warnings,
  };
}

function convertCashOfferingToIncome(co: CashOffering): IncomeRecord {
  return {
    id: generateId('INC'),
    date: co.date,
    source: '헌금함',
    offering_code: co.code,
    donor_name: co.donor_name,
    representative: co.donor_name,
    amount: co.amount,
    note: co.note,
    input_method: '현금헌금',
    created_at: getKSTDateTime(),
    created_by: 'cash_sync',
  };
}

// ============================================
// 2. 카드결제 중복 방지
// ============================================

interface CardRegistrationResult {
  processed: number;
  totalAmount: number;
  suppressedBankTransactions: number;
  needsDetailsCount: number;
  warnings: string[];
}

export async function registerCardTransactionsWithDuplicatePrevention(
  cardTransactions: CardTransaction[],
  billingDate: string
): Promise<CardRegistrationResult> {
  const cardOwners = await getCardOwners();
  const warnings: string[] = [];
  let suppressedCount = 0;

  // 카드 소유자 매핑
  const mappedTransactions = cardTransactions.map(ct => ({
    ...ct,
    card_owner: findCardOwner(ct.card_number, cardOwners),
  }));

  const totalAmount = mappedTransactions.reduce((sum, ct) => sum + ct.sale_amount, 0);

  // 해당 청구일 전후 30일 내의 은행 출금 조회
  const searchStartDate = addDays(billingDate, -30);
  const searchEndDate = addDays(billingDate, 30);

  const allBankTransactions = await getBankTransactions();
  const bankWithdrawals = allBankTransactions.filter(tx =>
    tx.transaction_date >= searchStartDate &&
    tx.transaction_date <= searchEndDate &&
    tx.withdrawal > 0 &&
    !tx.suppressed &&
    tx.matched_status === 'pending'
  );

  // 카드 관련 출금 찾기
  const cardPaymentCandidates = bankWithdrawals.filter(tx => {
    const text = `${tx.description || ''}`.toLowerCase();
    return text.includes('nh카드') ||
      text.includes('신용카드') ||
      text.includes('체크카드') ||
      text.includes('카드결제') ||
      text.includes('카드대금');
  });

  // 금액이 일치하는 출금 찾기
  const matchingWithdrawal = cardPaymentCandidates.find(tx =>
    Math.abs(tx.withdrawal - totalAmount) < 1000
  );

  if (matchingWithdrawal) {
    await updateBankTransaction(matchingWithdrawal.id, {
      matched_status: 'suppressed',
      matched_type: 'card_payment_batch',
      suppressed: true,
      suppressed_reason: `카드결제 합산 (${totalAmount.toLocaleString()}원), 청구일: ${billingDate}`,
    });
    suppressedCount = 1;
  } else {
    warnings.push(
      `카드결제 합계 ${totalAmount.toLocaleString()}원과 일치하는 은행 출금을 찾지 못했습니다.`
    );
  }

  const needsDetailsCount = mappedTransactions.filter(ct => !ct.detail_completed).length;

  return {
    processed: mappedTransactions.length,
    totalAmount,
    suppressedBankTransactions: suppressedCount,
    needsDetailsCount,
    warnings,
  };
}

// ============================================
// 3. 자동 매칭 엔진
// ============================================

export async function autoMatchBankTransactions(): Promise<AutoMatchResult> {
  const rules = await getMatchingRules();
  const allTransactions = await getBankTransactions();
  const unmatchedTransactions = allTransactions.filter(tx =>
    tx.matched_status === 'pending' && !tx.suppressed
  );

  const result: AutoMatchResult = {
    autoMatched: [],
    suppressed: [],
    needsReview: [],
  };

  for (const tx of unmatchedTransactions) {
    // 말소 대상 체크
    if (shouldSuppressTransaction(tx)) {
      result.suppressed.push(tx);
      await updateBankTransaction(tx.id, {
        matched_status: 'suppressed',
        suppressed: true,
        suppressed_reason: '자동 말소 (헌금함/카드결제)',
      });
      continue;
    }

    // 매칭 규칙 찾기
    const matchedRule = findBestMatchingRule(tx, rules);

    if (matchedRule && matchedRule.confidence >= 0.8) {
      // 신뢰도 80% 이상 → 자동 매칭
      if (tx.deposit > 0) {
        const income = createIncomeFromBankTransaction(tx, matchedRule);
        await addIncomeRecords([income]);
        await updateBankTransaction(tx.id, {
          matched_status: 'matched',
          matched_type: 'income_detail',
          matched_ids: income.id,
        });
        await incrementRuleUsage(matchedRule.id);
        result.autoMatched.push({ transaction: tx, match: matchedRule, record: income });
      } else if (tx.withdrawal > 0) {
        const expense = createExpenseFromBankTransaction(tx, matchedRule);
        await addExpenseRecords([expense]);
        await updateBankTransaction(tx.id, {
          matched_status: 'matched',
          matched_type: 'expense_detail',
          matched_ids: expense.id,
        });
        await incrementRuleUsage(matchedRule.id);
        result.autoMatched.push({ transaction: tx, match: matchedRule, record: expense });
      }
    } else {
      // 신뢰도 낮음 → 수동 검토
      const suggestions = getSuggestedRules(tx, rules, 3);
      result.needsReview.push({ transaction: tx, suggestions });
    }
  }

  return result;
}

function findBestMatchingRule(
  transaction: BankTransaction,
  rules: MatchingRule[]
): MatchingRule | null {
  const searchText = `${transaction.description || ''} ${transaction.detail || ''} ${transaction.memo || ''}`.toLowerCase();

  let bestMatch: MatchingRule | null = null;
  let bestScore = 0;

  for (const rule of rules) {
    const score = calculateMatchScore(searchText, rule);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  return bestMatch;
}

function calculateMatchScore(searchText: string, rule: MatchingRule): number {
  const pattern = rule.pattern.toLowerCase();

  // 완전 일치
  if (searchText.includes(pattern)) {
    return rule.confidence;
  }

  // 정규식 매칭
  try {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(searchText)) {
      return rule.confidence * 0.95;
    }
  } catch {
    // 정규식 오류 무시
  }

  // 부분 일치
  const words = pattern.split(/\s+/);
  const matchedWords = words.filter(word => searchText.includes(word));
  if (words.length > 0 && matchedWords.length / words.length >= 0.7) {
    return rule.confidence * 0.8;
  }

  return 0;
}

function getSuggestedRules(
  transaction: BankTransaction,
  rules: MatchingRule[],
  limit: number
): MatchingRule[] {
  const searchText = `${transaction.description || ''} ${transaction.detail || ''} ${transaction.memo || ''}`.toLowerCase();

  return rules
    .map(rule => ({ rule, score: calculateMatchScore(searchText, rule) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.rule);
}

function shouldSuppressTransaction(tx: BankTransaction): boolean {
  const text = `${tx.description || ''} ${tx.detail || ''} ${tx.memo || ''}`.toLowerCase();

  // 입금: 헌금함
  if (tx.deposit > 0) {
    if (text.includes('헌금함') || (text.includes('헌금') && text.includes('합산'))) {
      return true;
    }
  }

  // 출금: 카드결제
  if (tx.withdrawal > 0) {
    if (text.includes('nh카드') || text.includes('신용카드') || text.includes('체크카드') || text.includes('카드대금')) {
      return true;
    }
  }

  return false;
}

function createIncomeFromBankTransaction(
  tx: BankTransaction,
  rule: MatchingRule
): IncomeRecord {
  return {
    id: generateId('INC'),
    date: tx.transaction_date,
    source: '계좌이체',
    offering_code: rule.target_code,
    donor_name: tx.detail || rule.target_name,
    representative: tx.detail || rule.target_name,
    amount: tx.deposit,
    note: `${tx.description} | ${tx.detail}`,
    input_method: '은행원장',
    created_at: getKSTDateTime(),
    created_by: 'auto_matcher',
  };
}

function createExpenseFromBankTransaction(
  tx: BankTransaction,
  rule: MatchingRule
): ExpenseRecord {
  return {
    id: generateId('EXP'),
    date: tx.transaction_date,
    payment_method: '계좌이체',
    vendor: tx.detail || tx.description || '기타',
    description: tx.detail || tx.description || '',
    amount: tx.withdrawal,
    account_code: rule.target_code,
    category_code: Math.floor(rule.target_code / 10) * 10,
    note: tx.description || '',
    created_at: getKSTDateTime(),
    created_by: 'auto_matcher',
  };
}

async function incrementRuleUsage(ruleId: string): Promise<void> {
  const rules = await getMatchingRules();
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    await updateMatchingRule(ruleId, {
      usage_count: rule.usage_count + 1,
      updated_at: getKSTDateTime(),
    });
  }
}

// ============================================
// 4. 학습 기능
// ============================================

export async function learnFromManualMatch(
  transaction: BankTransaction,
  classification: {
    type: 'income' | 'expense';
    code: number;
    name: string;
  }
): Promise<void> {
  const searchText = `${transaction.description || ''} ${transaction.detail || ''}`;
  const pattern = extractKeyPattern(searchText);

  const rules = await getMatchingRules();
  const existingRule = rules.find(rule =>
    rule.pattern === pattern && rule.target_code === classification.code
  );

  if (existingRule) {
    await updateMatchingRule(existingRule.id, {
      usage_count: existingRule.usage_count + 1,
      confidence: Math.min(1.0, existingRule.confidence + 0.05),
      updated_at: getKSTDateTime(),
    });
  } else {
    const newRule: Omit<MatchingRule, 'id'> = {
      rule_type: transaction.deposit > 0 ? 'bank_income' : 'bank_expense',
      pattern,
      target_type: classification.type,
      target_code: classification.code,
      target_name: classification.name,
      confidence: 0.7,
      usage_count: 1,
      created_at: getKSTDateTime(),
      updated_at: getKSTDateTime(),
    };
    await addMatchingRule(newRule);
  }
}

function extractKeyPattern(text: string): string {
  let pattern = text;

  // 숫자 제거
  pattern = pattern.replace(/\d+/g, '');

  // 은행명 제거
  const bankNames = ['국민', '신한', '우리', '하나', '농협', 'NH', 'KB', 'SC'];
  for (const bank of bankNames) {
    pattern = pattern.replace(new RegExp(bank, 'gi'), '');
  }

  // 거래 유형 제거
  const transactionTypes = ['G-', 'S-', 'E-', 'PC', '폰', 'NH콕송금', '오픈뱅킹'];
  for (const type of transactionTypes) {
    pattern = pattern.replace(type, '');
  }

  // 특수문자 및 공백 정리
  pattern = pattern.replace(/[^\w\sㄱ-ㅎ가-힣]/g, ' ');
  pattern = pattern.trim().replace(/\s+/g, ' ');

  // 너무 길면 핵심만 추출
  if (pattern.length > 15) {
    pattern = pattern.substring(0, 15);
  }

  return pattern || text.substring(0, 10);
}

// ============================================
// 헬퍼 함수
// ============================================

function findCardOwner(cardNumber: string, owners: CardOwner[]): string {
  const owner = owners.find(o => o.card_number === cardNumber);
  return owner?.owner_name || '미지정';
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
