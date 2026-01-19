import { NextRequest, NextResponse } from 'next/server';
import { fetchCashOfferings, getDonorInfo } from '@/lib/google-sheets';

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

    return NextResponse.json({
      success: true,
      data: cashOfferings,
      donorMap,
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
