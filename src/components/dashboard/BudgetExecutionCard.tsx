'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart } from 'lucide-react';

interface BudgetExecutionCardProps {
  totalBudget: number;
  syncBudget: number;
  yearlyExpense: number;
  syncExecutionRate: number;
  yearlyExecutionRate: number;
  daysPassed: number;
  daysInYear: number;
  currentYear: number;
  isLoading?: boolean;
}

export function BudgetExecutionCard({
  totalBudget,
  syncBudget,
  yearlyExpense,
  syncExecutionRate,
  yearlyExecutionRate,
  daysPassed,
  daysInYear,
  currentYear,
  isLoading = false,
}: BudgetExecutionCardProps) {
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 1000000) {
      return `${Math.round(amount / 1000000)}백만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // 동기집행률 상태 (정상: 90-110%, 주의: 80-90% or 110-120%, 경고: 그 외)
  const getStatusColor = (rate: number) => {
    if (rate >= 90 && rate <= 110) return 'text-green-600';
    if ((rate >= 80 && rate < 90) || (rate > 110 && rate <= 120)) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90 && rate <= 110) return '[&>div]:bg-green-500';
    if ((rate >= 80 && rate < 90) || (rate > 110 && rate <= 120)) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-red-500';
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[16px] font-semibold text-[#2C3E50]">
            <PieChart className="h-5 w-5 text-[#C9A962]" />
            일반예산 집행 현황(건축 제외)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 예산이 없으면 안내 메시지 표시
  if (totalBudget === 0) {
    return (
      <Card className="border-0 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[16px] font-semibold text-[#2C3E50]">
            <PieChart className="h-5 w-5 text-[#C9A962]" />
            일반예산 집행 현황(건축 제외)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            {currentYear}년 예산이 등록되지 않았습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = Math.min(yearlyExecutionRate, 100);

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[16px] font-semibold text-[#2C3E50]">
          <PieChart className="h-5 w-5 text-[#C9A962]" />
          일반예산 집행 현황(건축 제외)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 동기집행률 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">동기집행률</span>
            <span className={`font-bold text-lg ${getStatusColor(syncExecutionRate)}`}>
              {syncExecutionRate}%
            </span>
          </div>
          <Progress
            value={Math.min(syncExecutionRate, 150)}
            max={150}
            className={`h-2 ${getProgressColor(syncExecutionRate)}`}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>동기예산: {formatAmount(syncBudget)}</span>
            <span>집행: {formatAmount(yearlyExpense)}</span>
          </div>
        </div>

        {/* 연간집행률 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">연간집행률</span>
            <span className="font-medium">{yearlyExecutionRate}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-slate-500">
            <span>연간예산: {formatAmount(totalBudget)}</span>
            <span>잔액: {formatAmount(totalBudget - yearlyExpense)}</span>
          </div>
        </div>

        {/* 경과일수 */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex justify-between text-xs text-slate-400">
            <span>연간 경과</span>
            <span>{daysPassed}일 / {daysInYear}일 ({Math.round(daysPassed / daysInYear * 100)}%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
