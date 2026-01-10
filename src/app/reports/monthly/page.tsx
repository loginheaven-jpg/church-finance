'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, BarChart3, TableIcon, RefreshCw, TrendingUp, TrendingDown, Wallet, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { useYear } from '@/contexts/YearContext';

interface MonthData {
  month: number;
  income: number;
  expense: number;
  balance: number;
}

interface ExtendedMonthlyReport {
  year: number;
  months: MonthData[];
  carryoverBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  isCurrentYear?: boolean;
}

export default function MonthlyReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ExtendedMonthlyReport | null>(null);
  const { year, setYear } = useYear();
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const fetchReport = async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/monthly?year=${y}`);
      const data = await res.json();

      if (data.success) {
        setReport(data.data);
      } else {
        toast.error(data.error || '보고서 조회 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('보고서를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(year);
  }, [year]);

  const totalIncome = report?.totalIncome || report?.months.reduce((sum, m) => sum + m.income, 0) || 0;
  const totalExpense = report?.totalExpense || report?.months.reduce((sum, m) => sum + m.expense, 0) || 0;
  const totalBalance = totalIncome - totalExpense;
  const carryoverBalance = report?.carryoverBalance || 0;
  const currentBalance = report?.currentBalance || 0;

  const formatAmount = (amount: number) => {
    if (Math.abs(amount) >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`;
    } else if (Math.abs(amount) >= 1000000) {
      return `${Math.round(amount / 1000000)}백만`;
    } else if (Math.abs(amount) >= 10000) {
      return `${Math.round(amount / 10000).toLocaleString()}만`;
    }
    return amount.toLocaleString();
  };

  // 전체 숫자 포맷 (툴팁용)
  const formatFullAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const chartData = report?.months.map(m => ({
    name: `${m.month}월`,
    수입: m.income,
    지출: m.expense,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">연간 보고서</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium w-20 text-center">{year}년</span>
          <Button variant="outline" size="icon" onClick={() => setYear(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          {/* 5개 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* 이월금 */}
            <Card className="border-l-4 border-l-slate-400">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  이월금
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <div className="text-lg font-bold text-slate-700" title={formatFullAmount(carryoverBalance)}>
                  {formatAmount(carryoverBalance)}원
                </div>
              </CardContent>
            </Card>

            {/* 연간 총 수입 */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  연간 수입
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <div className="text-lg font-bold text-green-600" title={formatFullAmount(totalIncome)}>
                  {formatAmount(totalIncome)}원
                </div>
              </CardContent>
            </Card>

            {/* 연간 총 지출 */}
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  연간 지출
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <div className="text-lg font-bold text-red-600" title={formatFullAmount(totalExpense)}>
                  {formatAmount(totalExpense)}원
                </div>
              </CardContent>
            </Card>

            {/* 수지차액 */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  수지차액
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <div className={`text-lg font-bold ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`} title={formatFullAmount(totalBalance)}>
                  {totalBalance >= 0 ? '+' : ''}{formatAmount(totalBalance)}원
                </div>
              </CardContent>
            </Card>

            {/* 현재잔고 / 연말잔고 */}
            <Card className="border-l-4 border-l-amber-500 col-span-2 md:col-span-1">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {report.isCurrentYear ? '현재잔고' : '연말잔고'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <div className="text-lg font-bold text-amber-600" title={formatFullAmount(currentBalance)}>
                  {formatAmount(currentBalance)}원
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 월별 상세 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                월별 현황
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === 'chart' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('chart')}
                  className="h-8"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  차트
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8"
                >
                  <TableIcon className="h-4 w-4 mr-1" />
                  테이블
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'chart' ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(value) => formatAmount(value)}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => [(Number(value) || 0).toLocaleString() + '원', '']}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend />
                      <Bar dataKey="수입" fill="#22c55e" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="수입"
                          position="top"
                          formatter={(value) => formatAmount(Number(value) || 0)}
                          style={{ fontSize: 10, fill: '#16a34a' }}
                        />
                      </Bar>
                      <Bar dataKey="지출" fill="#ef4444" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="지출"
                          position="top"
                          formatter={(value) => formatAmount(Number(value) || 0)}
                          style={{ fontSize: 10, fill: '#dc2626' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>월</TableHead>
                      <TableHead className="text-right">수입</TableHead>
                      <TableHead className="text-right">지출</TableHead>
                      <TableHead className="text-right">수지차액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.months.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{month.month}월</TableCell>
                        <TableCell className="text-right text-green-600">
                          {month.income.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {month.expense.toLocaleString()}원
                        </TableCell>
                        <TableCell className={`text-right font-medium ${month.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {month.balance >= 0 ? '+' : ''}{month.balance.toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-bold">
                      <TableCell>합계</TableCell>
                      <TableCell className="text-right text-green-600">
                        {totalIncome.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {totalExpense.toLocaleString()}원
                      </TableCell>
                      <TableCell className={`text-right ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString()}원
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
