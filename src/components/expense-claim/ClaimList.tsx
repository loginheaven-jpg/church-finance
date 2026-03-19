'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Eye, Trash2, Download, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useFinanceSession } from '@/lib/auth/use-finance-session';

interface ClaimItem {
  rowIndex: number;
  claimId?: string;
  claimDate: string;
  claimant: string;
  accountCode: string;
  amount: number;
  description: string;
  bankName: string;
  accountNumber: string;
  processedDate: string;
  receiptUrl?: string;
  status: 'pending' | 'suspicious' | 'processed';
}

interface ClaimListProps {
  onCancelSuccess?: () => void;
}

export function ClaimList({ onCancelSuccess }: ClaimListProps) {
  const session = useFinanceSession();
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/expense-claim/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setClaims(data.data);
        setIsAdmin(data.isAdmin);
      } else {
        toast.error(data.error || '목록 조회 실패');
      }
    } catch {
      toast.error('목록 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchClaims();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (rowIndex: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingRows = claims
      .filter(c => c.status !== 'processed')
      .map(c => c.rowIndex);
    if (selected.size === pendingRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingRows));
    }
  };

  const handleMarkProcessed = async () => {
    if (selected.size === 0) { toast.error('처리할 항목을 선택해주세요'); return; }
    setMarking(true);
    try {
      const res = await fetch('/api/expense-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${selected.size}건을 처리 완료로 표시했습니다`);
        setSelected(new Set());
        await fetchClaims();
      } else {
        toast.error(data.error || '처리 실패');
      }
    } catch {
      toast.error('처리 중 오류가 발생했습니다');
    } finally {
      setMarking(false);
    }
  };

  const handleExcelDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/expense-claim');
      const result = await res.json();
      if (!result.success || result.data.length === 0) {
        toast.info('다운로드할 미처리 청구가 없습니다');
        return;
      }

      const excelData = result.data.map((item: {
        bankName: string; accountNumber: string; amount: number;
        claimant: string; accountCode: string; description: string;
      }) => {
        const accountPrefix = item.accountCode ? item.accountCode.substring(0, 2) : '';
        const cleanDescription = item.description
          ? item.description.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
          : '';
        const withdrawNote = accountPrefix && cleanDescription
          ? `${accountPrefix}${cleanDescription}`
          : cleanDescription || accountPrefix;
        return {
          '은행명': item.bankName,
          '계좌번호': item.accountNumber,
          '금액': item.amount,
          '입금통장': '예봄교회',
          '출금통장': withdrawNote,
          '이체메모': item.claimant,
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '지출청구');

      const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      const dateStr = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
      XLSX.writeFile(wb, `지출청구_${dateStr}.xls`, { bookType: 'biff8' });

      const rowIndices = result.data.map((item: { rowIndex: number }) => item.rowIndex);
      const updateRes = await fetch('/api/expense-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices }),
      });
      const updateResult = await updateRes.json();
      if (updateResult.success) {
        toast.success(`${result.data.length}건 다운로드 완료, 처리일자 기입됨`);
        await fetchClaims();
      } else {
        toast.warning('다운로드는 완료했으나 처리일자 기입 실패');
      }
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewReceipt = async (receiptUrl: string) => {
    try {
      const res = await fetch(`/api/expense-claim/receipt?path=${encodeURIComponent(receiptUrl)}`);
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error('영수증 조회 실패');
      }
    } catch {
      toast.error('영수증 조회 중 오류가 발생했습니다');
    }
  };

  const handleCancel = async (rowIndex: number) => {
    if (!confirm('이 청구를 취소하시겠습니까?')) return;
    setCancelling(rowIndex);
    try {
      const res = await fetch('/api/expense-claim/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('청구가 취소되었습니다');
        await fetchClaims();
        onCancelSuccess?.();
      } else {
        toast.error(data.error || '취소 실패');
      }
    } catch {
      toast.error('취소 중 오류가 발생했습니다');
    } finally {
      setCancelling(null);
    }
  };

  const statusBadge = (status: ClaimItem['status']) => {
    if (status === 'processed') {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">
          <CheckCircle2 className="h-3 w-3 mr-1" />처리 완료
        </Badge>
      );
    }
    if (status === 'suspicious') {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">
          <AlertTriangle className="h-3 w-3 mr-1" />누락 의심
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0">
        <Clock className="h-3 w-3 mr-1" />미처리 추정
      </Badge>
    );
  };

  const pendingClaims = claims.filter(c => c.status !== 'processed');
  const pendingRows = pendingClaims.map(c => c.rowIndex);
  const allPendingSelected = pendingRows.length > 0 && selected.size === pendingRows.length;

  return (
    <div className="space-y-4">
      {/* 필터 + 액션 버튼 */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-36"
        />
        <span className="text-slate-400 text-sm">~</span>
        <Input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-36"
        />
        <Button variant="outline" size="sm" onClick={fetchClaims} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          조회
        </Button>
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkProcessed}
              disabled={marking || selected.size === 0}
            >
              {marking
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <CheckCircle2 className="h-4 w-4 mr-1" />}
              처리 완료 표시 ({selected.size})
            </Button>
            <Button
              size="sm"
              onClick={handleExcelDownload}
              disabled={downloading}
            >
              {downloading
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Download className="h-4 w-4 mr-1" />}
              엑셀 다운로드
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : claims.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-500">
            청구 내역이 없습니다
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isAdmin
                ? `전체 청구 현황 (${claims.length}건)`
                : `내 청구 현황 (${claims.length}건)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-8 pl-4">
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4"
                          title="미처리 전체 선택"
                        />
                      </TableHead>
                    )}
                    <TableHead>청구일</TableHead>
                    {isAdmin && <TableHead>청구자</TableHead>}
                    <TableHead>계정코드</TableHead>
                    <TableHead>내역</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map(claim => {
                    const isOwn = claim.claimant === session?.name;
                    const canCancel = (isOwn || isAdmin) && claim.status !== 'processed';
                    const canSelect = isAdmin && claim.status !== 'processed';
                    return (
                      <TableRow key={claim.rowIndex}>
                        {isAdmin && (
                          <TableCell className="pl-4">
                            {canSelect && (
                              <input
                                type="checkbox"
                                checked={selected.has(claim.rowIndex)}
                                onChange={() => toggleSelect(claim.rowIndex)}
                                className="h-4 w-4"
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm whitespace-nowrap">{claim.claimDate}</TableCell>
                        {isAdmin && <TableCell className="text-sm">{claim.claimant}</TableCell>}
                        <TableCell className="text-sm">{claim.accountCode}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate" title={claim.description}>
                          {claim.description}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {claim.amount.toLocaleString()}원
                        </TableCell>
                        <TableCell>{statusBadge(claim.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {claim.receiptUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                                onClick={() => handleViewReceipt(claim.receiptUrl!)}
                                title="영수증 보기"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                                onClick={() => handleCancel(claim.rowIndex)}
                                disabled={cancelling === claim.rowIndex}
                                title="청구 취소"
                              >
                                {cancelling === claim.rowIndex
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {pendingClaims.length > 0 && (
              <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-4">
                <span className="text-sm text-slate-500">
                  미처리 {pendingClaims.length}건
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  합계: {pendingClaims.reduce((s, c) => s + c.amount, 0).toLocaleString()}원
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
