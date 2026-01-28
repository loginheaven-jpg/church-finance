'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle2, FileSpreadsheet, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BankTransaction, IncomeRecord, ExpenseRecord, MatchingRule } from '@/types';

// 매칭 결과 타입
interface MatchedIncomeItem {
  transaction: BankTransaction;
  record: IncomeRecord;
  match: MatchingRule | null;
}

interface MatchedExpenseItem {
  transaction: BankTransaction;
  record: ExpenseRecord;
  match: MatchingRule | null;
}

// 헌금함 매칭 현황 타입
interface CashOfferingMatchStatus {
  date: string;
  incomeTotal: number;
  bankAmount: number;
  matched: boolean;
}

interface MatchPreviewResult {
  income: MatchedIncomeItem[];
  expense: MatchedExpenseItem[];
  suppressed: BankTransaction[];
  needsReview: Array<{
    transaction: BankTransaction;
    suggestions: MatchingRule[];
  }>;
  cashOfferingMatchStatus?: CashOfferingMatchStatus[];
}

// 탭 타입
type TabType = 'income' | 'expense';

// 통합 아이템 타입
type ItemType = 'suppressed' | 'needsReview' | 'matched';

interface UnifiedIncomeItem {
  type: ItemType;
  transaction: BankTransaction;
  record: IncomeRecord | null;
  match: MatchingRule | null;
}

interface UnifiedExpenseItem {
  type: ItemType;
  transaction: BankTransaction;
  record: ExpenseRecord | null;
  match: MatchingRule | null;
  suggestions?: MatchingRule[];
}

