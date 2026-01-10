'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries';
import { DashboardHeader, StatsCard, WeeklyChart, TransactionDetails, BudgetExecutionCard } from '@/components/dashboard';
import { endOfWeek, addWeeks, format } from 'date-fns';

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
  }>;
  // 동기집행률 관련
  yearlyIncome?: number;
  yearlyExpense?: number;
  carryoverBalance?: number;
  totalBudget?: number;
  syncBudget?: number;
  syncExecutionRate?: number;
  yearlyExecutionRate?: number;
  daysPassed?: number;
  daysInYear?: number;
  currentYear?: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const weekOffset = parseInt(searchParams.get('week') || '0');

  // 현재 주의 일요일 계산 (월~일 기준, API와 일치)
  const today = new Date();
  const currentSunday = endOfWeek(today, { weekStartsOn: 1 });
  const targetSunday = addWeeks(currentSunday, weekOffset);

  const [selectedCard, setSelectedCard] = useState<'income' | 'expense' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch().finally(() => {
      setTimeout(() => setIsRefreshing(false), 500);
    });
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
      <WeeklyChart data={weeklyData} />

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

      {/* Quick Actions */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-4 md:p-6">
          <h3 className="font-display text-[16px] md:text-[18px] font-semibold text-[#2C3E50] mb-4">
            빠른 작업
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Link href="/data-entry">
              <Button
                variant="outline"
                className="w-full h-16 md:h-20 flex flex-col gap-1.5 md:gap-2 border-[#E8E4DE] hover:border-[#C9A962] hover:bg-[#F8F6F3]"
              >
                <span className="text-lg md:text-xl">📥</span>
                <span className="text-[13px] md:text-[14px] text-[#2C3E50]">데이터 입력</span>
              </Button>
            </Link>
            <Link href="/match">
              <Button
                variant="outline"
                className="w-full h-16 md:h-20 flex flex-col gap-1.5 md:gap-2 border-[#E8E4DE] hover:border-[#C9A962] hover:bg-[#F8F6F3]"
              >
                <span className="text-lg md:text-xl">🔗</span>
                <span className="text-[13px] md:text-[14px] text-[#2C3E50]">거래 매칭</span>
              </Button>
            </Link>
            <Link href="/reports/weekly">
              <Button
                variant="outline"
                className="w-full h-16 md:h-20 flex flex-col gap-1.5 md:gap-2 border-[#E8E4DE] hover:border-[#C9A962] hover:bg-[#F8F6F3]"
              >
                <span className="text-lg md:text-xl">📊</span>
                <span className="text-[13px] md:text-[14px] text-[#2C3E50]">주간 보고서</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-0 shadow-soft bg-[#F5EFE0]">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="text-xl md:text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-[#2C3E50] text-[14px] md:text-[15px]">시작하기</h3>
              <p className="text-[#6B7B8C] text-[12px] md:text-[13px] mt-1 leading-relaxed">
                1. <strong className="text-[#2C3E50]">데이터 입력</strong>에서 현금헌금을 동기화하거나 은행/카드 파일을 업로드하세요.<br />
                2. <strong className="text-[#2C3E50]">거래 매칭</strong>에서 미분류된 거래를 수입/지출로 분류하세요.<br />
                3. <strong className="text-[#2C3E50]">보고서</strong>에서 주간/월간 재정 현황을 확인하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
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
