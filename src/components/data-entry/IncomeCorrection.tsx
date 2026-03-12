'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, Pencil, Split, Trash2, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import type { IncomeRecord, IncomeCode } from '@/types';

interface SearchParams {
  startDate: string;
  endDate: string;
  donorName: string;
  minAmount: string;
  maxAmount: string;
}

interface SplitRow {
  offering_code: number;
  donor_name: string;
  amount: number;
  note: string;
}

export function IncomeCorrection() {
  // 검색 상태
  const [search, setSearch] = useState<SearchParams>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    donorName: '',
    minAmount: '',
    maxAmount: '',
  });
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(false);

  // 코드 목록
  const [incomeCodes, setIncomeCodes] = useState<IncomeCode[]>([]);

  // 수정 다이얼로그
  const [editRecord, setEditRecord] = useState<IncomeRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<IncomeRecord>>({});
  const [saving, setSaving] = useState(false);

  // 분할 다이얼로그
  const [splitRecord, setSplitRecord] = useState<IncomeRecord | null>(null);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [splitting, setSplitting] = useState(false);

  // 삭제 다이얼로그
  const [deleteRecord, setDeleteRecord] = useState<IncomeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 수입코드 로드
  useEffect(() => {
    fetch('/api/codes/income')
      .then(res => res.json())
      .then(data => {
        if (data.success) setIncomeCodes(data.data || []);
      })
      .catch(() => {});
  }, []);

  const formatAmount = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const getCodeName = (code: number) => {
    const found = incomeCodes.find(c => c.code === code);
    return found ? found.item : `코드${code}`;
  };

  // 검색
  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.startDate) params.set('startDate', search.startDate);
      if (search.endDate) params.set('endDate', search.endDate);
      if (search.donorName) params.set('donorName', search.donorName);
      if (search.minAmount) params.set('minAmount', search.minAmount);
      if (search.maxAmount) params.set('maxAmount', search.maxAmount);

      const res = await fetch(`/api/income/records?${params}`);
      const data = await res.json();

      if (data.success) {
        setRecords(data.data.records);
        setSummary(data.data.summary);
      } else {
        toast.error(data.error || '검색 실패');
      }
    } catch {
      toast.error('검색 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 수정 시작
  const openEdit = (record: IncomeRecord) => {
    setEditRecord(record);
    setEditForm({
      date: record.date,
      donor_name: record.donor_name,
      representative: record.representative,
      offering_code: record.offering_code,
      amount: record.amount,
      note: record.note,
    });
  };

  // 수정 저장
  const handleSave = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/income/records/${editRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('수정 완료');
        setEditRecord(null);
        handleSearch(); // 재검색
      } else {
        toast.error(data.error || '수정 실패');
      }
    } catch {
      toast.error('수정 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 분할 시작
  const openSplit = (record: IncomeRecord) => {
    setSplitRecord(record);
    setSplitRows([
      { offering_code: record.offering_code, donor_name: record.donor_name, amount: 0, note: '' },
      { offering_code: record.offering_code, donor_name: record.donor_name, amount: 0, note: '' },
    ]);
  };

  // 분할 행 추가
  const addSplitRow = () => {
    if (!splitRecord) return;
    // 기존 행들의 금액 합산 → 새 마지막 행에 차액 자동 입력
    const currentSum = splitRows.reduce((sum, r) => sum + r.amount, 0);
    const remainder = Math.max(0, splitRecord.amount - currentSum);
    setSplitRows([...splitRows, {
      offering_code: splitRecord.offering_code,
      donor_name: splitRecord.donor_name,
      amount: remainder,
      note: '',
    }]);
  };

  // 분할 행 제거
  const removeSplitRow = (index: number) => {
    if (splitRows.length <= 2) return;
    const remaining = splitRows.filter((_, i) => i !== index);
    // 마지막 행에 차액 자동 반영
    if (splitRecord && remaining.length >= 2) {
      const sumExceptLast = remaining.slice(0, -1).reduce((sum, r) => sum + r.amount, 0);
      remaining[remaining.length - 1].amount = Math.max(0, splitRecord.amount - sumExceptLast);
    }
    setSplitRows(remaining);
  };

  // 분할 행 수정
  const updateSplitRow = (index: number, field: keyof SplitRow, value: string | number) => {
    const updated = [...splitRows];
    if (field === 'amount') {
      updated[index][field] = Number(value) || 0;
      // 마지막 행이 아닌 곳의 금액 변경 시, 마지막 행에 차액 자동 입력
      if (splitRecord && index < updated.length - 1) {
        const sumExceptLast = updated.slice(0, -1).reduce((sum, r) => sum + r.amount, 0);
        const remainder = splitRecord.amount - sumExceptLast;
        updated[updated.length - 1].amount = Math.max(0, remainder);
      }
    } else if (field === 'offering_code') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = String(value);
    }
    setSplitRows(updated);
  };

  const splitTotal = splitRows.reduce((sum, r) => sum + r.amount, 0);
  const splitMatch = splitRecord ? splitTotal === splitRecord.amount : false;

  // 분할 실행
  const handleSplit = async () => {
    if (!splitRecord || !splitMatch) return;
    setSplitting(true);
    try {
      const res = await fetch('/api/income/records/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalId: splitRecord.id,
          newRecords: splitRows.map(r => ({
            offering_code: r.offering_code,
            donor_name: r.donor_name,
            amount: r.amount,
            note: r.note,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.splitCount}건으로 분할 완료`);
        setSplitRecord(null);
        handleSearch();
      } else {
        toast.error(data.error || '분할 실패');
      }
    } catch {
      toast.error('분할 중 오류가 발생했습니다');
    } finally {
      setSplitting(false);
    }
  };

  // 삭제 실행
  const handleDelete = async () => {
    if (!deleteRecord) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/income/records/${deleteRecord.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('삭제 완료');
        setDeleteRecord(null);
        handleSearch();
      } else {
        toast.error(data.error || '삭제 실패');
      }
    } catch {
      toast.error('삭제 중 오류가 발생했습니다');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 검색 영역 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">수입부 데이터 검색</CardTitle>
          <CardDescription>수정, 분할, 삭제할 수입 레코드를 검색합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">시작일</Label>
              <Input
                type="date"
                value={search.startDate}
                onChange={e => setSearch({ ...search, startDate: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">종료일</Label>
              <Input
                type="date"
                value={search.endDate}
                onChange={e => setSearch({ ...search, endDate: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">헌금자명</Label>
              <Input
                placeholder="이름 검색"
                value={search.donorName}
                onChange={e => setSearch({ ...search, donorName: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">최소금액</Label>
              <Input
                type="number"
                placeholder="0"
                value={search.minAmount}
                onChange={e => setSearch({ ...search, minAmount: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">최대금액</Label>
              <Input
                type="number"
                placeholder="무제한"
                value={search.maxAmount}
                onChange={e => setSearch({ ...search, maxAmount: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <Button onClick={handleSearch} disabled={loading} className="mt-3 bg-[#C9A962] hover:bg-[#B8963F]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            검색
          </Button>
        </CardContent>
      </Card>

      {/* 검색 결과 */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                검색 결과: {summary.count}건
              </CardTitle>
              <span className="text-sm font-semibold text-[#C9A962]">
                합계 {formatAmount(summary.totalAmount)}원
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">날짜</TableHead>
                    <TableHead>헌금자</TableHead>
                    <TableHead className="hidden md:table-cell">대표자</TableHead>
                    <TableHead className="w-[120px]">코드</TableHead>
                    <TableHead className="text-right w-[100px]">금액</TableHead>
                    <TableHead className="hidden md:table-cell">비고</TableHead>
                    <TableHead className="hidden md:table-cell w-[70px]">입력방법</TableHead>
                    <TableHead className="w-[120px] text-center">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs">{record.date?.slice(5)}</TableCell>
                      <TableCell className="font-medium text-sm">{record.donor_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{record.representative}</TableCell>
                      <TableCell className="text-xs">{record.offering_code} {getCodeName(record.offering_code)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatAmount(record.amount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[150px] truncate">{record.note}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{record.input_method}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(record)}
                            title="수정"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-blue-600"
                            onClick={() => openSplit(record)}
                            title="분할"
                          >
                            <Split className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600"
                            onClick={() => setDeleteRecord(record)}
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검색 결과 없음 */}
      {!loading && records.length === 0 && summary.count === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            검색 조건을 입력하고 검색 버튼을 눌러주세요
          </CardContent>
        </Card>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editRecord} onOpenChange={open => !open && setEditRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>수입 레코드 수정</DialogTitle>
            <DialogDescription>
              {editRecord?.donor_name} / {formatAmount(editRecord?.amount || 0)}원
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">날짜</Label>
              <Input
                type="date"
                value={editForm.date || ''}
                onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">헌금자</Label>
              <Input
                value={editForm.donor_name || ''}
                onChange={e => setEditForm({ ...editForm, donor_name: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">대표자</Label>
              <Input
                value={editForm.representative || ''}
                onChange={e => setEditForm({ ...editForm, representative: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">헌금코드</Label>
              <Select
                value={String(editForm.offering_code || '')}
                onValueChange={v => setEditForm({ ...editForm, offering_code: Number(v) })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="코드 선택" />
                </SelectTrigger>
                <SelectContent>
                  {incomeCodes.map(code => (
                    <SelectItem key={code.code} value={String(code.code)}>
                      {code.code} - {code.item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">금액</Label>
              <Input
                type="number"
                value={editForm.amount || ''}
                onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">비고</Label>
              <Input
                value={editForm.note || ''}
                onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#C9A962] hover:bg-[#B8963F]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 분할 다이얼로그 */}
      <Dialog open={!!splitRecord} onOpenChange={open => !open && setSplitRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>수입 레코드 분할</DialogTitle>
            <DialogDescription>
              원본: {splitRecord?.donor_name} / {formatAmount(splitRecord?.amount || 0)}원 / {getCodeName(splitRecord?.offering_code || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {splitRows.map((row, i) => (
              <div key={i} className="flex items-end gap-2 p-2 bg-muted/50 rounded">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">코드</Label>
                  <Select
                    value={String(row.offering_code)}
                    onValueChange={v => updateSplitRow(i, 'offering_code', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeCodes.map(code => (
                        <SelectItem key={code.code} value={String(code.code)}>
                          {code.code} {code.item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[100px]">
                  <Label className="text-xs">금액</Label>
                  <Input
                    type="number"
                    value={row.amount || ''}
                    onChange={e => updateSplitRow(i, 'amount', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">비고</Label>
                  <Input
                    value={row.note}
                    onChange={e => updateSplitRow(i, 'note', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="선택사항"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500"
                  onClick={() => removeSplitRow(i)}
                  disabled={splitRows.length <= 2}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSplitRow} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> 행 추가
            </Button>
            <div className={`text-sm font-semibold text-center p-2 rounded ${splitMatch ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              분할 합계: {formatAmount(splitTotal)}원
              {splitMatch
                ? ' = 원본 금액 (일치)'
                : ` ≠ 원본 ${formatAmount(splitRecord?.amount || 0)}원 (차액: ${formatAmount(Math.abs(splitTotal - (splitRecord?.amount || 0)))}원)`
              }
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitRecord(null)}>취소</Button>
            <Button
              onClick={handleSplit}
              disabled={splitting || !splitMatch}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {splitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              분할 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteRecord} onOpenChange={open => !open && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>수입 레코드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              다음 레코드를 삭제하시겠습니까?<br />
              <strong>{deleteRecord?.donor_name}</strong> / {formatAmount(deleteRecord?.amount || 0)}원 / {deleteRecord?.date}
              <br /><br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
