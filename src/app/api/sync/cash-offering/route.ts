import { NextRequest, NextResponse } from 'next/server';
import { fetchCashOfferings, generateId, getKSTDateTime, getWeekEndingSunday, bulkUpdateCashOfferingEntriesStatus, replaceCashOfferingTotal } from '@/lib/google-sheets';
import { syncCashOfferingsWithDuplicatePrevention } from '@/lib/matching-engine';
import { invalidateYearCache } from '@/lib/redis';
import type { IncomeRecord } from '@/types';

interface PreviewData {
  rowIndex?: number; // 헌금함입력 시트의 행 번호 (sync 후 status 업데이트용)
  date: string;
  source: string;
  donor_name: string;
  representative: string;
  amount: number;
  code: number;
  item: string;
  category_code: number;
  note: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, previewData } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '시작일과 종료일을 입력하세요' },
        { status: 400 }
      );
    }

    // previewData가 있으면 직접 사용 (미리보기 후 확정 방식)
    if (previewData && Array.isArray(previewData) && previewData.length > 0) {
      const totalAmount = previewData.reduce((sum: number, item: PreviewData) => sum + item.amount, 0);
      const warnings: string[] = [];

      // 헌금함 입금 자동 말소는 BankUpload → /api/match/auto 단계에서
      // 'cash_offering_batch'로 동일하게 처리됨. 이중 처리 방지를 위해 sync에선 생략.
      // (운영 순서: 헌금함 sync 먼저 → 은행원장 업로드 → 매칭 시 헌금함 입금 자동 말소)

      // previewData를 수입부 레코드로 변환
      const incomeRecords: IncomeRecord[] = previewData.map((item: PreviewData) => ({
        id: generateId('INC'),
        date: getWeekEndingSunday(item.date), // 기준일 (주일)
        source: '헌금함',
        offering_code: item.code,
        donor_name: item.donor_name,
        representative: item.representative,
        amount: item.amount,
        note: item.note,
        input_method: '현금헌금',
        created_at: getKSTDateTime(),
        created_by: 'cash_sync',
        transaction_date: item.date, // 실제 거래일
      }));

      // 안 β: addIncomeRecords 를 주(week) 단위 replaceCashOfferingTotal 로 치환
      // (은행원장 자동 이관으로 이미 존재하는 헌금함 총액 행을 세부로 대체)
      const byWeek = new Map<string, IncomeRecord[]>();
      for (const rec of incomeRecords) {
        const w = rec.date; // 이미 getWeekEndingSunday 결과
        const bucket = byWeek.get(w);
        if (bucket) bucket.push(rec);
        else byWeek.set(w, [rec]);
      }

      const replaceResult: Array<{
        week: string;
        replaced: boolean;
        aggregateDeleted: number;
        detailsAdded: number;
        aggregateAmount: number;
        detailsAmount: number;
      }> = [];

      for (const [week, recs] of byWeek) {
        try {
          const r = await replaceCashOfferingTotal(week, recs);
          replaceResult.push({ week, ...r });
        } catch (err) {
          console.error(`[sync/cash-offering] ${week} 주 대체 실패:`, err);
          warnings.push(`${week} 주 대체 실패: ${(err as Error).message}`);
        }
      }

      // 헌금함입력 시트의 status를 'synced'로 일괄 업데이트 + synced_to_inc_id 기록
      // (rowIndex 있는 항목만, 즉 신규 헌금함입력 시트에서 온 entries만)
      // 35건도 단일 batchUpdate로 처리 → API 호출 70회 → 2회로 quota 절약
      let statusUpdatedCount = 0;
      const updatedAt = getKSTDateTime();
      const statusUpdates = previewData
        .map((item, i) => {
          if (!item.rowIndex) return null;
          return {
            rowIndex: item.rowIndex,
            status: 'synced' as const,
            synced_to_inc_id: incomeRecords[i].id,
            updated_at: updatedAt,
          };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      if (statusUpdates.length > 0) {
        try {
          await bulkUpdateCashOfferingEntriesStatus(statusUpdates);
          statusUpdatedCount = statusUpdates.length;
        } catch (err) {
          console.error('[sync/cash-offering] bulk status 업데이트 실패:', err);
          // 부분 실패 허용 — 수입부에는 이미 반영됨, 헌금함입력 status만 못 바꿈
          warnings.push(`헌금함입력 시트 status 일괄 업데이트 실패 (수입부엔 반영됨): ${(err as Error).message}`);
        }
      }

      // 캐시 무효화 (데이터 변경 반영)
      const year = parseInt(startDate.substring(0, 4), 10);
      await invalidateYearCache(year);

      return NextResponse.json({
        success: true,
        processed: incomeRecords.length,
        totalAmount,
        suppressedBankTransactions: 0, // sync 단계에선 자동말소 안 함 (매칭 단계에 일임)
        statusUpdatedCount,
        warnings,
        replaceResult,
        message: `${incomeRecords.length}건 세부 대체 완료 (주 ${replaceResult.length}개, status 업데이트: ${statusUpdatedCount}건)`,
      });
    }

    // previewData가 없으면 기존 방식 (구글시트에서 직접 조회)
    const cashOfferings = await fetchCashOfferings(startDate, endDate);

    if (cashOfferings.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        totalAmount: 0,
        suppressedBankTransactions: 0,
        warnings: [],
        message: '해당 기간에 현금헌금이 없습니다',
      });
    }

    // 동기화 실행
    const result = await syncCashOfferingsWithDuplicatePrevention(
      cashOfferings,
      startDate,
      endDate
    );

    // 캐시 무효화 (데이터 변경 반영)
    if (result.processed > 0) {
      const year = parseInt(startDate.substring(0, 4), 10);
      await invalidateYearCache(year);
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.processed}건의 현금헌금이 동기화되었습니다`,
    });
  } catch (error) {
    console.error('Cash offering sync error:', error);
    return NextResponse.json(
      { success: false, error: '현금헌금 동기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
