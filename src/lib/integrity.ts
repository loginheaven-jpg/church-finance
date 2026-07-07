// 은행원장 ↔ 수입부/지출부 정합성 검증 유틸리티 (2026-07-07 β⁵)
//
// 목적:
//   1. autoTransferBankToLedger 처럼 append 는 성공했지만 은행원장 status 갱신 실패한
//      orphan tx (bank pending 인데 ledger 에 marker record 있음) 자동 감지
//   2. status matched 인데 ledger 에 record 없는 반대 orphan 감지
//   3. 금액 불일치 감지
//   4. 자동 복구 (repairOrphanBankPending)
//
// 이 유틸은 다음 케이스 재발 방지 용도:
//   - 원인 A: autoTransferBankToLedger 가 은행원장 status 를 갱신하지 않음
//   - 원인 B: cashOfferingByDate 콤마 파싱 실패 → 헌금함 자동 흡수 무력화
//
// 사용처:
//   - /api/upload/bank/confirm 응답에 실시간 정합성 결과 첨부
//   - /api/verify/integrity (admin) 에서 정합성 리포트 + 자동 복구
//   - 대시보드 정합 배지 (선택)

import { readSheet, updateBankTransactionsBatch, FINANCE_CONFIG } from './google-sheets';

export interface IntegrityReport {
  scope: { from: string; to: string };
  totalBankTxs: number;
  // 은행 pending 인데 수입부/지출부 에 [bank:xxx] marker 있음
  // → status 갱신만 실패. 자동 복구 가능.
  orphanBankPending: Array<{
    bankId: string;
    transaction_date: string;
    kind: 'income' | 'expense';
    ledgerRecordId: string;
    amount: number;
  }>;
  // 은행 matched 인데 수입부/지출부 에 record 없음
  // → 강제 갱신 실수 or 이관 후 삭제된 것. 원복 or 확인 필요.
  orphanLedgerMissing: Array<{
    bankId: string;
    transaction_date: string;
    matched_type: string;
    amount: number;
    reason: string;
  }>;
  // 헌금함 mismatched (금액 불일치)
  mismatched: Array<{
    bankId: string;
    transaction_date: string;
    bankAmount: number;
    ledgerAmount: number;
    kind: 'income' | 'expense';
  }>;
}

function parseAmount(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    return parseFloat(v.replace(/[,원\s]/g, '')) || 0;
  }
  return 0;
}

function extractBankIdFromNote(note: string): string | null {
  const m = /\[bank:([^\]]+)\]|bank=(BANK[A-Za-z0-9]+)/.exec(note || '');
  if (!m) return null;
  return m[1] || m[2] || null;
}

/**
 * 은행원장 ↔ 수입부/지출부 정합성 검증.
 *
 * @param from transaction_date 최소값 (포함), 예: '2026-06-29'
 * @param to   transaction_date 최대값 (포함), 예: '2026-07-07'
 */
