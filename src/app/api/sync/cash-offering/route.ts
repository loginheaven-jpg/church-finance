import { NextRequest, NextResponse } from 'next/server';
import { fetchCashOfferings, addIncomeRecords, getBankTransactions, updateBankTransaction, generateId, getKSTDateTime } from '@/lib/google-sheets';
import { syncCashOfferingsWithDuplicatePrevention } from '@/lib/matching-engine';
import type { IncomeRecord } from '@/types';

interface PreviewData {
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
      let suppressedCount = 0;

      // 해당 기간의 은행 입금 내역 조회 (말소용)
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
          suppressed_reason: `현금헌금 합산 (${totalAmount.toLocaleString()}원), ${previewData.length}건`,
        });
        suppressedCount = 1;
      } else if (totalAmount > 10000) {
        warnings.push(
          `현금헌금 합계 ${totalAmount.toLocaleString()}원과 일치하는 은행 입금을 찾지 못했습니다.`
        );
      }

      // previewData를 수입부 레코드로 변환
      const incomeRecords: IncomeRecord[] = previewData.map((item: PreviewData) => ({
        id: generateId('INC'),
        date: item.date,
        source: '헌금함',
        offering_code: item.code,
        donor_name: item.donor_name,
        representative: item.representative,
        amount: item.amount,
        note: item.note,
        input_method: '현금헌금',
        created_at: getKSTDateTime(),
        created_by: 'cash_sync',
      }));

      await addIncomeRecords(incomeRecords);

      return NextResponse.json({
        success: true,
        processed: incomeRecords.length,
        totalAmount,
        suppressedBankTransactions: suppressedCount,
        warnings,
        message: `${incomeRecords.length}건의 현금헌금이 동기화되었습니다`,
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
