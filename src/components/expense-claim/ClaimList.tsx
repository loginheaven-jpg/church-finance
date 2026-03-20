'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
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
import {
  Loader2, Eye, Trash2, Download, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, ShieldCheck, ShieldAlert, ShieldQuestion, Pencil, Save, X, ChevronDown, ChevronRight,
} from 'lucide-react';
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
  accountHolder: string;
  processedDate: string;
  receiptUrl?: string;
  status: 'pending' | 'suspicious' | 'processed';
}

type VerifStatus = 'matched' | 'pending' | 'missing';
interface VerifInfo { status: VerifStatus; failReason?: string; }

interface ClaimListProps {
  onCancelSuccess?: () => void;
}

// KST 날짜 문자열 (YYYY-MM-DD)
const kstDateString = (date: Date) =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const todayKST = () => kstDateString(new Date());
const oneMonthAgoKST = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return kstDateString(d);
};

export function ClaimList({ onCancelSuccess }: ClaimListProps) {
  const session = useFinanceSession();
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [verifMap, setVerifMap] = useState<Map<number, VerifInfo>>(new Map());
  // 인라인 편집 (admin 전용)
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClaimItem>>({});
  const [saving, setSaving] = useState(false);
  // 상세 행 토글
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleExpand = (rowIndex: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };
  // 기본 기간: 최근 1개월
  const [startDate, setStartDate] = useState(oneMonthAgoKST());
  const [endDate, setEndDate] = useState(todayKST());

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/expense-claim/list?${params}`);
      const data = await res.json();
      if (data.success) {
        // 최근것 순 정렬 (청구일 내림차순, 같으면 rowIndex 내림차순)
        const sorted = [...data.data].sort((a: ClaimItem, b: ClaimItem) => {
          const dateCompare = b.claimDate.localeCompare(a.claimDate);
          return dateCompare !== 0 ? dateCompare : b.rowIndex - a.rowIndex;
        });
        setClaims(sorted);
        setIsAdmin(data.isAdmin);
        setVerifMap(new Map()); // 조회 시 대조 결과 초기화
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

  // admin: 목록 로드 후 자동으로 지출부 대조 실행
  useEffect(() => {
    if (!loading && isAdmin && claims.some(c => c.status === 'processed') && verifMap.size === 0) {
      handleVerify(true);
    }
  }, [loading, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (rowIndex: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unpaidRows = claims
      .filter(c => c.status !== 'processed')
      .map(c => c.rowIndex);
    if (selected.size === unpaidRows.length && unpaidRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unpaidRows));
    }
  };

  // 1차 점검: 입금완료 표시 (K컬럼 기재)
  const handleMarkPaid = async () => {
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
        toast.success(`${selected.size}건 입금완료 표시했습니다`);
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

  // 2차 점검: 지출부 대조 (silent=true 이면 toast 생략)
  const handleVerify = useCallback(async (silent = false) => {
    const processedClaims = claims.filter(c => c.status === 'processed' && c.processedDate);
    if (processedClaims.length === 0) {
      if (!silent) toast.info('대조할 입금완료 건이 없습니다');
      return;
    }
    setVerifying(true);
    try {
      // 처리완료 건들의 processedDate 범위로 verification API 호출
      const dates = processedClaims.map(c => c.processedDate).sort();
      const vs = dates[0];
      const ve = dates[dates.length - 1];
      const res = await fetch(
        `/api/expense-claim/verification?startDate=${vs}&endDate=${ve}`
      );
      const result = await res.json();
      if (result.success) {
        const items = result.data?.items || [];
        const map = new Map<number, VerifInfo>();
        (items as { claim: { rowIndex: number }; status: VerifStatus; failReason?: string }[]).forEach(item => {
          map.set(item.claim.rowIndex, { status: item.status, failReason: item.failReason });
        });
        setVerifMap(map);
        if (!silent) {
          const matched = items.filter((i: { status: string }) => i.status === 'matched').length;
          const missing = items.filter((i: { status: string }) => i.status === 'missing').length;
          toast.success(
            `지출부 대조 완료 — 확인됨 ${matched}건${missing > 0 ? `, 미기재 ${missing}건` : ''}`
          );
        }
      } else {
        if (!silent) toast.error(result.error || '대조 실패');
      }
    } catch {
      if (!silent) toast.error('지출부 대조 중 오류가 발생했습니다');
    } finally {
      setVerifying(false);
    }
  }, [claims]);

  // 선택 건만 엑셀 다운로드 (K컬럼 변경 없음)
  const handleExcelDownload = () => {
    if (selected.size === 0) { toast.error('다운로드할 항목을 선택해주세요'); return; }
    const selectedClaims = claims.filter(c => selected.has(c.rowIndex));

    const excelData = selectedClaims.map(item => {
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

    const dateStr = todayKST().replace(/-/g, '');
    XLSX.writeFile(wb, `지출청구_${dateStr}.xls`, { bookType: 'biff8' });
    toast.success(`${selectedClaims.length}건 엑셀 다운로드 완료`);
  };

  // 입금완료 취소: K컬럼 초기화 (미처리로 복원)
  const handleUnmarkPaid = async () => {
    const paidSelected = claims.filter(c => selected.has(c.rowIndex) && c.status === 'processed');
    if (paidSelected.length === 0) { toast.error('입금완료 상태인 항목을 선택해주세요'); return; }
    if (!confirm(`${paidSelected.length}건의 입금완료를 취소하시겠습니까?`)) return;
    setMarking(true);
    try {
      const res = await fetch('/api/expense-claim/unmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices: paidSelected.map(c => c.rowIndex) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${paidSelected.length}건 입금완료 취소됨`);
        setSelected(new Set());
        await fetchClaims();
      } else {
        toast.error(data.error || '취소 실패');
      }
    } catch {
      toast.error('입금완료 취소 중 오류가 발생했습니다');
    } finally {
      setMarking(false);
    }
  };

  const handleViewReceipt = async (receiptUrl: string) => {
    // 구글드라이브 URL (쉼표 구분 복수 가능) → 직접 열기
    if (receiptUrl.startsWith('http')) {
      const urls = receiptUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
      urls.forEach(url => window.open(url, '_blank'));
      return;
    }
    // Supabase 경로 → signed URL 생성 (쉼표 구분 복수 지원)
    try {
      const res = await fetch(`/api/expense-claim/receipt?path=${encodeURIComponent(receiptUrl)}`);
      const data = await res.json();
      if (data.success && data.urls) {
        data.urls.forEach((url: string) => window.open(url, '_blank'));
      } else if (data.success && data.url) {
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

  // 인라인 편집 시작
  const startEdit = (claim: ClaimItem) => {
    setEditingRow(claim.rowIndex);
    setEditForm({
      claimDate: claim.claimDate,
      accountCode: claim.accountCode,
      amount: claim.amount,
      description: claim.description,
      bankName: claim.bankName,
      accountNumber: claim.accountNumber,
    });
  };

  // 인라인 편집 저장
  const saveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const res = await fetch('/api/expense-claim/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: editingRow, ...editForm }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('청구 내역이 수정되었습니다');
        setEditingRow(null);
        await fetchClaims();
      } else {
        toast.error(data.error || '수정 실패');
      }
    } catch {
      toast.error('수정 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 4단계 상태 배지
  const statusBadge = (claim: ClaimItem) => {
    if (claim.status === 'processed') {
      const verif = verifMap.get(claim.rowIndex);
      if (verif?.status === 'matched') {
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">
            <ShieldCheck className="h-3 w-3 mr-1" />최종확인
          </Badge>
        );
      }
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
          <CheckCircle2 className="h-3 w-3 mr-1" />입금완료
        </Badge>
      );
    }
    if (claim.status === 'suspicious') {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">
          <AlertTriangle className="h-3 w-3 mr-1" />누락 의심
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0">
        <Clock className="h-3 w-3 mr-1" />미처리
      </Badge>
    );
  };

  // 지출부 대조 결과 아이콘 (admin 전용)
  const verifIcon = (rowIndex: number) => {
    const v = verifMap.get(rowIndex);
    if (!v) return null;
    if (v.status === 'matched') return <span title="지출원장 확인됨"><ShieldCheck className="h-4 w-4 text-green-600" /></span>;
    if (v.status === 'missing') return <span title={v.failReason || '지출원장 미기재'}><ShieldAlert className="h-4 w-4 text-red-500" /></span>;
    if (v.status === 'pending') return <span title={v.failReason || '지출원장 확인 대기'}><ShieldQuestion className="h-4 w-4 text-slate-400" /></span>;
    return null;
  };

  const unpaidClaims = claims.filter(c => c.status !== 'processed');
  const unpaidRows = unpaidClaims.map(c => c.rowIndex);
  const allUnpaidSelected = unpaidRows.length > 0 && unpaidRows.every(r => selected.has(r));
  const hasVerifRun = verifMap.size > 0;

  // 선택 항목 상태 분석
  const selectedUnpaid = claims.filter(c => selected.has(c.rowIndex) && c.status !== 'processed');
  const selectedPaid = claims.filter(c => selected.has(c.rowIndex) && c.status === 'processed');
  const hasUnpaidSelected = selectedUnpaid.length > 0;
  const hasPaidSelected = selectedPaid.length > 0;
  const isMixedSelection = hasUnpaidSelected && hasPaidSelected;

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
            {/* 미처리 건 선택 시: 입금완료 표시 + 엑셀 다운로드 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkPaid}
              disabled={marking || !hasUnpaidSelected || isMixedSelection}
              title={isMixedSelection ? '미처리/처리 건을 섞어 선택할 수 없습니다' : ''}
            >
              {marking
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <CheckCircle2 className="h-4 w-4 mr-1" />}
              입금완료 표시 ({selectedUnpaid.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExcelDownload}
              disabled={selected.size === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              엑셀 다운로드 ({selected.size})
            </Button>
            {/* 처리 건 선택 시: 입금완료 취소 */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnmarkPaid}
              disabled={marking || !hasPaidSelected || isMixedSelection}
              className={hasPaidSelected && !isMixedSelection ? 'text-orange-600 border-orange-300 hover:bg-orange-50' : ''}
            >
              입금완료 취소 ({selectedPaid.length})
            </Button>
            {/* 지출부 대조 */}
            <Button
              size="sm"
              variant={hasVerifRun ? 'default' : 'outline'}
              onClick={() => handleVerify(false)}
              disabled={verifying}
              className={hasVerifRun ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {verifying
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <ShieldCheck className="h-4 w-4 mr-1" />}
              지출부 대조
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
                          checked={allUnpaidSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4"
                          title="미처리 전체 선택"
                        />
                      </TableHead>
                    )}
                    <TableHead>청구일</TableHead>
                    {isAdmin && <TableHead>청구자</TableHead>}
                    <TableHead className="w-16">코드</TableHead>
                    <TableHead className="max-w-[100px]">내역</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>처리일</TableHead>
                    {isAdmin && <TableHead className="w-8 text-center" title="지출부 대조 결과">지출부</TableHead>}
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map(claim => {
                    const isOwn = claim.claimant === session?.name;
                    const canCancel = (isOwn || isAdmin) && claim.status !== 'processed';
                    const isEditing = editingRow === claim.rowIndex;
                    const isExpanded = expandedRows.has(claim.rowIndex);
                    const colCount = isAdmin ? 10 : 7;
                    return (
                      <Fragment key={claim.rowIndex}>
                      <TableRow className="cursor-pointer" onClick={() => !isEditing && toggleExpand(claim.rowIndex)}>
                        {isAdmin && (
                          <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(claim.rowIndex)}
                              onChange={() => toggleSelect(claim.rowIndex)}
                              className="h-4 w-4"
                              disabled={isEditing}
                            />
                          </TableCell>
                        )}
                        {isEditing ? (
                          <>
                            <TableCell onClick={e => e.stopPropagation()}><Input type="date" value={editForm.claimDate || ''} onChange={e => setEditForm(p => ({ ...p, claimDate: e.target.value }))} className="h-7 text-xs w-32" /></TableCell>
                            {isAdmin && <TableCell className="text-sm">{claim.claimant}</TableCell>}
                            <TableCell onClick={e => e.stopPropagation()}><Input value={editForm.accountCode || ''} onChange={e => setEditForm(p => ({ ...p, accountCode: e.target.value }))} className="h-7 text-xs w-16" /></TableCell>
                            <TableCell onClick={e => e.stopPropagation()}><Input value={editForm.description || ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className="h-7 text-xs w-28" /></TableCell>
                            <TableCell onClick={e => e.stopPropagation()}><Input type="number" value={editForm.amount || ''} onChange={e => setEditForm(p => ({ ...p, amount: Number(e.target.value) }))} className="h-7 text-xs w-24 text-right" /></TableCell>
                            <TableCell>{statusBadge(claim)}</TableCell>
                            <TableCell className="text-sm text-slate-500 whitespace-nowrap">{claim.processedDate || '-'}</TableCell>
                            {isAdmin && <TableCell />}
                            <TableCell onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={saveEdit} disabled={saving} title="저장">
                                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => setEditingRow(null)} title="취소">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-sm whitespace-nowrap">
                              {isExpanded ? <ChevronDown className="h-3 w-3 inline mr-1 text-slate-400" /> : <ChevronRight className="h-3 w-3 inline mr-1 text-slate-400" />}
                              {claim.claimDate}
                            </TableCell>
                            {isAdmin && <TableCell className="text-sm">{claim.claimant}</TableCell>}
                            <TableCell className="text-sm w-16 truncate" title={claim.accountCode}>{claim.accountCode}</TableCell>
                            <TableCell className="text-sm max-w-[100px] truncate" title={claim.description}>{claim.description}</TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{claim.amount.toLocaleString()}원</TableCell>
                            <TableCell>{statusBadge(claim)}</TableCell>
                            <TableCell className="text-sm text-slate-500 whitespace-nowrap">{claim.processedDate || '-'}</TableCell>
                            {isAdmin && (
                              <TableCell className="text-center">
                                {claim.status === 'processed' && verifIcon(claim.rowIndex)}
                              </TableCell>
                            )}
                            <TableCell onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {isAdmin && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600" onClick={() => startEdit(claim)} title="수정">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {claim.receiptUrl && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600" onClick={() => handleViewReceipt(claim.receiptUrl!)} title="영수증 보기">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                {canCancel && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-red-600" onClick={() => handleCancel(claim.rowIndex)} disabled={cancelling === claim.rowIndex} title="청구 취소">
                                    {cancelling === claim.rowIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                      {isExpanded && !isEditing && (
                        <>
                        <TableRow className="bg-slate-50/80">
                          <TableCell colSpan={colCount} className="py-2 px-6 text-xs text-slate-600">
                            <span className="font-medium">{claim.bankName}</span>
                            {' '}{claim.accountNumber}
                            {claim.accountHolder && claim.accountHolder !== claim.claimant && (
                              <span className="text-slate-500"> (예금주: {claim.accountHolder})</span>
                            )}
                            {claim.accountHolder && claim.accountHolder === claim.claimant && (
                              <span className="text-slate-400"> (본인)</span>
                            )}
                            {claim.receiptUrl && claim.receiptUrl.startsWith('http') ? (
                              // 구글드라이브 링크 (쉼표 구분 복수 가능)
                              claim.receiptUrl.split(',').map((url, i) => {
                                const trimmed = url.trim();
                                if (!trimmed.startsWith('http')) return null;
                                return (
                                  <a
                                    key={i}
                                    href={trimmed}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-blue-500 hover:text-blue-700 hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    영수증{claim.receiptUrl!.includes(',') ? ` ${i + 1}` : ''}
                                  </a>
                                );
                              })
                            ) : claim.receiptUrl ? (
                              // Supabase 영수증 (쉼표 구분 복수 → 개별 링크)
                              claim.receiptUrl.split(',').map((path, i) => (
                                <button
                                  key={i}
                                  className="ml-2 text-blue-500 hover:text-blue-700 hover:underline"
                                  onClick={e => { e.stopPropagation(); handleViewReceipt(path.trim()); }}
                                >
                                  영수증{claim.receiptUrl!.includes(',') ? ` ${i + 1}` : ' 보기'}
                                </button>
                              ))
                            ) : null}
                          </TableCell>
                        </TableRow>
                        {isAdmin && verifMap.get(claim.rowIndex)?.failReason && (
                          <TableRow className="bg-amber-50/60">
                            <TableCell colSpan={colCount} className="py-1.5 px-6 text-xs text-amber-700">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {verifMap.get(claim.rowIndex)!.failReason}
                            </TableCell>
                          </TableRow>
                        )}
                        </>
                      )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* 하단 요약 */}
            <div className="px-4 py-3 border-t bg-slate-50 flex flex-wrap justify-end gap-4 text-sm">
              {unpaidClaims.length > 0 && (
                <span className="text-slate-500">
                  미처리 <span className="font-semibold text-slate-700">{unpaidClaims.length}건</span>
                  {' / '}
                  {unpaidClaims.reduce((s, c) => s + c.amount, 0).toLocaleString()}원
                </span>
              )}
              <span className="text-slate-500">
                전체 <span className="font-semibold text-slate-700">{claims.length}건</span>
                {' / '}
                {claims.reduce((s, c) => s + c.amount, 0).toLocaleString()}원
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 처리 안내 (admin 전용) */}
      {isAdmin && !loading && (
        <div className="text-xs text-slate-400 space-y-0.5 pl-1">
          <p>• <strong>입금완료 표시</strong>: 이체 당일, 체크박스 선택 후 클릭 → 청구자에게 즉시 입금완료 표시</p>
          <p>• <strong>지출부 대조</strong>: 주일 지출부 동기화 후 클릭 → 지출원장 교차검증 결과 표시</p>
          <p>• <strong>엑셀 다운로드</strong>: 이체 파일 생성과 동시에 전체 미처리 건 입금완료 처리</p>
        </div>
      )}
    </div>
  );
}
