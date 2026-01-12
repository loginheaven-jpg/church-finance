'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { DonationReceipt } from '@/types';
import { getDisplayName } from '@/lib/utils';

function PrintContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get('year') || new Date().getFullYear().toString();
  const representative = searchParams.get('representative') || '';
  const issueNumberParam = searchParams.get('issue_number') || '';

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

  // PDF 파일명 설정: 이름님연도기부금영수증_예봄교회.pdf
  useEffect(() => {
    if (receipt) {
      document.title = `${getDisplayName(receipt.representative)}님${year}기부금영수증_예봄교회`;
    }
    return () => {
      document.title = '예봄교회 재정부';
    };
  }, [receipt, year]);

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR');
  };

  // 발급일: 실제 출력일 (한국시간 기준)
  const today = new Date();
  const issueDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  // URL 파라미터에서 받은 발급번호 사용 (없으면 API에서 받은 값 사용)
  const displayIssueNumber = issueNumberParam || receipt?.issue_number || '';

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
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-50">
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
      <div className="max-w-[800px] mx-auto p-8 bg-white print:p-0 print:max-w-none">
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-table th,
          .receipt-table td {
            border: 1px solid #333;
            padding: 8px 12px;
            font-size: 13px;
          }
          .receipt-table th {
            background-color: #f5f5f5;
            font-weight: 600;
            text-align: center;
          }
        `}</style>

        {/* 제목 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-widest mb-2">기 부 금 영 수 증</h1>
          <p className="text-sm text-gray-600">발급번호: {displayIssueNumber}</p>
        </div>

        {/* 1. 기부자 */}
        <section className="mb-6">
          <h2 className="text-base font-bold bg-gray-100 p-2 border border-gray-300 mb-0">
            1. 기부자
          </h2>
          <table className="receipt-table">
            <tbody>
              <tr>
                <th style={{ width: '15%' }}>성 명</th>
                <td style={{ width: '35%' }}>{getDisplayName(receipt.representative)}</td>
                <th style={{ width: '15%' }}>주민등록번호</th>
                <td style={{ width: '35%' }} className="font-mono">
                  {receipt.resident_id
                    ? `${receipt.resident_id.slice(0, 6)}-${receipt.resident_id.slice(6)}*******`
                    : '(미등록)'}
                </td>
              </tr>
              <tr>
                <th>주 소</th>
                <td colSpan={3}>{receipt.address || '(미등록)'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 2. 기부금 단체 */}
        <section className="mb-6">
          <h2 className="text-base font-bold bg-gray-100 p-2 border border-gray-300 mb-0">
            2. 기부금 단체
          </h2>
          <table className="receipt-table">
            <tbody>
              <tr>
                <th style={{ width: '15%' }}>단 체 명</th>
                <td style={{ width: '35%' }}>대한예수교장로회 예봄교회</td>
                <th style={{ width: '15%' }}>고유번호</th>
                <td style={{ width: '35%' }}>117-82-60597</td>
              </tr>
              <tr>
                <th>소 재 지</th>
                <td colSpan={3}>경기도 성남시 분당구 운중로 285 (판교동)</td>
              </tr>
              <tr>
                <th>대 표 자</th>
                <td colSpan={3}>최 병 희</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 3. 기부내용 */}
        <section className="mb-6">
          <h2 className="text-base font-bold bg-gray-100 p-2 border border-gray-300 mb-0">
            3. 기부내용
          </h2>
          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>유 형</th>
                <th style={{ width: '10%' }}>코 드</th>
                <th style={{ width: '15%' }}>구 분</th>
                <th style={{ width: '35%' }}>기부기간</th>
                <th style={{ width: '25%' }}>기부금액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-center">종교단체</td>
                <td className="text-center">41</td>
                <td className="text-center">헌금</td>
                <td className="text-center">{year}년 1월 1일 ~ 12월 31일</td>
                <td className="text-right font-bold pr-4">
                  {formatAmount(receipt.total_amount)} 원
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 법적 문구 */}
        <section className="mb-4 text-sm leading-relaxed text-gray-700 border border-gray-300 p-4 bg-gray-50">
          <p className="mb-2">
            「소득세법」 제34조, 「조세특례제한법」 제76조·제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부받았음을 증명하여 드립니다.
          </p>
          <p className="text-xs text-gray-500">
            ※ 이 영수증은 소득세·법인세 신고 시 기부금 영수증으로 사용할 수 있습니다.
          </p>
        </section>

        {/* 신청인 및 발급일 */}
        <div className="mb-4">
          <p className="text-center text-lg mb-4">
            신 청 인 : <span className="font-bold underline px-4">{getDisplayName(receipt.representative)}</span>
          </p>
          <p className="text-center mb-4">
            위와 같이 기부금을 기부받았음을 증명합니다.
          </p>
          <p className="text-center text-lg font-medium mb-6">
            {issueDate}
          </p>
        </div>

        {/* 기부금 수령인 서명란 */}
        <div className="flex items-center justify-center gap-8">
          <div className="text-lg">
            <span className="font-medium">기부금 수령인 :</span>
            <span className="ml-2">대한예수교장로회 예봄교회</span>
          </div>
          <div className="relative" style={{ width: '60px', height: '24px' }}>
            <span className="text-gray-400 text-sm">(직인)</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/church-seal.png"
              alt="교회 직인"
              style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translate(-50%, -50%) scale(1.5)',
                opacity: 0.85,
                pointerEvents: 'none'
              }}
            />
          </div>
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
