'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Target,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Save,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useYear } from '@/contexts/YearContext';
import type { Pledge, OfferingType, PledgePeriod } from '@/types';

type FilterType = 'building' | 'mission' | 'all';

// 작정 주기별 연간 횟수
const PERIOD_MULTIPLIER: Record<PledgePeriod, number> = {
  weekly: 52,
  monthly: 12,
  yearly: 1,
};

const PERIOD_LABELS: Record<PledgePeriod, string> = {
  weekly: '주',
  monthly: '월',
  yearly: '연',
};

const OFFERING_TYPE_LABELS: Record<OfferingType, string> = {
  building: '건축헌금',
  mission: '선교헌금',
  weekly: '주정헌금',
};

// 시트 입력 행 인터페이스
interface BulkEntryRow {
  id: string;
  offering_type: OfferingType;
  donor_name: string;
  start_date: string;
  end_date: string;
  pledge_period: PledgePeriod;
  amount: string;
  yearly_amount: number;
}

const createEmptyRow = (year: number): BulkEntryRow => ({
  id: crypto.randomUUID(),
  offering_type: 'building',
  donor_name: '',
  start_date: `${year}-01-01`,
  end_date: `${year}-12-31`,
  pledge_period: 'monthly',
  amount: '',
  yearly_amount: 0,
});

