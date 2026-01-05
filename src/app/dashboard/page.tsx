'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries';

interface DashboardStats {
  weeklyIncome: number;
  weeklyExpense: number;
  balance: number;
  unmatchedCount: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: queryKeys.unmatchedTransactions,
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) return { weeklyIncome: 0, weeklyExpense: 0, balance: 0, unmatchedCount: 0 };
      return res.json();
    },
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">재정 대시보드</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              이번 주 수입
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? '...' : formatAmount(stats?.weeklyIncome || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              이번 주 지출
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {isLoading ? '...' : formatAmount(stats?.weeklyExpense || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              현재 잔액
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? '...' : formatAmount(stats?.balance || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              미분류 거래
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {isLoading ? '...' : `${stats?.unmatchedCount || 0}건`}
            </div>
            {(stats?.unmatchedCount || 0) > 0 && (
              <Link href="/match" className="text-sm text-blue-600 hover:underline">
                지금 처리하기 →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 작업 */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 작업</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/data-entry">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">📥</span>
                <span>데이터 입력</span>
              </Button>
            </Link>
            <Link href="/match">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">🔗</span>
                <span>거래 매칭</span>
              </Button>
            </Link>
            <Link href="/reports/weekly">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <span className="text-lg">📊</span>
                <span>주간 보고서</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 안내 메시지 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-900">시작하기</h3>
              <p className="text-blue-800 text-sm mt-1">
                1. <strong>데이터 입력</strong>에서 현금헌금을 동기화하거나 은행/카드 파일을 업로드하세요.<br />
                2. <strong>거래 매칭</strong>에서 미분류된 거래를 수입/지출로 분류하세요.<br />
                3. <strong>보고서</strong>에서 주간/월간 재정 현황을 확인하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
