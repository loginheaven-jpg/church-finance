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
import { Loader2, FileText, Printer, Eye, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { DonationReceipt } from '@/types';

export default function DonationReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState('');
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [previewReceipt, setPreviewReceipt] = useState<DonationReceipt | null>(null);
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

  const openPrintPage = (representative: string, issueNumber?: string) => {
    const receipt = receipts.find(r => r.representative === representative);
    const actualIssueNumber = issueNumber || receipt?.issue_number || '';
    const printUrl = `/donors/receipts/print?year=${year}&representative=${encodeURIComponent(representative)}&issue_number=${encodeURIComponent(actualIssueNumber)}`;
    window.open(printUrl, '_blank');
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
                    {selectedReceipts.size}명 선택됨
                  </span>
                  <Button
                    onClick={() => {
                      toast.info('선택된 영수증 인쇄 페이지를 엽니다');
                      Array.from(selectedReceipts).forEach((rep, idx) => {
                        setTimeout(() => openPrintPage(rep), idx * 300);
                      });
                    }}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    선택 인쇄
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
