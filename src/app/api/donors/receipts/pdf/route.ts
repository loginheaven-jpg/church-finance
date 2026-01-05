import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getIncomeRecords, getDonorInfo, getIncomeCodes } from '@/lib/google-sheets';
import type { DonationReceipt } from '@/types';

// jsPDF autotable 타입 확장
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// 교회 정보
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

    // 발급번호 생성
    const issueNumber = `${year}-${String(Date.now()).slice(-6)}`;
    const issueDate = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // PDF 생성 (jsPDF)
    const doc = new jsPDF();

    // 제목
    doc.setFontSize(20);
    doc.text('기부금 영수증', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`발급번호: ${issueNumber}`, 105, 30, { align: 'center' });

    // 기부자 정보
    doc.setFontSize(12);
    doc.text('1. 기부자 정보', 20, 45);

    doc.setFontSize(10);
    doc.text(`대표자명: ${receipt.representative}`, 25, 55);
    doc.text(`주소: ${receipt.address || '(미등록)'}`, 25, 62);

    // 헌금자 목록
    if (receipt.donors.length > 0) {
      const donorData = receipt.donors.map((d) => [
        d.donor_name,
        d.relationship || '-',
        d.registration_number ? d.registration_number.substring(0, 8) + '******' : '(미등록)',
      ]);

      doc.autoTable({
        startY: 70,
        head: [['성명', '관계', '주민등록번호']],
        body: donorData,
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100] },
        margin: { left: 25, right: 25 },
      });
    }

    // 헌금 내역
    const tableStartY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 90;
    doc.setFontSize(12);
    doc.text(`2. 헌금 내역 (${year}년)`, 20, tableStartY);

    const donationData = receipt.donations.map((d) => [
      d.date,
      d.offering_type,
      d.amount.toLocaleString('ko-KR') + '원',
    ]);

    doc.autoTable({
      startY: tableStartY + 5,
      head: [['날짜', '구분', '금액']],
      body: donationData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] },
      margin: { left: 25, right: 25 },
      columnStyles: {
        2: { halign: 'right' },
      },
    });

    // 합계
    const totalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`합계: ${receipt.total_amount.toLocaleString('ko-KR')}원`, 170, totalY, { align: 'right' });

    // 기부금 단체 정보
    doc.setFontSize(12);
    doc.text('3. 기부금 단체 정보', 20, totalY + 20);

    doc.setFontSize(10);
    doc.text(`단체명: ${CHURCH_INFO.name}`, 25, totalY + 30);
    doc.text(`소재지: ${CHURCH_INFO.address || '(미등록)'}`, 25, totalY + 37);
    doc.text(`대표자: ${CHURCH_INFO.leader || '(미등록)'}`, 25, totalY + 44);

    // 발급일
    doc.text(`발급일: ${issueDate}`, 170, totalY + 55, { align: 'right' });

    // 안내문
    doc.setFontSize(11);
    doc.text('위 금액을 기부금으로 수령하였음을 증명합니다.', 105, totalY + 70, { align: 'center' });

    doc.setFontSize(14);
    doc.text(CHURCH_INFO.name, 105, totalY + 85, { align: 'center' });

    // PDF 바이너리 생성
    const pdfOutput = doc.output('arraybuffer');

    return new NextResponse(pdfOutput, {
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
