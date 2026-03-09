'use client';

import { useState, useEffect } from 'react';
import { BookOpen, ArrowDownCircle, ArrowUpCircle, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { IncomeCode, ExpenseCode } from '@/types';

export function FinanceCodeFab() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [incomeCodes, setIncomeCodes] = useState<IncomeCode[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      fetchCodes();
    }
  }, [open, loaded]);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        fetch('/api/codes/income'),
        fetch('/api/codes/expense'),
      ]);

      const incomeData = await incomeRes.json();
      const expenseData = await expenseRes.json();

      if (incomeData.success) setIncomeCodes(incomeData.data);
      if (expenseData.success) setExpenseCodes(expenseData.data);
      setLoaded(true);
    } catch {
      toast.error('코드를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 카테고리별 그룹화
  const groupByCategory = <T extends { category_code: number; category_item: string }>(
    codes: T[]
  ) => {
    return codes.reduce((acc, code) => {
      const key = `${code.category_code}_${code.category_item}`;
      if (!acc[key]) {
        acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
      }
      acc[key].codes.push(code);
      return acc;
    }, {} as Record<string, { category_code: number; category_item: string; codes: T[] }>);
  };

  const groupedIncome = groupByCategory(incomeCodes);
  const groupedExpense = groupByCategory(expenseCodes);

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        style={{
          background: 'linear-gradient(135deg, #2C3E50 0%, #1a2a3a 100%)',
        }}
        title="재정코드 보기"
      >
        <BookOpen className="h-6 w-6 text-[#C9A962]" />
      </button>

      {/* 코드 모달 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <BookOpen className="h-5 w-5 text-[#C9A962]" />
              재정코드
            </DialogTitle>
          </DialogHeader>

          {/* 탭 */}
          <div className="flex gap-1 px-6 pt-2">
            <button
              onClick={() => setActiveTab('income')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'income'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <ArrowDownCircle className="h-4 w-4" />
              수입부 코드
            </button>
            <button
              onClick={() => setActiveTab('expense')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'expense'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <ArrowUpCircle className="h-4 w-4" />
              지출부 코드
            </button>
          </div>

          {/* 코드 목록 */}
          <div className="overflow-y-auto px-6 pb-6 pt-2" style={{ maxHeight: 'calc(85vh - 160px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : activeTab === 'income' ? (
              <div className="space-y-3">
                {Object.values(groupedIncome).map((group) => (
                  <div key={group.category_code} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100">
                      <span className="text-sm font-bold text-emerald-800">
                        {group.category_item}
                      </span>
                      <span className="ml-2 text-xs text-emerald-600">({group.category_code})</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.codes.map((code) => (
                        <div
                          key={code.code}
                          className={`flex items-center gap-3 px-4 py-2 ${
                            !code.active ? 'opacity-40' : ''
                          }`}
                        >
                          <span className="w-12 text-right font-mono text-sm font-semibold text-slate-600">
                            {code.code}
                          </span>
                          <span className="flex-1 text-sm text-slate-800">{code.item}</span>
                          {!code.active && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              비활성
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(groupedIncome).length === 0 && (
                  <p className="py-12 text-center text-sm text-slate-400">수입부 코드가 없습니다.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(groupedExpense).map((group) => (
                  <div key={group.category_code} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-100">
                      <span className="text-sm font-bold text-rose-800">
                        {group.category_item}
                      </span>
                      <span className="ml-2 text-xs text-rose-600">({group.category_code})</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.codes.map((code) => (
                        <div
                          key={code.code}
                          className={`flex items-center gap-3 px-4 py-2 ${
                            !code.active ? 'opacity-40' : ''
                          }`}
                        >
                          <span className="w-12 text-right font-mono text-sm font-semibold text-slate-600">
                            {code.code}
                          </span>
                          <span className="flex-1 text-sm text-slate-800">{code.item}</span>
                          {!code.active && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              비활성
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(groupedExpense).length === 0 && (
                  <p className="py-12 text-center text-sm text-slate-400">지출부 코드가 없습니다.</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
