'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, FileText, Printer, Eye, Search, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { DonationReceipt } from '@/types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// 영수증 HTML 생성 함수
function createReceiptHtml(receipt: DonationReceipt, year: string): string {
  const today = new Date();
  const issueDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const totalAmount = receipt.total_amount.toLocaleString('ko-KR');

  return `
    <div style="width: 794px; padding: 40px; font-family: 'Malgun Gothic', sans-serif; background: white;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 28px; font-weight: bold; letter-spacing: 8px; margin-bottom: 10px;">기 부 금 영 수 증</h1>
        <p style="font-size: 12px; color: #666;">발급번호: ${receipt.issue_number || ''}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 14px; font-weight: bold; background: #f3f3f3; padding: 8px; border: 1px solid #ccc; margin: 0;">1. 기부자</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">성 명</th>
            <td style="border: 1px solid #333; padding: 8px; width: 35%;">${receipt.representative}</td>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">주민등록번호</th>
            <td style="border: 1px solid #333; padding: 8px; width: 35%; font-family: monospace;">${receipt.resident_id ? `${receipt.resident_id}-*******` : '(미등록)'}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; text-align: center;">주 소</th>
            <td colspan="3" style="border: 1px solid #333; padding: 8px;">${receipt.address || '(미등록)'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 14px; font-weight: bold; background: #f3f3f3; padding: 8px; border: 1px solid #ccc; margin: 0;">2. 기부금 단체</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">단 체 명</th>
            <td style="border: 1px solid #333; padding: 8px; width: 35%;">대한예수교장로회 예봄교회</td>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">고유번호</th>
            <td style="border: 1px solid #333; padding: 8px; width: 35%;">117-82-60597</td>
          </tr>
          <tr>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; text-align: center;">소 재 지</th>
            <td colspan="3" style="border: 1px solid #333; padding: 8px;">경기도 성남시 분당구 운중로 285 (판교동)</td>
          </tr>
          <tr>
            <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; text-align: center;">대 표 자</th>
            <td colspan="3" style="border: 1px solid #333; padding: 8px;">최 병 희</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 14px; font-weight: bold; background: #f3f3f3; padding: 8px; border: 1px solid #ccc; margin: 0;">3. 기부내용</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">유 형</th>
              <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 10%; text-align: center;">코 드</th>
              <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 15%; text-align: center;">구 분</th>
              <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 35%; text-align: center;">기부기간</th>
              <th style="border: 1px solid #333; padding: 8px; background: #f5f5f5; width: 25%; text-align: center;">기부금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #333; padding: 8px; text-align: center;">종교단체</td>
              <td style="border: 1px solid #333; padding: 8px; text-align: center;">41</td>
              <td style="border: 1px solid #333; padding: 8px; text-align: center;">헌금</td>
              <td style="border: 1px solid #333; padding: 8px; text-align: center;">${year}년 1월 1일 ~ 12월 31일</td>
              <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">${totalAmount} 원</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 15px; font-size: 13px; border: 1px solid #ccc; padding: 15px; background: #fafafa;">
        <p style="margin: 0 0 8px 0;">「소득세법」 제34조, 「조세특례제한법」 제76조·제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부받았음을 증명하여 드립니다.</p>
        <p style="margin: 0; font-size: 11px; color: #666;">※ 이 영수증은 소득세·법인세 신고 시 기부금 영수증으로 사용할 수 있습니다.</p>
      </div>

      <div style="margin-bottom: 20px; text-align: center;">
        <p style="font-size: 16px; margin-bottom: 15px;">신 청 인 : <span style="font-weight: bold; text-decoration: underline; padding: 0 20px;">${receipt.representative}</span></p>
        <p style="margin-bottom: 15px;">위와 같이 기부금을 기부받았음을 증명합니다.</p>
        <p style="font-size: 16px; font-weight: 500; margin-bottom: 25px;">${issueDate}</p>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 30px;">
        <div style="font-size: 16px;">
          <span style="font-weight: 500;">기부금 수령인 :</span>
          <span style="margin-left: 8px;">대한예수교장로회 예봄교회</span>
        </div>
        <div style="position: relative;">
          <span style="color: #999; font-size: 13px;">(직인)</span>
          <img src="/church-seal.png" alt="직인" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -70%) scale(1.5); opacity: 0.85;" />
        </div>
      </div>
    </div>
  `;
}

