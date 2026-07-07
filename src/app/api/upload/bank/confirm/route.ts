import { NextRequest, NextResponse } from 'next/server';
import {
  addBankTransactions,
  getWeekEndingSunday,
  autoTransferBankToLedger,
} from '@/lib/google-sheets';
import { verifyBankLedgerIntegrity, repairOrphanBankPending } from '@/lib/integrity';
import { invalidateYearCache } from '@/lib/redis';
import type { BankTransaction } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: '저장할 데이터가 없습니다' },
        { status: 400 }
      );
    }

    // 안 α (K3): client 페이로드 신뢰 제거 — date 재계산 + 매칭상태 초기화 강제
    const sanitized = (transactions as BankTransaction[]).map(t => ({
      ...t,
      date: getWeekEndingSunday(t.transaction_date),
      matched_status: 'pending' as const,
      matched_type: '',
      matched_ids: '',
      suppressed: false,
      suppressed_reason: '',
    }));

    // 1) 은행원장 append (K1 강제)
    await addBankTransactions(sanitized);

    // 2) 안 β: 자동 이관 (수입부/지출부 총액 append)
    //    실패해도 은행원장 저장은 이미 성공한 상태 — warn 로그 남기고 부분 결과 반환
    let transferResult: Awaited<ReturnType<typeof autoTransferBankToLedger>> | null = null;
    let transferError: string | null = null;
    try {
      transferResult = await autoTransferBankToLedger(sanitized);
    } catch (err) {
      console.error('[bank/confirm] autoTransferBankToLedger 실패:', err);
      transferError = (err as Error).message;
    }

    // 3) 캐시 무효화 — 은행 tx date(주일)의 연도별 그룹핑
    const years = new Set(sanitized.map(t => parseInt(t.date.substring(0, 4), 10)));
    for (const y of years) {
      try {
        await invalidateYearCache(y);
      } catch (cacheErr) {
        console.warn(`[bank/confirm] invalidateYearCache(${y}) 실패:`, cacheErr);
      }
    }

    if (transferResult) {
      // β⁵ (2026-07-07): 이관 직후 정합성 검증 + 자동 복구
      // 이관 범위 = 이번에 저장된 tx 의 transaction_date 최소/최대
      let integrityReport: Awaited<ReturnType<typeof verifyBankLedgerIntegrity>> | null = null;
      let repairResult: Awaited<ReturnType<typeof repairOrphanBankPending>> | null = null;
      try {
        const dates = sanitized.map(t => t.transaction_date).filter(Boolean).sort();
        if (dates.length > 0) {
          const from = dates[0];
          const to = dates[dates.length - 1];
          integrityReport = await verifyBankLedgerIntegrity(from, to);
          // orphanBankPending 있으면 자동 복구 (β⁵: append 성공했는데 status 갱신 실패한 경우)
          if (integrityReport.orphanBankPending.length > 0) {
            repairResult = await repairOrphanBankPending(integrityReport);
            console.log(
              `[bank/confirm] 정합성 자동 복구: ${repairResult.success.length}건 성공, ${repairResult.failed.length}건 실패`
            );
          }
        }
      } catch (integrityErr) {
        console.warn('[bank/confirm] 정합성 검증/복구 실패 (이관 자체는 성공):', integrityErr);
      }

      return NextResponse.json({
        success: true,
        uploaded: sanitized.length,
        transferred: {
          income: transferResult.income.added,
          incomeSkipped: transferResult.income.skipped,
          expense: transferResult.expense.added,
          expenseSkipped: transferResult.expense.skipped,
        },
        needsReview: transferResult.needsReview,
        // β⁵: 자동 이관 후 status 갱신 실패한 tx (autoTransferBankToLedger 내부에서 부분 실패)
        failedBankUpdates: transferResult.failedBankUpdates,
        // β⁵: 정합성 리포트 (autoTransferBankToLedger 실행 후 실 상태)
        integrity: integrityReport
          ? {
              orphanBankPending: integrityReport.orphanBankPending.length,
              orphanLedgerMissing: integrityReport.orphanLedgerMissing.length,
              mismatched: integrityReport.mismatched.length,
              repaired: repairResult?.success.length ?? 0,
              repairFailed: repairResult?.failed.length ?? 0,
            }
          : null,
        message: `은행 ${sanitized.length}건 저장 · 수입 ${transferResult.income.added}건 · 지출 ${transferResult.expense.added}건 자동 이관 · 검토필요 ${transferResult.needsReview.length}건${repairResult && repairResult.success.length > 0 ? ` · 정합 자동복구 ${repairResult.success.length}건` : ''}`,
      });
    }

    return NextResponse.json({
      success: true,
      uploaded: sanitized.length,
      transferred: null,
      warning: `은행 저장 성공 · 자동 이관 실패: ${transferError}`,
      message: `${sanitized.length}건의 은행 거래가 저장되었습니다 (자동 이관 실패 — 수동 확인 필요)`,
    });
  } catch (error) {
    console.error('Bank confirm error:', error);
    return NextResponse.json(
      { success: false, error: '은행원장 저장/이관 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
