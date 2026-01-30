'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries';
import { DashboardHeader, StatsCard, WeeklyChart, TransactionDetails, BudgetExecutionCard, WeeklyBriefingCard } from '@/components/dashboard';
import { addWeeks, format, subDays } from 'date-fns';

interface CategoryDetail {
  code: number;
  item: string;
  amount: number;
}

interface CategorySummaryWithDetails {
  categoryCode: number;
  category: string;
  amount: number;
  details: CategoryDetail[];
}

interface DashboardStats {
  weeklyIncome: number;
  weeklyExpense: number;
  balance: number;
  incomeSummary?: CategorySummaryWithDetails[];
  expenseSummary?: CategorySummaryWithDetails[];
  weeklyData?: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  // 동기집행률 관련
  yearlyIncome?: number;
  yearlyExpense?: number;
  // 연간 전체 합계 (필터 없음)
  yearlyTotalIncome?: number;
  yearlyTotalExpense?: number;
  carryoverBalance?: number;
  totalBudget?: number;
  syncBudget?: number;
  syncExecutionRate?: number;
  yearlyExecutionRate?: number;
  daysPassed?: number;
  daysInYear?: number;
  currentYear?: number;
  // 초과집행 항목 Top 3
  topOverBudgetItems?: Array<{
    accountCode: number;
    accountName: string;
    budgeted: number;
    syncBudgeted: number;
    executed: number;
    executionRate: number;
  }>;
  // super_admin 검증용 은행잔액
  lastBankBalance?: number;
  lastBankDate?: string | null;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const weekOffset = parseInt(searchParams.get('week') || '0');
  const session = useFinanceSession();
  const isSuperAdmin = session?.finance_role === 'super_admin';

  // 지나간 가장 최근 일요일 계산 (오늘이 일요일이면 오늘)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = 일요일
  const lastSunday = dayOfWeek === 0 ? today : subDays(today, dayOfWeek);
  const targetSunday = addWeeks(lastSunday, weekOffset);

  const [selectedCard, setSelectedCard] = useState<'income' | 'expense' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading, isFetching, refetch } = useQuery<DashboardStats>({
    queryKey: [...queryKeys.unmatchedTransactions, weekOffset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (weekOffset !== 0) {
        params.set('week', String(weekOffset));
      }
      const res = await fetch(`/api/dashboard/stats?${params}`);
      if (!res.ok) return {
        weeklyIncome: 0,
        weeklyExpense: 0,
        balance: 0,
        incomeSummary: [],
        expenseSummary: [],
        weeklyData: []
      };
      return res.json();
    },
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 캐시 무효화 후 데이터 새로고침
      await fetch('/api/cache/invalidate', { method: 'POST' });
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCardClick = (type: 'income' | 'expense') => {
    setSelectedCard(selectedCard === type ? null : type);
  };

  // 8주 데이터 생성 (실제 API에서 가져오거나 더미 데이터)
  const weeklyData = stats?.weeklyData || Array.from({ length: 8 }, (_, i) => {
    const date = addWeeks(targetSunday, i - 7);
    return {
      date: format(date, 'M/d'),
      income: 0,
      expense: 0,
      balance: 0,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <DashboardHeader
        currentDate={targetSunday}
        weekOffset={weekOffset}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isFetching={isFetching}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatsCard
          icon={TrendingUp}
          label="이번 주 수입"
          value={isLoading ? '...' : formatAmount(stats?.weeklyIncome || 0)}
          color="income"
          isSelected={selectedCard === 'income'}
          onClick={() => handleCardClick('income')}
        />
        <StatsCard
          icon={TrendingDown}
          label="이번 주 지출"
          value={isLoading ? '...' : formatAmount(stats?.weeklyExpense || 0)}
          color="expense"
          isSelected={selectedCard === 'expense'}
          onClick={() => handleCardClick('expense')}
        />
        <StatsCard
          icon={Wallet}
          label="현재 잔액"
          value={isLoading ? '...' : formatAmount(stats?.balance || 0)}
          color="balance"
        />
      </div>

      {/* Super Admin 잔액 검증 카드 */}
      {isSuperAdmin && !isLoading && stats && (
        <Card className={`border-0 shadow-soft ${
          stats.balance === stats.lastBankBalance
            ? 'bg-green-50'
            : 'bg-amber-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {stats.balance === stats.lastBankBalance ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-sm">잔액 검증 (관리자용)</h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">계산 잔액 (이월+수입-지출):</span>
                    <span className="font-medium text-blue-600">{formatAmount(stats.balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      은행원장 잔액{stats.lastBankDate ? ` (${stats.lastBankDate})` : ''}:
                    </span>
                    <span className="font-medium">{formatAmount(stats.lastBankBalance || 0)}</span>
                  </div>
                  {stats.balance !== stats.lastBankBalance && (
                    <div className="flex justify-between pt-1 border-t border-amber-200">
                      <span className="text-amber-700 font-medium">차액:</span>
                      <span className="font-bold text-amber-700">
                        {formatAmount(Math.abs(stats.balance - (stats.lastBankBalance || 0)))}
                      </span>
                    </div>
                  )}
                </div>
                {stats.balance !== stats.lastBankBalance && (
                  <p className="text-xs text-amber-700 mt-2">
                    계산 잔액과 은행 잔액이 일치하지 않습니다. 거래 내역을 확인해주세요.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Details (shows when card is clicked) */}
      {selectedCard && (
        <TransactionDetails
          type={selectedCard}
          summary={
            selectedCard === 'income'
              ? stats?.incomeSummary || []
              : stats?.expenseSummary || []
          }
          total={
            selectedCard === 'income'
              ? stats?.weeklyIncome || 0
              : stats?.weeklyExpense || 0
          }
        />
      )}

      {/* 8-Week Chart */}
      <WeeklyChart
        data={weeklyData}
        yearlyIncome={stats?.yearlyTotalIncome}
        yearlyExpense={stats?.yearlyTotalExpense}
      />

      {/* Budget Execution Rate Card */}
      <BudgetExecutionCard
        totalBudget={stats?.totalBudget || 0}
        syncBudget={stats?.syncBudget || 0}
        yearlyExpense={stats?.yearlyExpense || 0}
        syncExecutionRate={stats?.syncExecutionRate || 0}
        yearlyExecutionRate={stats?.yearlyExecutionRate || 0}
        daysPassed={stats?.daysPassed || 0}
        daysInYear={stats?.daysInYear || 365}
        currentYear={stats?.currentYear || new Date().getFullYear()}
        isLoading={isLoading}
      />

      {/* Weekly Briefing Card */}
      <WeeklyBriefingCard
        weeklyIncome={stats?.weeklyIncome || 0}
        weeklyExpense={stats?.weeklyExpense || 0}
        balance={stats?.balance || 0}
        syncExecutionRate={stats?.syncExecutionRate || 0}
        topOverBudgetItems={stats?.topOverBudgetItems || []}
        isLoading={isLoading}
      />
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-[#C9A962]" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
