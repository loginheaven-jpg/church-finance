import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getDonorInfo, getIncomeCodes } from '@/lib/google-sheets';
import type { DonationReceipt } from '@/types';

// GET: 기부금영수증 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const representative = searchParams.get('representative');

    if (!yearParam) {
      return NextResponse.json(
        { success: false, error: '연도는 필수입니다' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 병렬로 데이터 조회
    const [incomeRecords, donorInfos, incomeCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getDonorInfo(),
      getIncomeCodes(),
    ]);

    // 코드 -> 이름 매핑
    const codeToName = new Map(incomeCodes.map((c) => [c.code, c.item]));

    // 대표자별로 그룹화
    const receiptMap = new Map<string, DonationReceipt>();

    for (const record of incomeRecords) {
      const rep = record.representative || record.donor_name;

      // 필터링
      if (representative && rep !== representative) {
        continue;
      }

      if (!receiptMap.has(rep)) {
        // 헌금자 정보에서 추가 정보 가져오기
        const donorInfo = donorInfos.find((d) => d.representative === rep);

        receiptMap.set(rep, {
          year,
          representative: rep,
          donors: [],
          address: donorInfo?.address || '',
          total_amount: 0,
          donations: [],
        });
      }

      const receipt = receiptMap.get(rep)!;

      // 헌금 내역 추가
      receipt.donations.push({
        date: record.date,
        offering_type: codeToName.get(record.offering_code) || `코드 ${record.offering_code}`,
        amount: record.amount,
      });

      receipt.total_amount += record.amount;
    }

    // 대표자별 헌금자 정보 추가
    for (const [rep, receipt] of receiptMap) {
      const matchingDonors = donorInfos.filter((d) => d.representative === rep);

      if (matchingDonors.length > 0) {
        receipt.donors = matchingDonors.map((d) => ({
          donor_name: d.donor_name,
          relationship: d.relationship || '본인',
          registration_number: d.registration_number || '',
        }));
        // 주소 업데이트 (첫 번째 헌금자 정보에서)
        receipt.address = matchingDonors[0].address || '';
      } else {
        // 헌금자 정보가 없는 경우 수입부에서 이름 수집
        const donorNames = new Set<string>();
        for (const record of incomeRecords) {
          if ((record.representative || record.donor_name) === rep) {
            donorNames.add(record.donor_name);
          }
        }
        receipt.donors = Array.from(donorNames).map((name) => ({
          donor_name: name,
          relationship: name === rep ? '본인' : '',
          registration_number: '',
        }));
      }

      // 헌금 내역 날짜순 정렬
      receipt.donations.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 결과를 배열로 변환하고 총액 기준 내림차순 정렬
    const receipts = Array.from(receiptMap.values()).sort(
      (a, b) => b.total_amount - a.total_amount
    );

    return NextResponse.json({
      success: true,
      data: receipts,
      summary: {
        totalRepresentatives: receipts.length,
        totalAmount: receipts.reduce((sum, r) => sum + r.total_amount, 0),
      },
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    return NextResponse.json(
      { success: false, error: '기부금영수증 데이터 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
