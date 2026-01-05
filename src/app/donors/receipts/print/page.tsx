'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { DonationReceipt } from '@/types';

function PrintContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const representative = searchParams.get('representative') || '';

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<DonationReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!representative) {
        setError('대표자명이 필요합니다');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/donors/receipts?year=${year}&representative=${encodeURIComponent(representative)}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
          setReceipt(data.data[0]);
        } else {
          setError('영수증 데이터를 찾을 수 없습니다');
        }
      } catch (err) {
        console.error(err);
        setError('데이터 조회 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [year, representative]);

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const issueNumber = `${year}-${String(Date.now()).slice(-6)}`;
  const issueDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600">{error || '데이터를 찾을 수 없습니다'}</p>
        <Link href="/donors/receipts">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* 인쇄 버튼 (인쇄 시 숨김) */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2">
        <Link href="/donors/receipts">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Button>
        </Link>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          인쇄 / PDF 저장
        </Button>
      </div>

      {/* 영수증 내용 */}
      <div className="max-w-[800px] mx-auto p-8 bg-white print:p-0">
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        {/* 제목 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">기 부 금 영 수 증</h1>
          <p className="text-sm text-gray-600">발급번호: {issueNumber}</p>
        </div>

        {/* 1. 기부자 정보 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold bg-gray-100 p-2 mb-3">1. 기부자 정보</h2>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="border p-2 bg-gray-50 w-32 font-medium">대표자명</td>
                <td className="border p-2">{receipt.representative}</td>
              </tr>
              <tr>
                <td className="border p-2 bg-gray-50 font-medium">주소</td>
                <td className="border p-2">{receipt.address || '(미등록)'}</td>
              </tr>
            </tbody>
          </table>

          {/* 헌금자 목록 */}
          {receipt.donors.length > 0 && (
            <table className="w-full border-collapse mt-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">성명</th>
                  <th className="border p-2 text-center w-24">관계</th>
                  <th className="border p-2 text-center w-40">주민등록번호</th>
                </tr>
              </thead>
              <tbody>
                {receipt.donors.map((donor, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">{donor.donor_name}</td>
                    <td className="border p-2 text-center">{donor.relationship || '-'}</td>
                    <td className="border p-2 text-center font-mono">
                      {donor.registration_number
                        ? donor.registration_number.substring(0, 8) + '******'
                        : '(미등록)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 2. 헌금 내역 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold bg-gray-100 p-2 mb-3">2. 헌금 내역 ({year}년)</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-center w-28">날짜</th>
                <th className="border p-2 text-left">구분</th>
                <th className="border p-2 text-right w-32">금액</th>
              </tr>
            </thead>
            <tbody>
              {receipt.donations.map((donation, idx) => (
                <tr key={idx}>
                  <td className="border p-2 text-center">{donation.date}</td>
                  <td className="border p-2">{donation.offering_type}</td>
                  <td className="border p-2 text-right">{formatAmount(donation.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50">
                <td className="border p-2 text-right" colSpan={2}>합계</td>
                <td className="border p-2 text-right text-lg">{formatAmount(receipt.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* 3. 기부금 단체 정보 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold bg-gray-100 p-2 mb-3">3. 기부금 단체 정보</h2>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="border p-2 bg-gray-50 w-32 font-medium">단체명</td>
                <td className="border p-2">예봄교회</td>
              </tr>
              <tr>
                <td className="border p-2 bg-gray-50 font-medium">소재지</td>
                <td className="border p-2">(주소 미등록)</td>
              </tr>
              <tr>
                <td className="border p-2 bg-gray-50 font-medium">대표자</td>
                <td className="border p-2">(대표자 미등록)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 발급일 */}
        <div className="text-right mb-8">
          <p>발급일: {issueDate}</p>
        </div>

        {/* 안내문 */}
        <div className="text-center border-t pt-8">
          <p className="mb-8">위 금액을 기부금으로 수령하였음을 증명합니다.</p>
          <p className="text-xl font-bold">예봄교회</p>
        </div>
      </div>
    </>
  );
}

export default function PrintReceiptPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