export default function PledgeManagementPage() {
  const { year, setYear } = useYear();
  const [selectedType, setSelectedType] = useState<FilterType>('building');
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 시트형 대량 입력 상태
  const [bulkRows, setBulkRows] = useState<BulkEntryRow[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);

  // 셀 이동 (엑셀 스타일)
  const EDITABLE_COLUMNS = ['donor_name', 'start_date', 'end_date', 'amount'];

  const moveCellFocus = (currentRowIdx: number, currentCol: string, direction: 'down' | 'right') => {
    if (!tableRef.current) return;

    const colIdx = EDITABLE_COLUMNS.indexOf(currentCol);
    let nextRowIdx = currentRowIdx;
    let nextColIdx = colIdx;

    if (direction === 'down') {
      nextRowIdx = currentRowIdx + 1;
      // 마지막 행이면 새 행 추가
      if (nextRowIdx >= bulkRows.length) {
        addRow();
        // 새 행 추가 후 setTimeout으로 포커스
        setTimeout(() => {
          const nextInput = tableRef.current?.querySelector(
            `[data-row="${nextRowIdx}"][data-col="${currentCol}"]`
          ) as HTMLInputElement;
          nextInput?.focus();
        }, 50);
        return;
      }
    } else if (direction === 'right') {
      nextColIdx = colIdx + 1;
      if (nextColIdx >= EDITABLE_COLUMNS.length) {
        nextColIdx = 0;
        nextRowIdx = currentRowIdx + 1;
        if (nextRowIdx >= bulkRows.length) {
          addRow();
          setTimeout(() => {
            const nextInput = tableRef.current?.querySelector(
              `[data-row="${nextRowIdx}"][data-col="${EDITABLE_COLUMNS[0]}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
          }, 50);
          return;
        }
      }
    }

    const nextCol = EDITABLE_COLUMNS[nextColIdx];
    const nextInput = tableRef.current?.querySelector(
      `[data-row="${nextRowIdx}"][data-col="${nextCol}"]`
    ) as HTMLInputElement;
    nextInput?.focus();
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    col: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      moveCellFocus(rowIdx, col, 'down');
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      moveCellFocus(rowIdx, col, 'right');
    }
  };

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // v2 API 호출 + recalculate로 누계 갱신
      const offeringTypeParam = selectedType !== 'all' ? `&offering_type=${selectedType}` : '';
      const res = await fetch(`/api/pledges?year=${year}${offeringTypeParam}&recalculate=true`);
      const data = await res.json();

      if (data.success) {
        setPledges(data.pledges || []);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [year, selectedType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 대량 입력 모달 열기 (임시저장 자동 불러오기)
  const openBulkDialog = () => {
    const saved = localStorage.getItem(`pledge_bulk_${year}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBulkRows(parsed);
          setDialogOpen(true);
          return;
        }
      } catch {
        // 파싱 실패 시 빈 행으로 시작
      }
    }
    setBulkRows([createEmptyRow(year), createEmptyRow(year), createEmptyRow(year)]);
    setDialogOpen(true);
  };

  // 행 추가
  const addRow = () => {
    setBulkRows(prev => [...prev, createEmptyRow(year)]);
  };

  // 행 삭제
  const removeRow = (id: string) => {
    setBulkRows(prev => prev.filter(row => row.id !== id));
  };

  // 행 업데이트
  const updateRow = (id: string, field: keyof BulkEntryRow, value: string | number) => {
    setBulkRows(prev => prev.map(row => {
      if (row.id !== id) return row;

      const updated = { ...row, [field]: value };

      // 연간합계 자동 계산
      if (field === 'amount' || field === 'pledge_period' || field === 'start_date' || field === 'end_date') {
        const numAmount = parseInt(String(updated.amount).replace(/,/g, '')) || 0;
        const period = updated.pledge_period;

        if (period === 'monthly') {
          // 월정인 경우: 시작월~종료월 개월수
          const startMonth = new Date(updated.start_date).getMonth() + 1;
          const endMonth = new Date(updated.end_date).getMonth() + 1;
          const months = endMonth - startMonth + 1;
          updated.yearly_amount = numAmount * months;
        } else {
          updated.yearly_amount = numAmount * PERIOD_MULTIPLIER[period];
        }
      }

      return updated;
    }));
  };

  // 리셋
  const resetBulkRows = () => {
    setBulkRows([createEmptyRow(year), createEmptyRow(year), createEmptyRow(year)]);
  };

  // 임시저장 (localStorage)
  const saveTempBulkRows = () => {
    localStorage.setItem(`pledge_bulk_${year}`, JSON.stringify(bulkRows));
    toast.success('임시저장되었습니다');
  };

  // 임시저장 불러오기
  const loadTempBulkRows = () => {
    const saved = localStorage.getItem(`pledge_bulk_${year}`);
    if (saved) {
      setBulkRows(JSON.parse(saved));
    }
  };

  // 등록
  const submitBulkRows = async () => {
    // 유효한 행만 필터링 (작정자명과 금액이 있는 행)
    const validRows = bulkRows.filter(row =>
      row.donor_name.trim() && row.amount && parseInt(row.amount.replace(/,/g, '')) > 0
    );

    if (validRows.length === 0) {
      toast.error('등록할 작정 데이터가 없습니다');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      try {
        const startMonth = new Date(row.start_date).getMonth() + 1;
        const endMonth = new Date(row.end_date).getMonth() + 1;
        const numAmount = parseInt(row.amount.replace(/,/g, ''));

        const res = await fetch('/api/pledges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donor_name: row.donor_name,
            representative: row.donor_name, // 기본값으로 작정자명 사용
            offering_type: row.offering_type,
            pledge_period: row.pledge_period,
            amount: numAmount,
            year,
            start_month: startMonth,
            end_month: endMonth,
          }),
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Error for ${row.donor_name}:`, data.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error for ${row.donor_name}:`, error);
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast.success(`${successCount}건 등록 완료${errorCount > 0 ? `, ${errorCount}건 실패` : ''}`);
      localStorage.removeItem(`pledge_bulk_${year}`);
      setDialogOpen(false);
      loadData();
    } else {
      toast.error('등록에 실패했습니다');
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 작정헌금을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/pledges/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('작정헌금이 삭제되었습니다');
        loadData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(String(error));
    }
  };

  // 필터링된 작정 (active만)
  const activePledges = pledges.filter(p => p.status === 'active');

  // 합계 계산
  const totalPledged = activePledges.reduce((sum, p) => sum + p.yearly_amount, 0);
  const totalFulfilled = activePledges.reduce((sum, p) => sum + p.fulfilled_amount, 0);
  const overallRate = totalPledged > 0 ? Math.round((totalFulfilled / totalPledged) * 100) : 0;

  // 상태별 카운트
  const fulfilledCount = activePledges.filter(p => p.fulfilled_amount >= p.yearly_amount).length;
  const inProgressCount = activePledges.filter(p =>
    p.fulfilled_amount > 0 && p.fulfilled_amount < p.yearly_amount
  ).length;
  const notStartedCount = activePledges.filter(p => p.fulfilled_amount === 0).length;

  // 금액 포맷
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
    if (amount >= 10000) return `${Math.round(amount / 10000)}만`;
    return amount.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">작정헌금 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            연간 헌금 작정 현황을 관리합니다
          </p>
          {/* Type Tabs */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={selectedType === 'building' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('building')}
            >
              건축헌금
            </Button>
            <Button
              variant={selectedType === 'mission' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('mission')}
            >
              선교헌금
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium w-20 text-center">{year}년</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Add Button */}
          <Button onClick={openBulkDialog}>
            <Plus className="h-4 w-4 mr-2" />
            작정 등록
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">총 작정</div>
            <div className="text-xl font-bold text-slate-900">
              {formatAmount(totalPledged)}원
            </div>
            <div className="text-xs text-slate-400">{activePledges.length}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">총 실행</div>
            <div className="text-xl font-bold text-green-600">
              {formatAmount(totalFulfilled)}원
            </div>
            <div className="text-xs text-slate-400">{overallRate}% 달성</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">완료</div>
            <div className="text-xl font-bold text-blue-600">{fulfilledCount}명</div>
            <div className="text-xs text-slate-400">100% 이상</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">진행중</div>
            <div className="text-xl font-bold text-yellow-600">{inProgressCount}명</div>
            <div className="text-xs text-slate-400">1~99%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">미시작</div>
            <div className="text-xl font-bold text-red-600">{notStartedCount}명</div>
            <div className="text-xs text-slate-400">0%</div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            전체 달성률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>실행 / 작정</span>
              <span className="font-medium">
                {formatAmount(totalFulfilled)} / {formatAmount(totalPledged)}원
              </span>
            </div>
            <Progress value={Math.min(overallRate, 100)} className="h-3" />
            <div className="text-right text-sm text-slate-500">
              {overallRate}% 달성
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pledge List */}
      <Card>
        <CardHeader>
          <CardTitle>작정 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {activePledges.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              등록된 작정헌금이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>작정자</TableHead>
                  <TableHead>헌금종류</TableHead>
                  <TableHead>주기</TableHead>
                  <TableHead className="text-right">주기당 금액</TableHead>
                  <TableHead className="text-right">연간 작정</TableHead>
                  <TableHead className="text-right">실행금액</TableHead>
                  <TableHead className="w-32">달성률</TableHead>
                  <TableHead className="w-20 text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePledges.map((pledge) => {
                  const rate = pledge.yearly_amount > 0
                    ? Math.round((pledge.fulfilled_amount / pledge.yearly_amount) * 100)
                    : 0;
                  return (
                    <TableRow key={pledge.id}>
                      <TableCell className="font-medium">{pledge.donor_name}</TableCell>
                      <TableCell>{OFFERING_TYPE_LABELS[pledge.offering_type]}</TableCell>
                      <TableCell>{PERIOD_LABELS[pledge.pledge_period]}</TableCell>
                      <TableCell className="text-right">
                        {pledge.amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right">
                        {pledge.yearly_amount.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={rate >= 100 ? 'text-green-600 font-medium' : ''}>
                          {pledge.fulfilled_amount.toLocaleString()}원
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress
                            value={Math.min(rate, 100)}
                            className={`h-2 ${
                              rate >= 100
                                ? '[&>div]:bg-green-500'
                                : rate >= 50
                                ? '[&>div]:bg-yellow-500'
                                : '[&>div]:bg-red-500'
                            }`}
                          />
                          <div className="text-xs text-right text-slate-500">
                            {rate}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(pledge.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 대량 입력 모달 - 화면 폭에 맞게 최대 확장 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[95vw] w-full max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>작정헌금 일괄 등록</DialogTitle>
            <p className="text-sm text-slate-500">Enter: 아래 셀로 이동 | Tab: 오른쪽 셀로 이동</p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 시트형 테이블 - 엑셀 스타일 */}
            <div className="border rounded-lg">
              <Table ref={tableRef}>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="min-w-[100px]">헌금종류</TableHead>
                    <TableHead className="min-w-[120px]">작정자명</TableHead>
                    <TableHead className="min-w-[140px]">시작일</TableHead>
                    <TableHead className="min-w-[140px]">종료일</TableHead>
                    <TableHead className="min-w-[80px]">주기</TableHead>
                    <TableHead className="min-w-[140px]">주기당 금액</TableHead>
                    <TableHead className="min-w-[140px] bg-slate-100">연간합계</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkRows.map((row, rowIdx) => (
                    <TableRow key={row.id}>
                      <TableCell className="p-1">
                        <Select
                          value={row.offering_type}
                          onValueChange={(v) => updateRow(row.id, 'offering_type', v as OfferingType)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="building">건축헌금</SelectItem>
                            <SelectItem value="mission">선교헌금</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-9"
                          placeholder="홍길동"
                          value={row.donor_name}
                          onChange={(e) => updateRow(row.id, 'donor_name', e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'donor_name')}
                          data-row={rowIdx}
                          data-col="donor_name"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          className="h-9"
                          value={row.start_date}
                          onChange={(e) => updateRow(row.id, 'start_date', e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'start_date')}
                          data-row={rowIdx}
                          data-col="start_date"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          className="h-9"
                          value={row.end_date}
                          onChange={(e) => updateRow(row.id, 'end_date', e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'end_date')}
                          data-row={rowIdx}
                          data-col="end_date"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={row.pledge_period}
                          onValueChange={(v) => updateRow(row.id, 'pledge_period', v as PledgePeriod)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">주</SelectItem>
                            <SelectItem value="monthly">월</SelectItem>
                            <SelectItem value="yearly">연</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-9 text-right"
                          placeholder="100,000"
                          value={row.amount}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            updateRow(row.id, 'amount', value ? Number(value).toLocaleString() : '');
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'amount')}
                          data-row={rowIdx}
                          data-col="amount"
                        />
                      </TableCell>
                      <TableCell className="p-1 bg-slate-50">
                        <div className="h-9 flex items-center justify-end px-3 text-sm font-medium text-slate-700">
                          {row.yearly_amount > 0 ? `${row.yearly_amount.toLocaleString()}원` : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-slate-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 행 추가 버튼 */}
            <Button variant="outline" onClick={addRow} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              행 추가
            </Button>

            {/* 버튼 영역 */}
            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetBulkRows}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  리셋
                </Button>
                <Button variant="outline" onClick={saveTempBulkRows}>
                  <Save className="h-4 w-4 mr-2" />
                  임시저장
                </Button>
                <Button variant="ghost" onClick={loadTempBulkRows}>
                  임시저장 불러오기
                </Button>
              </div>
              <Button onClick={submitBulkRows} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
