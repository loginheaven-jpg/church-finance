'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Plus, Save, Trash2, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Budget, ExpenseCode } from '@/types';

export default function BudgetSettingsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedBudgets, setEditedBudgets] = useState<Map<number, number>>(new Map());

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetRes, codesRes] = await Promise.all([
        fetch(`/api/settings/budget?year=${year}`),
        fetch('/api/codes?type=expense'),
      ]);

      const budgetData = await budgetRes.json();
      const codesData = await codesRes.json();

      if (budgetData.success) {
        setBudgets(budgetData.data || []);
      }
      if (codesData.success) {
        setExpenseCodes(codesData.data || []);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 예산 금액 변경 핸들러
  const handleAmountChange = (accountCode: number, amount: string) => {
    const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    setEditedBudgets(prev => new Map(prev).set(accountCode, numAmount));
  };

  // 저장
  const handleSave = async (accountCode: number) => {
    const amount = editedBudgets.get(accountCode);
    if (amount === undefined) return;

    setSaving(true);
    try {
      const res = await fetch('/api/settings/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          account_code: accountCode,
          budgeted_amount: amount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('예산이 저장되었습니다');
        setEditedBudgets(prev => {
          const next = new Map(prev);
          next.delete(accountCode);
          return next;
        });
        loadData();
      } else {
        toast.error(data.error || '저장 실패');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 전체 저장
  const handleSaveAll = async () => {
    if (editedBudgets.size === 0) {
      toast.info('변경된 예산이 없습니다');
      return;
    }

    setSaving(true);
    try {
      const promises = Array.from(editedBudgets.entries()).map(([accountCode, amount]) =>
        fetch('/api/settings/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year,
            account_code: accountCode,
            budgeted_amount: amount,
          }),
        })
      );

      await Promise.all(promises);
      toast.success(`${editedBudgets.size}개의 예산이 저장되었습니다`);
      setEditedBudgets(new Map());
      loadData();
    } catch (error) {
      console.error('Save all error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (accountCode: number) => {
    if (!confirm('이 예산 항목을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/settings/budget?year=${year}&account_code=${accountCode}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('예산이 삭제되었습니다');
        loadData();
      } else {
        toast.error(data.error || '삭제 실패');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('삭제 중 오류가 발생했습니다');
    }
  };

  // 카테고리별 그룹화
  const groupedCodes = expenseCodes.reduce((acc, code) => {
    if (!acc.has(code.category_code)) {
      acc.set(code.category_code, {
        category_code: code.category_code,
        category_item: code.category_item,
        codes: [],
      });
    }
    acc.get(code.category_code)!.codes.push(code);
    return acc;
  }, new Map<number, { category_code: number; category_item: string; codes: ExpenseCode[] }>());

  // 예산 맵 생성
  const budgetMap = new Map(budgets.map(b => [b.account_code, b]));

  // 합계 계산
  const totalBudget = Array.from(budgetMap.values()).reduce((sum, b) => sum + (b.budgeted_amount || 0), 0);
  const editedTotal = Array.from(editedBudgets.values()).reduce((sum, amount) => {
    // 기존 예산에서 차이 계산
    return sum;
  }, 0);

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
          <h1 className="text-2xl font-bold text-slate-900">예산 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            지출 계정과목별 예산을 설정합니다
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(y => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium w-20 text-center">{year}년</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(y => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Save All Button */}
          {editedBudgets.size > 0 && (
            <Button onClick={handleSaveAll} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              전체 저장 ({editedBudgets.size}건)
            </Button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            예산 현황 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">총 예산</div>
              <div className="text-xl font-bold text-slate-900">
                {totalBudget.toLocaleString()}원
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">설정 항목</div>
              <div className="text-xl font-bold text-slate-900">
                {budgets.length}개 / {expenseCodes.filter(c => c.code % 10 !== 0).length}개
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">미설정 항목</div>
              <div className="text-xl font-bold text-orange-600">
                {expenseCodes.filter(c => c.code % 10 !== 0 && !budgetMap.has(c.code)).length}개
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm text-slate-500">변경 대기</div>
              <div className="text-xl font-bold text-blue-600">
                {editedBudgets.size}개
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Table by Category */}
      {Array.from(groupedCodes.values()).map(category => {
        // 카테고리 코드는 제외 (세부항목만)
        const itemCodes = category.codes.filter(c => c.code % 10 !== 0);
        if (itemCodes.length === 0) return null;

        const categoryTotal = itemCodes.reduce((sum, code) => {
          const edited = editedBudgets.get(code.code);
          const budget = budgetMap.get(code.code);
          return sum + (edited ?? budget?.budgeted_amount ?? 0);
        }, 0);

        return (
          <Card key={category.category_code}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{category.category_item} ({category.category_code})</span>
                <span className="text-sm font-normal text-slate-500">
                  소계: {categoryTotal.toLocaleString()}원
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">코드</TableHead>
                    <TableHead>항목명</TableHead>
                    <TableHead className="w-40 text-right">예산금액</TableHead>
                    <TableHead className="w-24 text-center">상태</TableHead>
                    <TableHead className="w-24 text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemCodes.map(code => {
                    const budget = budgetMap.get(code.code);
                    const editedAmount = editedBudgets.get(code.code);
                    const currentAmount = editedAmount ?? budget?.budgeted_amount ?? 0;
                    const isEdited = editedBudgets.has(code.code);

                    return (
                      <TableRow key={code.code} className={isEdited ? 'bg-blue-50' : ''}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell>{code.item}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            className="w-full text-right"
                            value={currentAmount.toLocaleString()}
                            onChange={(e) => handleAmountChange(code.code, e.target.value)}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {isEdited ? (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              변경됨
                            </span>
                          ) : budget ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                              설정됨
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded">
                              미설정
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            {isEdited && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSave(code.code)}
                                disabled={saving}
                              >
                                <Save className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {budget && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDelete(code.code)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
