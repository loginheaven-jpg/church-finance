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
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
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
  LineChart,
  Line,
} from 'recharts';
import { useYear } from '@/contexts/YearContext';

interface ComparisonData {
  years: number[];
  summary: Array<{
    year: number;
    totalIncome: number;
    totalExpense: number;
    balance: number;
    incomeGrowth: number;
    expenseGrowth: number;
  }>;
  monthlyTrend: Array<{
    year: number;
    income: number[];
    expense: number[];
  }>;
}

export default function ComparisonReportPage() {
  const { year: endYear, setYear: setEndYear } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComparisonData | null>(null);

  useEffect(() => {
    loadData();
  }, [endYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/comparison?year=${endYear}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || '데이터를 불러오는 데 실패했습니다');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`;
    }
    if (amount >= 10000) {
      return `${Math.round(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  };

  const formatFullAmount = (amount: number) => {
    return amount.toLocaleString() + '원';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-slate-500">
        데이터를 불러올 수 없습니다
      </div>
    );
  }

  // 연도별 수입/지출 차트 데이터
  const yearlyChartData = data.summary.map(s => ({
    year: `${s.year}년`,
    수입: s.totalIncome,
    지출: s.totalExpense,
    수지차액: s.balance,
  }));

  // 월별 추이 차트 데이터
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthlyChartData = months.map((month, idx) => {
    const item: Record<string, string | number> = { month };
    data.monthlyTrend.forEach(trend => {
      item[`${trend.year}수입`] = trend.income[idx];
      item[`${trend.year}지출`] = trend.expense[idx];
    });
    return item;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">3개년 비교 보고서</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.years[0]}년 ~ {data.years[2]}년 재정 현황 비교
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEndYear(endYear - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium w-32 text-center">
            ~ {endYear}년
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEndYear(endYear + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            연도별 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                {data.years.map(year => (
                  <TableHead key={year} className="text-right">{year}년</TableHead>
                ))}
                <TableHead className="text-right">전년 대비</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">총 수입</TableCell>
                {data.summary.map(s => (
                  <TableCell key={s.year} className="text-right text-green-600">
                    {formatFullAmount(s.totalIncome)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {data.summary[2].incomeGrowth >= 0 ? (
                    <span className="text-green-600 flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4" />
                      +{data.summary[2].incomeGrowth}%
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4" />
                      {data.summary[2].incomeGrowth}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">총 지출</TableCell>
                {data.summary.map(s => (
                  <TableCell key={s.year} className="text-right text-red-600">
                    {formatFullAmount(s.totalExpense)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {data.summary[2].expenseGrowth >= 0 ? (
                    <span className="text-red-600 flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4" />
                      +{data.summary[2].expenseGrowth}%
                    </span>
                  ) : (
                    <span className="text-green-600 flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4" />
                      {data.summary[2].expenseGrowth}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-50 font-bold">
                <TableCell>수지차액</TableCell>
                {data.summary.map(s => (
                  <TableCell key={s.year} className={`text-right ${s.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {s.balance >= 0 ? '+' : ''}{formatFullAmount(s.balance)}
                  </TableCell>
                ))}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Yearly Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>연도별 수입/지출 비교</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip
                formatter={(value) => formatFullAmount(Number(value) || 0)}
              />
              <Legend />
              <Bar dataKey="수입" fill="#22c55e" />
              <Bar dataKey="지출" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>월별 수입 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip
                formatter={(value) => formatFullAmount(Number(value) || 0)}
              />
              <Legend />
              {data.years.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`${year}수입`}
                  name={`${year}년`}
                  stroke={['#94a3b8', '#3b82f6', '#22c55e'][idx]}
                  strokeWidth={idx === 2 ? 3 : 1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Expense Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>월별 지출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip
                formatter={(value) => formatFullAmount(Number(value) || 0)}
              />
              <Legend />
              {data.years.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`${year}지출`}
                  name={`${year}년`}
                  stroke={['#94a3b8', '#f97316', '#ef4444'][idx]}
                  strokeWidth={idx === 2 ? 3 : 1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
