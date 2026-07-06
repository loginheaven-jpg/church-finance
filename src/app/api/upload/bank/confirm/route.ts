import { NextRequest, NextResponse } from 'next/server';
import {
  addBankTransactions,
  getWeekEndingSunday,
  autoTransferBankToLedger,
} from '@/lib/google-sheets';
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
    let transferResult: {
      income: { added: number; skipped: number; ids: string[] };
      expense: { added: number; skipped: number; ids: string[] };
    } | null = null;
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
      return NextResponse.json({
        success: true,
        uploaded: sanitized.length,
        transferred: {
          income: transferResult.income.added,
          incomeSkipped: transferResult.income.skipped,
          expense: transferResult.expense.added,
          expenseSkipped: transferResult.expense.skipped,
        },
        message: `은행 ${sanitized.length}건 저장 · 수입 ${transferResult.income.added}건 · 지출 ${transferResult.expense.added}건 자동 이관`,
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