// 클라이언트 사이드 PDF 생성 함수 (iframe으로 스타일 격리)
async function downloadPdf(receipt: DonationReceipt, year: string): Promise<boolean> {
  try {
    // 숨겨진 iframe 생성 (스타일 격리)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '900px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // iframe 내부에 HTML 작성
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('iframe document not available');
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: white; }
        </style>
      </head>
      <body>
        ${createReceiptHtml(receipt, year)}
      </body>
      </html>
    `);
    iframeDoc.close();

    // 이미지 로드 대기
    await new Promise(resolve => setTimeout(resolve, 500));

    // html2canvas로 캡처
    const targetElement = iframeDoc.body.firstElementChild as HTMLElement;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // iframe 제거
    document.body.removeChild(iframe);

    // PDF 생성
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

    // 다운로드
    const filename = `${receipt.representative}님${year}기부금영수증_예봄교회.pdf`;
    pdf.save(filename);

    return true;
  } catch (error) {
    console.error('PDF download error:', error);
    return false;
  }
}

export default function DonationReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState('');
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [previewReceipt, setPreviewReceipt] = useState<DonationReceipt | null>(null);
  const [summary, setSummary] = useState({ totalRepresentatives: 0, totalAmount: 0 });
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (search) params.set('representative', search);

      const res = await fetch(`/api/donors/receipts?${params}`);
      const data = await res.json();

      if (data.success) {
        setReceipts(data.data);
        setSummary(data.summary);
        setSelectedReceipts(new Set());
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [year]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReceipts();
  };

  const toggleSelect = (representative: string) => {
    const newSelected = new Set(selectedReceipts);
    if (newSelected.has(representative)) {
      newSelected.delete(representative);
    } else {
      newSelected.add(representative);
    }
    setSelectedReceipts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReceipts.size === receipts.length) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(receipts.map((r) => r.representative)));
    }
  };

  const openPrintPage = (representative: string, issueNumber?: string) => {
    const receipt = receipts.find(r => r.representative === representative);
    const actualIssueNumber = issueNumber || receipt?.issue_number || '';
    const printUrl = `/donors/receipts/print?year=${year}&representative=${encodeURIComponent(representative)}&issue_number=${encodeURIComponent(actualIssueNumber)}`;
    window.open(printUrl, '_blank');
  };

  // 일괄 PDF 다운로드
  const handleBatchDownload = async () => {
    const selected = Array.from(selectedReceipts);
    if (selected.length === 0) return;

    setDownloading(true);
    setDownloadProgress({ current: 0, total: selected.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const rep = selected[i];
      const receipt = receipts.find(r => r.representative === rep);

      setDownloadProgress({ current: i + 1, total: selected.length });

      if (receipt) {
        const success = await downloadPdf(receipt, year);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }

      // 다음 다운로드 전 약간의 딜레이 (브라우저 안정성)
      if (i < selected.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    setDownloading(false);
    setDownloadProgress({ current: 0, total: 0 });

    if (failCount === 0) {
      toast.success(`${successCount}개의 영수증 PDF가 다운로드되었습니다`);
    } else {
      toast.warning(`${successCount}개 성공, ${failCount}개 실패`);
    }

    setSelectedReceipts(new Set());
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">기부금영수증 발급</h1>
        <Button variant="outline" onClick={fetchReceipts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            연말정산용 기부금영수증
          </CardTitle>
          <CardDescription>
            대표자별 헌금 내역을 확인하고 PDF 영수증을 발급합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 필터 */}
          <div className="flex gap-4 mb-6">
            <div className="w-32">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <Input
                placeholder="대표자명으로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" variant="outline">
                <Search className="mr-2 h-4 w-4" />
                검색
              </Button>
            </form>
          </div>

          {/* 요약 */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-sm text-slate-500">총 대표자 수</div>
              <div className="text-2xl font-bold">{summary.totalRepresentatives}명</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">총 헌금액</div>
              <div className="text-2xl font-bold">{formatAmount(summary.totalAmount)}</div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {year}년 헌금 내역이 없습니다
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedReceipts.size === receipts.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-24">발급번호</TableHead>
                    <TableHead>대표자명</TableHead>
                    <TableHead className="text-center">헌금 횟수</TableHead>
                    <TableHead className="text-right">총액</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.representative}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReceipts.has(receipt.representative)}
                          onCheckedChange={() => toggleSelect(receipt.representative)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">
                        {receipt.issue_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {receipt.representative}
                      </TableCell>
                      <TableCell className="text-center">
                        {receipt.donations.length}회
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(receipt.total_amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewReceipt(receipt)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPrintPage(receipt.representative)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 선택 항목 일괄 다운로드 */}
              {selectedReceipts.size > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                  <span className="text-blue-700">
                    {downloading
                      ? `다운로드 중... (${downloadProgress.current}/${downloadProgress.total})`
                      : `${selectedReceipts.size}명 선택됨`}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        Array.from(selectedReceipts).forEach((rep, idx) => {
                          setTimeout(() => openPrintPage(rep), idx * 300);
                        });
                      }}
                      disabled={downloading}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      화면보기
                    </Button>
                    <Button
                      onClick={handleBatchDownload}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      PDF 일괄저장
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 미리보기 다이얼로그 */}
      <Dialog open={!!previewReceipt} onOpenChange={(open) => !open && setPreviewReceipt(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>기부금영수증 미리보기</DialogTitle>
            <DialogDescription>
              발급번호: {previewReceipt?.issue_number} | {previewReceipt?.representative} - {year}년
            </DialogDescription>
          </DialogHeader>

          {previewReceipt && (
            <div className="space-y-6">
              {/* 기부자 정보 */}
              <div>
                <h3 className="font-semibold mb-2">기부자</h3>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-24 text-slate-500">성명</span>
                      <span className="font-medium">{previewReceipt.representative}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500">주민번호</span>
                      <span className="font-mono">
                        {previewReceipt.resident_id
                          ? previewReceipt.resident_id + '-*******'
                          : '(미등록)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-slate-500">주소</span>
                    <span>{previewReceipt.address || '(미등록)'}</span>
                  </div>
                </div>
              </div>

              {/* 기부내역 요약 */}
              <div>
                <h3 className="font-semibold mb-2">기부내역</h3>
                <div className="border rounded-lg p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>유형</TableHead>
                        <TableHead className="text-center">코드</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>기부기간</TableHead>
                        <TableHead className="text-right">기부금액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>종교단체</TableCell>
                        <TableCell className="text-center">41</TableCell>
                        <TableCell>헌금</TableCell>
                        <TableCell>{year}년 1월 1일 ~ 12월 31일</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatAmount(previewReceipt.total_amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 기부금 단체 정보 */}
              <div>
                <h3 className="font-semibold mb-2">기부금 수령인</h3>
                <div className="border rounded-lg p-4 space-y-1 text-sm">
                  <div><span className="text-slate-500 w-20 inline-block">단체명:</span> 대한예수교장로회 예봄교회</div>
                  <div><span className="text-slate-500 w-20 inline-block">고유번호:</span> 117-82-60597</div>
                  <div><span className="text-slate-500 w-20 inline-block">소재지:</span> 경기도 성남시 분당구 운중로 285 (판교동)</div>
                  <div><span className="text-slate-500 w-20 inline-block">대표자:</span> 최병희</div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => openPrintPage(previewReceipt.representative)}>
                  <Printer className="mr-2 h-4 w-4" />
                  인쇄 / PDF 저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
