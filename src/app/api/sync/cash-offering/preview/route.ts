import { NextRequest, NextResponse } from 'next/server';
import { fetchCashOfferings, getDonorInfo, getIncomeRecords } from '@/lib/google-sheets';

// 중복 체크용 키 생성: date + donor_name + amount
function getDuplicateKey(date: string, donorName: string, amount: number): string {
  return `${date}|${donorName}|${amount}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '시작일과 종료일을 입력하세요' },
        { status: 400 }
      );
    }

    // 현금헌금 조회
    const cashOfferings = await fetchCashOfferings(startDate, endDate);

    if (cashOfferings.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        donorMap: {},
        existingKeys: [],
        message: '해당 기간에 현금헌금이 없습니다',
      });
    }

    // 헌금자정보 조회하여 donor_name → representative 매핑 생성
    const donorInfoList = await getDonorInfo();
    const donorMap: Record<string, string> = {};
    for (const info of donorInfoList) {
      if (info.donor_name && info.representative) {
        donorMap[info.donor_name] = info.representative;
      }
    }

    // 기존 수입부에서 헌금함 데이터 조회 (중복 체크용)
    const existingIncomeRecords = await getIncomeRecords(startDate, endDate);
    const existingCashOfferings = existingIncomeRecords.filter(
      r => r.source === '헌금함'
    );

    // 기존 데이터의 중복 체크 키 Set 생성
    const existingKeys = new Set<string>();
    for (const record of existingCashOfferings) {
      // transaction_date가 있으면 사용, 없으면 date 사용
      const recordDate = record.transaction_date || record.date;
      const key = getDuplicateKey(recordDate, record.donor_name, record.amount);
      existingKeys.add(key);
    }

    return NextResponse.json({
      success: true,
      data: cashOfferings,
      donorMap,
      existingKeys: Array.from(existingKeys),
      message: `${cashOfferings.length}건의 현금헌금을 불러왔습니다`,
    });
  } catch (error) {
    console.error('Cash offering preview error:', error);
    return NextResponse.json(
      { success: false, error: '현금헌금 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
