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
import { Loader2, FileText, Download, Eye, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { DonationReceipt } from '@/types';

export default function DonationReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState('');
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [previewReceipt, setPreviewReceipt] = useState<DonationReceipt | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [summary, setSummary] = useState({ totalRepresentatives: 0, totalAmount: 0 });

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

  const downloadPDF = async (representative: string) => {
    setDownloading(representative);
    try {
      const res = await fetch('/api/donors/receipts/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), representative }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'PDF 생성 실패');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `기부금영수증-${year}-${representative}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF가 다운로드되었습니다');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'PDF 다운로드 중 오류가 발생했습니다');
    } finally {
      setDownloading(null);
    }
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
                    <TableHead>대표자명</TableHead>
                    <TableHead className="text-center">헌금자 수</TableHead>
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
                      <TableCell className="font-medium">
                        {receipt.representative}
                      </TableCell>
                      <TableCell className="text-center">
                        {receipt.donors.length}명
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
                            onClick={() => downloadPDF(receipt.representative)}
                            disabled={downloading === receipt.representative}
                          >
                            {downloading === receipt.representative ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
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
                    {selectedReceipts.size}명 선택됨
                  </span>
                  <Button
                    onClick={() => {
                      // 일괄 다운로드는 각각 개별 다운로드로 처리
                      toast.info('선택된 영수증을 다운로드합니다');
                      Array.from(selectedReceipts).forEach((rep, idx) => {
                        setTimeout(() => downloadPDF(rep), idx * 500);
                      });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    선택 다운로드
                  </Button>
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
              {previewReceipt?.representative} - {year}년
            </DialogDescription>
          </DialogHeader>

          {previewReceipt && (
            <div className="space-y-6">
              {/* 기부자 정보 */}
              <div>
                <h3 className="font-semibold mb-2">1. 기부자 정보</h3>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex">
                    <span className="w-24 text-slate-500">대표자명</span>
                    <span>{previewReceipt.representative}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-slate-500">주소</span>
                    <span>{previewReceipt.address || '(미등록)'}</span>
                  </div>
                  {previewReceipt.donors.length > 0 && (
                    <div className="mt-2">
                      <span className="text-slate-500 block mb-1">헌금자 목록</span>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>성명</TableHead>
                            <TableHead>관계</TableHead>
                            <TableHead>주민등록번호</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewReceipt.donors.map((donor, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{donor.donor_name}</TableCell>
                              <TableCell>{donor.relationship || '-'}</TableCell>
                              <TableCell className="font-mono">
                                {donor.registration_number
                                  ? donor.registration_number.substring(0, 8) + '******'
                                  : '(미등록)'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>

              {/* 헌금 내역 */}
              <div>
                <h3 className="font-semibold mb-2">2. 헌금 내역</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>날짜</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead className="text-right">금액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewReceipt.donations.slice(0, 20).map((donation, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{donation.date}</TableCell>
                          <TableCell>{donation.offering_type}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(donation.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {previewReceipt.donations.length > 20 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-slate-500">
                            ... 외 {previewReceipt.donations.length - 20}건
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-slate-500 mr-4">합계</span>
                  <span className="text-xl font-bold">
                    {formatAmount(previewReceipt.total_amount)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => downloadPDF(previewReceipt.representative)}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF 다운로드
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