export async function verifyBankLedgerIntegrity(
  from: string,
  to: string
): Promise<IntegrityReport> {
  const [bankRows, incomeRows, expenseRows] = await Promise.all([
    readSheet(FINANCE_CONFIG.sheets.bank),
    readSheet(FINANCE_CONFIG.sheets.income),
    readSheet(FINANCE_CONFIG.sheets.expense),
  ]);

  // 은행원장 컬럼 인덱스: A id / B transaction_date / D withdrawal / E deposit
  //   / L matched_status(11) / M matched_type(12) / N matched_ids(13) / O suppressed(14)

  // 1. 수입부/지출부 note 에서 bank id → record 매핑
  const incomeByBankId = new Map<string, { recordId: string; amount: number; rowIdx: number }>();
  for (let i = 1; i < incomeRows.length; i++) {
    const row = incomeRows[i];
    const bankId = extractBankIdFromNote(String(row?.[7] || ''));
    if (!bankId) continue;
    incomeByBankId.set(bankId, {
      recordId: String(row?.[0] || ''),
      amount: parseAmount(row?.[6]),
      rowIdx: i + 1,
    });
  }
  const expenseByBankId = new Map<string, { recordId: string; amount: number; rowIdx: number }>();
  for (let i = 1; i < expenseRows.length; i++) {
    const row = expenseRows[i];
    const bankId = extractBankIdFromNote(String(row?.[8] || ''));
    if (!bankId) continue;
    expenseByBankId.set(bankId, {
      recordId: String(row?.[0] || ''),
      amount: parseAmount(row?.[5]),
      rowIdx: i + 1,
    });
  }

  const report: IntegrityReport = {
    scope: { from, to },
    totalBankTxs: 0,
    orphanBankPending: [],
    orphanLedgerMissing: [],
    mismatched: [],
  };

  // 2. 은행원장 tx 순회 (범위 필터)
  for (let i = 1; i < bankRows.length; i++) {
    const r = bankRows[i];
    const bankId = String(r?.[0] || '');
    const txDate = String(r?.[1] || '');
    if (!bankId || !txDate) continue;
    if (txDate < from || txDate > to) continue;

    report.totalBankTxs++;

    const status = String(r?.[11] || '');
    const matchedType = String(r?.[12] || '');
    const suppressedRaw = r?.[14];
    const suppressed = suppressedRaw === 'TRUE' || String(suppressedRaw) === 'true';
    const withdrawal = parseAmount(r?.[3]);
    const deposit = parseAmount(r?.[4]);
    const bankAmount = deposit > 0 ? deposit : withdrawal;

    const inLedgerIncome = incomeByBankId.get(bankId);
    const inLedgerExpense = expenseByBankId.get(bankId);
    const inLedger = inLedgerIncome || inLedgerExpense;
    const inLedgerKind: 'income' | 'expense' | null = inLedgerIncome
      ? 'income'
      : inLedgerExpense
        ? 'expense'
        : null;

    // 케이스 A: status='pending' 이고 !suppressed 인데 ledger 에 marker 있음
    //   → 자동 이관 성공했지만 status 갱신만 실패. 자동 복구 가능.
    if (status === 'pending' && !suppressed && inLedger) {
      report.orphanBankPending.push({
        bankId,
        transaction_date: txDate,
        kind: inLedgerKind!,
        ledgerRecordId: inLedger.recordId,
        amount: bankAmount,
      });
    }

    // 케이스 B: status='matched' 인데 ledger 에 record 없음
    //   → append 실패 or 사후 삭제. 확인 필요.
    if (status === 'matched' && !inLedger) {
      report.orphanLedgerMissing.push({
        bankId,
        transaction_date: txDate,
        matched_type: matchedType,
        amount: bankAmount,
        reason: 'status=matched 이지만 수입부/지출부 에 marker 매치되는 record 없음',
      });
    }

    // 케이스 C: ledger 에 있는데 금액 불일치
    if (inLedger && Math.abs(inLedger.amount - bankAmount) >= 1) {
      report.mismatched.push({
        bankId,
        transaction_date: txDate,
        bankAmount,
        ledgerAmount: inLedger.amount,
        kind: inLedgerKind!,
      });
    }
  }

  return report;
}

/**
 * orphanBankPending 을 status=matched 로 소급 갱신.
 * append 는 이미 있으므로 record 생성은 하지 않음. status 만 갱신.
 *
 * @returns 갱신 성공/실패 id 목록
 */
export async function repairOrphanBankPending(
  report: IntegrityReport
): Promise<{ success: string[]; failed: string[] }> {
  if (report.orphanBankPending.length === 0) {
    return { success: [], failed: [] };
  }

  const updates = report.orphanBankPending.map(o => ({
    id: o.bankId,
    matched_status: 'matched' as const,
    matched_type: o.kind === 'income' ? 'income_auto' : 'expense_auto',
    matched_ids: o.ledgerRecordId,
  }));

  return await updateBankTransactionsBatch(updates);
}