export function FinanceReflection() {
  const [loading, setLoading] = useState(false);
  const [confirmingIncome, setConfirmingIncome] = useState(false);
  const [confirmingExpense, setConfirmingExpense] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('income');
  const [matchResult, setMatchResult] = useState<MatchPreviewResult | null>(null);
  const [unifiedIncome, setUnifiedIncome] = useState<UnifiedIncomeItem[]>([]);
  const [unifiedExpense, setUnifiedExpense] = useState<UnifiedExpenseItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [reflectionResult, setReflectionResult] = useState<{
    type: 'income' | 'expense';
    count: number;
    suppressedCount: number;
    amount: number;
  } | null>(null);

  // 통합 리스트 생성
  const buildUnifiedLists = useCallback((result: MatchPreviewResult) => {
    const incomeItems: UnifiedIncomeItem[] = [
      ...result.suppressed
        .filter(tx => tx.deposit > 0)
        .map(tx => ({ type: 'suppressed' as ItemType, transaction: tx, record: null, match: null })),
      ...result.income
        .map(item => ({ type: 'matched' as ItemType, transaction: item.transaction, record: item.record, match: item.match })),
    ];

    const expenseItems: UnifiedExpenseItem[] = [
      ...result.suppressed
        .filter(tx => tx.withdrawal > 0)
        .map(tx => ({ type: 'suppressed' as ItemType, transaction: tx, record: null, match: null })),
      ...result.needsReview
        .map(item => ({ type: 'needsReview' as ItemType, transaction: item.transaction, record: null, match: null, suggestions: item.suggestions })),
      ...result.expense
        .map(item => ({ type: 'matched' as ItemType, transaction: item.transaction, record: item.record, match: item.match })),
    ];

    setUnifiedIncome(incomeItems);
    setUnifiedExpense(expenseItems);
  }, []);

  // 미반영 항목 조회 및 매칭
  const loadPendingTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // pending 상태의 은행거래 조회 및 자동 매칭
      const res = await fetch('/api/match/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // transactionIds 없으면 pending 전체 조회
      });

      const result = await res.json();

      if (result.success) {
        setMatchResult(result.data);
        buildUnifiedLists(result.data);

        const totalPending = result.data.income.length + result.data.expense.length +
                            result.data.suppressed.length + result.data.needsReview.length;
        setPendingCount(totalPending);

        if (totalPending === 0) {
          toast.info('반영할 항목이 없습니다');
        } else {
          toast.success(`미반영 ${totalPending}건을 불러왔습니다`);
        }
      } else {
        toast.error(result.error || '데이터 조회 실패');
      }
    } catch (error) {
      console.error('데이터 조회 오류:', error);
      toast.error('데이터 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [buildUnifiedLists]);

  // 수입 레코드 수정
  const handleUnifiedIncomeChange = (index: number, field: keyof IncomeRecord, value: string | number) => {
    setUnifiedIncome(prev => {
      const newItems = [...prev];
      const item = newItems[index];
      if (item.type === 'matched' && item.record) {
        newItems[index] = {
          ...item,
          record: { ...item.record, [field]: value },
        };
      }
      return newItems;
    });
  };

  // 지출 레코드 수정
  const handleUnifiedExpenseChange = (index: number, field: keyof ExpenseRecord, value: string | number) => {
    setUnifiedExpense(prev => {
      const newItems = [...prev];
      const item = newItems[index];

      if (item.type === 'matched' && item.record) {
        newItems[index] = {
          ...item,
          record: { ...item.record, [field]: value },
        };
      } else if (item.type === 'needsReview') {
        const now = new Date().toISOString();
        const newRecord: ExpenseRecord = {
          id: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: item.transaction.date,
          payment_method: '계좌이체',
          vendor: item.transaction.memo || item.transaction.detail || '기타',
          description: item.transaction.description || '',
          amount: item.transaction.withdrawal,
          account_code: item.suggestions?.[0]?.target_code || 0,
          category_code: Math.floor((item.suggestions?.[0]?.target_code || 0) / 10) * 10,
          note: item.transaction.detail || '',
          created_at: now,
          created_by: 'manual_edit',
          transaction_date: item.transaction.transaction_date,
          [field]: value,
        };
        newItems[index] = {
          ...item,
          type: 'matched',
          record: newRecord,
          match: item.suggestions?.[0] || null,
        };
      }
      return newItems;
    });
  };

  // 수입 항목 삭제
  const handleRemoveUnifiedIncome = (index: number) => {
    setUnifiedIncome(prev => prev.filter((_, i) => i !== index));
  };

  // 지출 항목 삭제
  const handleRemoveUnifiedExpense = (index: number) => {
    setUnifiedExpense(prev => prev.filter((_, i) => i !== index));
  };

  // 수입부 반영
  const handleConfirmIncome = async () => {
    if (confirmingIncome) return;

    const incomeToSave = unifiedIncome
      .filter(item => item.type === 'matched' && item.record)
      .map(item => ({ transaction: item.transaction, record: item.record!, match: item.match }));

    const suppressedIncomeToSave = unifiedIncome
      .filter(item => item.type === 'suppressed')
      .map(item => item.transaction);

    if (incomeToSave.length === 0 && suppressedIncomeToSave.length === 0) {
      toast.error('반영할 수입 데이터가 없습니다');
      return;
    }

    setConfirmingIncome(true);

    try {
      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: incomeToSave,
          expense: [],
          suppressed: suppressedIncomeToSave,
        }),
      });

      const result = await res.json();

      if (result.incomeSuccess) {
        const totalAmount = incomeToSave.reduce((sum, item) => sum + (item.record?.amount || 0), 0);
        setReflectionResult({
          type: 'income',
          count: result.incomeCount,
          suppressedCount: result.suppressedCount || 0,
          amount: totalAmount,
        });
        setUnifiedIncome([]);
      }
      if (!result.incomeSuccess) {
        toast.error(result.error || '수입 반영 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('수입 반영 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setConfirmingIncome(false);
    }
  };

  // 지출부 반영
  const handleConfirmExpense = async () => {
    if (confirmingExpense) return;

    const expenseToSave = unifiedExpense
      .filter(item => item.type === 'matched' || item.type === 'needsReview')
      .map(item => {
        if (item.type === 'matched' && item.record) {
          return { transaction: item.transaction, record: item.record, match: item.match };
        }
        const now = new Date().toISOString();
        const newRecord: ExpenseRecord = {
          id: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: item.transaction.date,
          payment_method: '계좌이체',
          vendor: item.transaction.memo || item.transaction.detail || '기타',
          description: item.transaction.description || '',
          amount: item.transaction.withdrawal,
          account_code: item.suggestions?.[0]?.target_code || 0,
          category_code: Math.floor((item.suggestions?.[0]?.target_code || 0) / 10) * 10,
          note: item.transaction.detail || '',
          created_at: now,
          created_by: 'auto_review',
          transaction_date: item.transaction.transaction_date,
        };
        return { transaction: item.transaction, record: newRecord, match: item.suggestions?.[0] || null };
      });

    const suppressedExpenseToSave = unifiedExpense
      .filter(item => item.type === 'suppressed')
      .map(item => item.transaction);

    if (expenseToSave.length === 0 && suppressedExpenseToSave.length === 0) {
      toast.error('반영할 지출 데이터가 없습니다');
      return;
    }

    setConfirmingExpense(true);

    try {
      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: [],
          expense: expenseToSave,
          suppressed: suppressedExpenseToSave,
        }),
      });

      const result = await res.json();

      if (result.expenseSuccess) {
        const totalAmount = expenseToSave.reduce((sum, item) => sum + (item.record?.amount || 0), 0);
        setReflectionResult({
          type: 'expense',
          count: result.expenseCount,
          suppressedCount: result.suppressedCount || 0,
          amount: totalAmount,
        });
        setUnifiedExpense([]);
      }
      if (!result.expenseSuccess) {
        toast.error(result.error || '지출 반영 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('지출 반영 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setConfirmingExpense(false);
    }
  };

  // 각종 카운트 계산
  const matchedIncomeCount = unifiedIncome.filter(item => item.type === 'matched').length;
  const suppressedIncomeCount = unifiedIncome.filter(item => item.type === 'suppressed').length;
  const matchedExpenseCount = unifiedExpense.filter(item => item.type === 'matched').length;
  const needsReviewCount = unifiedExpense.filter(item => item.type === 'needsReview').length;
  const suppressedExpenseCount = unifiedExpense.filter(item => item.type === 'suppressed').length;

  // 금액 합계 계산 (matched + needsReview 모두 포함)
  const incomeTotalAmount = unifiedIncome
    .filter(item => item.type === 'matched' && item.record)
    .reduce((sum, item) => sum + (item.record?.amount || 0), 0);
  const expenseTotalAmount = unifiedExpense
    .filter(item => item.type === 'matched' || item.type === 'needsReview')
    .reduce((sum, item) => {
      // matched: record.amount, needsReview: transaction.withdrawal
      if (item.type === 'matched' && item.record) {
        return sum + item.record.amount;
      }
      return sum + item.transaction.withdrawal;
    }, 0);

  return (
    <Card className="h-[calc(100vh-180px)] flex flex-col">
      <CardHeader className="shrink-0 pb-4">
        <CardTitle>재정부 반영</CardTitle>
        <CardDescription>
          은행원장의 미반영 항목을 수입부/지출부에 반영합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
        {/* 데이터 불러오기 버튼 */}
        <Button
          onClick={loadPendingTransactions}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              미반영 항목 불러오기
            </>
          )}
        </Button>

        {/* 결과 없음 표시 */}
        {pendingCount === 0 && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-green-700 font-medium">반영할 항목이 없습니다</div>
            <div className="text-green-600 text-sm mt-1">
              모든 은행거래가 수입부/지출부에 반영되었습니다
            </div>
          </div>
        )}

        {/* 매칭 결과 - 탭 UI */}
        {matchResult && (matchedIncomeCount > 0 || matchedExpenseCount > 0 || needsReviewCount > 0 ||
          suppressedIncomeCount > 0 || suppressedExpenseCount > 0) && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 고정 상단: 합계 정보 + 탭 버튼 */}
            <div className="shrink-0 space-y-3 mb-3">
              {/* 합계 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-700 mb-2">반영 대상 합계</div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">수입:</span>
                    <span className="text-green-600 font-bold">+{incomeTotalAmount.toLocaleString()}원</span>
                    <span className="text-slate-500 text-sm">({matchedIncomeCount}건)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">지출:</span>
                    <span className="text-red-600 font-bold">-{expenseTotalAmount.toLocaleString()}원</span>
                    <span className="text-slate-500 text-sm">({matchedExpenseCount + needsReviewCount}건)</span>
                  </div>
                </div>
              </div>

              {/* 탭 버튼 */}
              <div className="flex gap-2 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('income')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'income'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  수입부 ({matchedIncomeCount}건{suppressedIncomeCount > 0 ? ` + 말소 ${suppressedIncomeCount}` : ''})
                </button>
                <button
                  onClick={() => setActiveTab('expense')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'expense'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  지출부 ({matchedExpenseCount + needsReviewCount}건{suppressedExpenseCount > 0 ? ` + 말소 ${suppressedExpenseCount}` : ''})
                </button>
              </div>
            </div>

            {/* 스크롤 영역: 테이블 */}
            <div className="flex-1 min-h-0">
              {/* 수입부 탭 */}
              {activeTab === 'income' && (
                <div className="rounded-md border h-full overflow-auto relative">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">No</TableHead>
                        <TableHead className="w-[50px]">상태</TableHead>
                        <TableHead className="w-[90px]">기준일</TableHead>
                        <TableHead className="w-[80px]">이체일</TableHead>
                        <TableHead className="w-[70px]">입금경로</TableHead>
                        <TableHead className="w-[60px]">코드</TableHead>
                        <TableHead className="w-[80px]">헌금자</TableHead>
                        <TableHead className="w-[80px]">대표자</TableHead>
                        <TableHead className="w-[90px] text-right">금액</TableHead>
                        <TableHead className="w-[280px]">비고</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unifiedIncome.map((item, index) => (
                        <TableRow
                          key={`income-${index}`}
                          className={cn(
                            item.type === 'suppressed' && 'bg-red-50'
                          )}
                        >
                          <TableCell className="text-sm">{index + 1}</TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm font-medium">말소</span>
                            ) : (
                              <span className="text-slate-300 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className={cn('text-sm', item.type === 'suppressed' ? 'text-red-600' : 'text-blue-600')}>
                            {item.type === 'suppressed' ? item.transaction.date : item.record?.date}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {item.type === 'suppressed' ? item.transaction.transaction_date : item.record?.transaction_date}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.type === 'suppressed' ? (
                              <span className="text-red-500">-</span>
                            ) : (
                              <Input
                                value={item.record?.source || '계좌이체'}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'source', e.target.value)}
                                className="h-6 text-sm w-20"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.type === 'suppressed' ? (
                              <span className="text-red-500">-</span>
                            ) : (
                              <Input
                                type="number"
                                value={item.record?.offering_code || 0}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'offering_code', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm w-16 text-center"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-600">{item.transaction.memo || item.transaction.detail || '-'}</span>
                            ) : (
                              <Input
                                value={item.record?.donor_name || ''}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'donor_name', e.target.value)}
                                className="h-6 text-sm w-20"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-500">-</span>
                            ) : (
                              <Input
                                value={item.record?.representative || ''}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'representative', e.target.value)}
                                className="h-6 text-sm w-28"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-1">
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-600 font-medium">+{item.transaction.deposit.toLocaleString()}</span>
                            ) : (
                              <Input
                                type="number"
                                value={item.record?.amount || 0}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'amount', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm text-right w-24 text-green-600"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-500">{item.transaction.suppressed_reason}</span>
                            ) : (
                              <Input
                                value={item.record?.note || ''}
                                onChange={(e) => handleUnifiedIncomeChange(index, 'note', e.target.value)}
                                className="h-6 text-sm w-64"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type !== 'suppressed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveUnifiedIncome(index)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {unifiedIncome.length === 0 && (
                    <div className="p-4 text-center text-slate-500 text-sm">수입 항목이 없습니다</div>
                  )}
                </div>
              )}

              {/* 지출부 탭 */}
              {activeTab === 'expense' && (
                <div className="rounded-md border h-full overflow-auto relative">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">No</TableHead>
                        <TableHead className="w-[50px]">상태</TableHead>
                        <TableHead className="w-[90px]">기준일</TableHead>
                        <TableHead className="w-[80px]">이체일</TableHead>
                        <TableHead className="w-[70px]">결제방법</TableHead>
                        <TableHead className="w-[100px]">거래처</TableHead>
                        <TableHead className="w-[120px]">적요</TableHead>
                        <TableHead className="w-[90px] text-right">금액</TableHead>
                        <TableHead className="w-[60px]">계정</TableHead>
                        <TableHead className="w-[200px]">비고</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unifiedExpense.map((item, index) => (
                        <TableRow
                          key={`expense-${index}`}
                          className={cn(
                            item.type === 'suppressed' && 'bg-red-50',
                            item.type === 'needsReview' && 'bg-amber-50'
                          )}
                        >
                          <TableCell className="text-sm">{index + 1}</TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm font-medium">말소</span>
                            ) : item.type === 'needsReview' ? (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-sm font-medium">검토</span>
                            ) : (
                              <span className="text-slate-300 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className={cn(
                            'text-sm',
                            item.type === 'suppressed' ? 'text-red-600' :
                            item.type === 'needsReview' ? 'text-amber-600' : 'text-blue-600'
                          )}>
                            {item.type === 'matched' ? item.record?.date : item.transaction.date}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {item.type === 'matched' ? item.record?.transaction_date : item.transaction.transaction_date}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.type === 'suppressed' ? (
                              <span className="text-red-500">-</span>
                            ) : item.type === 'needsReview' ? (
                              <span className="text-amber-600">계좌이체</span>
                            ) : (
                              <Input
                                value={item.record?.payment_method || '계좌이체'}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'payment_method', e.target.value)}
                                className="h-6 text-sm w-20"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-600">{item.transaction.memo || item.transaction.detail || '-'}</span>
                            ) : item.type === 'needsReview' ? (
                              <Input
                                value={item.record?.vendor || item.transaction.memo || item.transaction.detail || ''}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'vendor', e.target.value)}
                                className="h-6 text-sm w-24 bg-amber-50"
                              />
                            ) : (
                              <Input
                                value={item.record?.vendor || ''}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'vendor', e.target.value)}
                                className="h-6 text-sm w-24"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-500">{item.transaction.suppressed_reason}</span>
                            ) : item.type === 'needsReview' ? (
                              <Input
                                value={item.record?.description || item.transaction.description || ''}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'description', e.target.value)}
                                className="h-6 text-sm w-28 bg-amber-50"
                              />
                            ) : (
                              <Input
                                value={item.record?.description || ''}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'description', e.target.value)}
                                className="h-6 text-sm w-28"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-600 font-medium">{item.transaction.withdrawal.toLocaleString()}</span>
                            ) : item.type === 'needsReview' ? (
                              <Input
                                type="number"
                                value={item.record?.amount || item.transaction.withdrawal}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm text-right w-24 text-amber-700 bg-amber-50"
                              />
                            ) : (
                              <Input
                                type="number"
                                value={item.record?.amount || 0}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm text-right w-24 text-red-600"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.type === 'suppressed' ? (
                              <span className="text-red-500">-</span>
                            ) : item.type === 'needsReview' ? (
                              <Input
                                type="number"
                                value={item.record?.account_code || item.suggestions?.[0]?.target_code || 0}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'account_code', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm w-16 text-center bg-amber-50"
                              />
                            ) : (
                              <Input
                                type="number"
                                value={item.record?.account_code || 0}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'account_code', parseInt(e.target.value) || 0)}
                                className="h-6 text-sm w-16 text-center"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'suppressed' ? (
                              <span className="text-sm text-red-500">{item.transaction.description}</span>
                            ) : item.type === 'needsReview' ? (
                              <span className="text-sm text-amber-600">{item.transaction.detail || '-'}</span>
                            ) : (
                              <Input
                                value={item.record?.note || ''}
                                onChange={(e) => handleUnifiedExpenseChange(index, 'note', e.target.value)}
                                className="h-6 text-sm w-48"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.type === 'matched' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveUnifiedExpense(index)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {unifiedExpense.length === 0 && (
                    <div className="p-4 text-center text-slate-500 text-sm">지출 항목이 없습니다</div>
                  )}
                </div>
              )}
            </div>

            {/* 반영 버튼 - 하단 고정 */}
            <div className="shrink-0 pt-3 flex gap-2">
              {activeTab === 'income' && (
                <Button
                  onClick={handleConfirmIncome}
                  disabled={confirmingIncome || matchedIncomeCount === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {confirmingIncome ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  수입부 반영 ({matchedIncomeCount}건{suppressedIncomeCount > 0 ? `, 말소 ${suppressedIncomeCount}` : ''})
                </Button>
              )}
              {activeTab === 'expense' && (
                <Button
                  onClick={handleConfirmExpense}
                  disabled={confirmingExpense || (matchedExpenseCount + needsReviewCount) === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {confirmingExpense ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  지출부 반영 ({matchedExpenseCount + needsReviewCount}건{suppressedExpenseCount > 0 ? `, 말소 ${suppressedExpenseCount}` : ''})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 초기 상태 */}
        {pendingCount === null && !loading && (
          <div className="text-center py-8 text-slate-500">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>&apos;미반영 항목 불러오기&apos; 버튼을 클릭하여<br />수입부/지출부에 반영할 항목을 확인하세요</p>
          </div>
        )}
      </CardContent>

      {/* 반영 완료 팝업 */}
      <AlertDialog open={!!reflectionResult} onOpenChange={() => setReflectionResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              {reflectionResult?.type === 'income' ? '수입부' : '지출부'} 반영 완료
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">반영 건수</span>
                    <span className="font-bold text-lg text-slate-900">{reflectionResult?.count}건</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">반영 금액</span>
                    <span className={`font-bold text-lg ${reflectionResult?.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {reflectionResult?.type === 'income' ? '+' : '-'}{reflectionResult?.amount.toLocaleString()}원
                    </span>
                  </div>
                  {(reflectionResult?.suppressedCount || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">말소 처리</span>
                      <span className="font-medium text-slate-700">{reflectionResult?.suppressedCount}건</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  Google Sheets {reflectionResult?.type === 'income' ? '수입부' : '지출부'}에 성공적으로 반영되었습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setReflectionResult(null)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
