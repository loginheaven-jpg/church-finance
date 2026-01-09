'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Plus, RefreshCw, Edit2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CarryoverBalance {
  year: number;
  balance: number;
  construction_balance: number;
  note: string;
  updated_at: string;
  updated_by: string;
}

export default function CarryoverSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<'checking' | 'exists' | 'missing' | 'error'>('checking');
  const [balances, setBalances] = useState<CarryoverBalance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear() - 1,
    balance: '',
    construction_balance: '',
    note: '',
  });

  useEffect(() => {
    checkSheetAndLoad();
  }, []);

  const checkSheetAndLoad = async () => {
    setSheetStatus('checking');
    try {
      // 먼저 시트 존재 여부 확인
      const checkRes = await fetch('/api/sheets/create-sheet?name=이월잔액');
      const checkResult = await checkRes.json();

      if (checkResult.success && checkResult.exists) {
        setSheetStatus('exists');
        loadBalances();
      } else {
        setSheetStatus('missing');
      }
    } catch (err) {
      console.error('Sheet check error:', err);
      setSheetStatus('error');
    }
  };

  const loadBalances = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/carryover');
      const result = await res.json();

      if (result.success) {
        setBalances(result.data || []);
      } else {
        toast.error(result.error || '이월잔액을 불러오는 데 실패했습니다');
      }
    } catch (err) {
      console.error('Load error:', err);
      toast.error('이월잔액을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSheet = async () => {
    setInitializing(true);
    try {
      const res = await fetch('/api/sheets/create-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: '이월잔액' }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('이월잔액 시트가 생성되었습니다');
        setSheetStatus('exists');
        loadBalances();
      } else {
        toast.error(result.error || '시트 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('Create sheet error:', err);
      toast.error('시트 생성 중 오류가 발생했습니다');
    } finally {
      setInitializing(false);
    }
  };

  const handleAdd = () => {
    setEditingYear(null);
    setFormData({
      year: new Date().getFullYear() - 1,
      balance: '',
      construction_balance: '',
      note: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: CarryoverBalance) => {
    setEditingYear(item.year);
    setFormData({
      year: item.year,
      balance: String(item.balance),
      construction_balance: String(item.construction_balance || 0),
      note: item.note || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.balance) {
      toast.error('잔액을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/carryover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: formData.year,
          balance: Number(formData.balance.replace(/,/g, '')),
          construction_balance: Number((formData.construction_balance || '0').replace(/,/g, '')),
          note: formData.note,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(editingYear ? '이월잔액이 수정되었습니다' : '이월잔액이 등록되었습니다');
        setDialogOpen(false);
        loadBalances();
      } else {
        toast.error(result.error || '저장에 실패했습니다');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => amount.toLocaleString() + '원';

  const formatInputAmount = (value: string) => {
    const num = value.replace(/[^\d]/g, '');
    return num ? Number(num).toLocaleString() : '';
  };

  // 시트 확인 중
  if (sheetStatus === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">시트 상태 확인 중...</p>
      </div>
    );
  }

  // 시트가 없는 경우
  if (sheetStatus === 'missing' || sheetStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div className="text-center">
          <h2 className="text-lg font-medium text-slate-900">이월잔액 시트 없음</h2>
          <p className="text-sm text-slate-500 mt-1">
            Google Sheets에 이월잔액 시트가 없습니다. 시트를 생성해주세요.
          </p>
        </div>
        <Button onClick={handleCreateSheet} disabled={initializing}>
          {initializing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          이월잔액 시트 생성
        </Button>
      </div>
    );
  }

  // 데이터 로딩 중
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">이월잔액 설정</h1>
          <p className="text-sm text-slate-500 mt-1">
            연도별 이월잔액을 관리합니다. 전년도 말 잔액이 다음 연도 기초잔액이 됩니다.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          이월잔액 등록
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">이월잔액이란?</p>
              <p>
                전년도 말 잔액을 다음 해 기초잔액으로 이월하는 금액입니다.
                예: 2024년 말 잔액 85,906,978원은 2025년 기초잔액이 됩니다.
              </p>
              <p className="mt-2">
                <strong>일반회계</strong>와 <strong>건축회계</strong>를 분리하여 관리할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balances Table */}
      <Card>
        <CardHeader>
          <CardTitle>연도별 이월잔액</CardTitle>
          <CardDescription>
            등록된 이월잔액 목록입니다. 연도를 클릭하면 해당 연도의 이월잔액을 수정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              등록된 이월잔액이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기준 연도</TableHead>
                  <TableHead className="text-right">일반회계 잔액</TableHead>
                  <TableHead className="text-right">건축회계 잔액</TableHead>
                  <TableHead className="text-right">합계</TableHead>
                  <TableHead>비고</TableHead>
                  <TableHead>수정일</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.sort((a, b) => b.year - a.year).map((item) => (
                  <TableRow key={item.year}>
                    <TableCell className="font-medium">{item.year}년 말</TableCell>
                    <TableCell className="text-right text-blue-600 font-medium">
                      {formatAmount(item.balance)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatAmount(item.construction_balance || 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatAmount(item.balance + (item.construction_balance || 0))}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">
                      {item.note || '-'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {item.updated_at?.split(' ')[0] || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingYear ? `${editingYear}년 이월잔액 수정` : '이월잔액 등록'}
            </DialogTitle>
            <DialogDescription>
              해당 연도 말 기준 잔액을 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="year">기준 연도</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                disabled={!!editingYear}
                min={2003}
                max={new Date().getFullYear()}
              />
              <p className="text-xs text-slate-500">
                {formData.year}년 말 잔액 = {formData.year + 1}년 기초잔액
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">일반회계 잔액</Label>
              <Input
                id="balance"
                value={formData.balance}
                onChange={(e) =>
                  setFormData({ ...formData, balance: formatInputAmount(e.target.value) })
                }
                placeholder="0"
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="construction_balance">건축회계 잔액 (선택)</Label>
              <Input
                id="construction_balance"
                value={formData.construction_balance}
                onChange={(e) =>
                  setFormData({ ...formData, construction_balance: formatInputAmount(e.target.value) })
                }
                placeholder="0"
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">비고 (선택)</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="메모를 입력하세요"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
