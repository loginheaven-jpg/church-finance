import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getIncomeRecords, getDonorInfo, getIncomeCodes } from '@/lib/google-sheets';
import { DonationReceiptPDF } from '@/lib/pdf/donation-receipt';
import type { DonationReceipt } from '@/types';

// 교회 정보 (환경변수 또는 설정에서 가져올 수 있음)
const CHURCH_INFO = {
  name: process.env.CHURCH_NAME || '예봄교회',
  address: process.env.CHURCH_ADDRESS || '',
  leader: process.env.CHURCH_LEADER || '',
};

// POST: 기부금영수증 PDF 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, representative } = body;

    if (!year || !representative) {
      return NextResponse.json(
        { success: false, error: '연도와 대표자명은 필수입니다' },
        { status: 400 }
      );
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 데이터 조회
    const [incomeRecords, donorInfos, incomeCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getDonorInfo(),
      getIncomeCodes(),
    ]);

    // 코드 -> 이름 매핑
    const codeToName = new Map(incomeCodes.map((c) => [c.code, c.item]));

    // 해당 대표자의 헌금 내역 필터링
    const filteredRecords = incomeRecords.filter(
      (r) => (r.representative || r.donor_name) === representative
    );

    if (filteredRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 대표자의 헌금 내역이 없습니다' },
        { status: 404 }
      );
    }

    // 영수증 데이터 구성
    const donorInfo = donorInfos.find((d) => d.representative === representative);
    const matchingDonors = donorInfos.filter((d) => d.representative === representative);

    const receipt: DonationReceipt = {
      year,
      representative,
      donors: matchingDonors.length > 0
        ? matchingDonors.map((d) => ({
            donor_name: d.donor_name,
            relationship: d.relationship || '본인',
            registration_number: d.registration_number || '',
          }))
        : [{
            donor_name: representative,
            relationship: '본인',
            registration_number: '',
          }],
      address: donorInfo?.address || '',
      total_amount: filteredRecords.reduce((sum, r) => sum + r.amount, 0),
      donations: filteredRecords
        .map((r) => ({
          date: r.date,
          offering_type: codeToName.get(r.offering_code) || `코드 ${r.offering_code}`,
          amount: r.amount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    // 발급번호 생성 (연도-순번 형식)
    const issueNumber = `${year}-${String(Date.now()).slice(-6)}`;

    // PDF 생성
    const pdfBuffer = await renderToBuffer(
      DonationReceiptPDF({
        receipt,
        churchName: CHURCH_INFO.name,
        churchAddress: CHURCH_INFO.address,
        churchLeader: CHURCH_INFO.leader,
        issueNumber,
      })
    );

    // PDF 응답 - Buffer를 Uint8Array로 변환
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="donation-receipt-${year}-${encodeURIComponent(representative)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'PDF 생성 중 오류가 발생했습니다', details: String(error) },
      { status: 500 }
    );
  }
}
