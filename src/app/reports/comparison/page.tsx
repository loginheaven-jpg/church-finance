'use client';

import { useState, useEffect, useMemo } from 'react';
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

interface CategoryData {
  name: string;
  amount: number;
}

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
  incomeByCategory: Array<{
    year: number;
    categories: Record<number, CategoryData>;
  }>;
  expenseByCategory: Array<{
    year: number;
    categories: Record<number, CategoryData>;
  }>;
  monthlyTrend: Array<{
    year: number;
    income: number[];
    expense: number[];
  }>;
}

type ChartMode = 'all' | 'income' | 'expense';

// 색상 팔레트 (카테고리별)
const CATEGORY_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7',
];

export default function ComparisonReportPage() {
  const { year: endYear, setYear: setEndYear } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComparisonData | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('all');

  useEffect(() => {
    loadData();
  }, [endYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/comparison?year=${endYear}&count=10`);
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

  // 연도별 차트 데이터 생성
  const yearlyChartData = useMemo(() => {
    if (!data) return [];

    if (chartMode === 'all') {
      // 모두: 단순 수입/지출 바
      return data.summary.map(s => ({
        year: `${s.year}`,
        수입: s.totalIncome,
        지출: s.totalExpense,
      }));
    }

    // 수입 또는 지출: 카테고리별 누적 바
    const categorySource = chartMode === 'income' ? data.incomeByCategory : data.expenseByCategory;
    if (!categorySource) return [];

    return data.years.map((year, idx) => {
      const yearCategoryData = categorySource[idx]?.categories || {};
      const item: Record<string, string | number> = { year: `${year}` };

      Object.values(yearCategoryData).forEach(cat => {
        item[cat.name] = cat.amount;
      });

      return item;
    });
  }, [data, chartMode]);

  // 차트에 표시할 카테고리 목록
  const chartCategories = useMemo(() => {
    if (!data || chartMode === 'all') return [];

    const categorySource = chartMode === 'income' ? data.incomeByCategory : data.expenseByCategory;
    if (!categorySource) return [];

    const categoryTotals = new Map<string, number>();

    categorySource.forEach(yearData => {
      Object.values(yearData.categories).forEach(cat => {
        categoryTotals.set(cat.name, (categoryTotals.get(cat.name) || 0) + cat.amount);
      });
    });

    // 총액 기준 정렬
    return Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [data, chartMode]);

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

  // 월별 추이 차트 데이터 (3개년만)
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthlyChartData = months.map((month, idx) => {
    const item: Record<string, string | number> = { month };
    data.monthlyTrend.forEach(trend => {
      item[`${trend.year}수입`] = trend.income[idx];
      item[`${trend.year}지출`] = trend.expense[idx];
    });
    return item;
  });

  // 최근 3년 데이터 (테이블용)
  const recentYears = data.years.slice(-3);
  const recentSummary = data.summary.slice(-3);

  // 차트 높이 결정 (카테고리별 표시시 2배)
  const chartHeight = chartMode === 'all' ? 350 : 600;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">연간 비교</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.years[0]}년 ~ {data.years[data.years.length - 1]}년 재정 현황 비교
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

      {/* Summary Table (최근 3개년) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            최근 3개년 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                {recentYears.map(year => (
                  <TableHead key={year} className="text-right">{year}년</TableHead>
                ))}
                <TableHead className="text-right">전년 대비</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">총 수입</TableCell>
                {recentSummary.map(s => (
                  <TableCell key={s.year} className="text-right text-green-600">
                    {formatFullAmount(s.totalIncome)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {recentSummary[2]?.incomeGrowth >= 0 ? (
                    <span className="text-green-600 flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4" />
                      +{recentSummary[2]?.incomeGrowth}%
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4" />
                      {recentSummary[2]?.incomeGrowth}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">총 지출</TableCell>
                {recentSummary.map(s => (
                  <TableCell key={s.year} className="text-right text-red-600">
                    {formatFullAmount(s.totalExpense)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {recentSummary[2]?.expenseGrowth >= 0 ? (
                    <span className="text-red-600 flex items-center justify-end gap-1">
                      <TrendingUp className="h-4 w-4" />
                      +{recentSummary[2]?.expenseGrowth}%
                    </span>
                  ) : (
                    <span className="text-green-600 flex items-center justify-end gap-1">
                      <TrendingDown className="h-4 w-4" />
                      {recentSummary[2]?.expenseGrowth}%
                    </span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-50 font-bold">
                <TableCell>수지차액</TableCell>
                {recentSummary.map(s => (
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
          <div className="flex items-center justify-between">
            <CardTitle>연도별비교</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={chartMode === 'income' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartMode('income')}
                className={chartMode === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                수입
              </Button>
              <Button
                variant={chartMode === 'expense' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartMode('expense')}
                className={chartMode === 'expense' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                지출
              </Button>
              <Button
                variant={chartMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartMode('all')}
              >
                모두
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip
                formatter={(value) => formatFullAmount(Number(value) || 0)}
              />
              <Legend />
              {chartMode === 'all' ? (
                <>
                  <Bar dataKey="수입" fill="#22c55e" />
                  <Bar dataKey="지출" fill="#ef4444" />
                </>
              ) : (
                chartCategories.map((category, idx) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="a"
                    fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Income Trend Chart (3개년) */}
      <Card>
        <CardHeader>
          <CardTitle>월별 수입 추이 (3개년)</CardTitle>
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
              {data.monthlyTrend.map((trend, idx) => (
                <Line
                  key={trend.year}
                  type="monotone"
                  dataKey={`${trend.year}수입`}
                  name={`${trend.year}년`}
                  stroke={['#94a3b8', '#3b82f6', '#22c55e'][idx]}
                  strokeWidth={idx === 2 ? 3 : 1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Expense Trend Chart (3개년) */}
      <Card>
        <CardHeader>
          <CardTitle>월별 지출 추이 (3개년)</CardTitle>
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
              {data.monthlyTrend.map((trend, idx) => (
                <Line
                  key={trend.year}
                  type="monotone"
                  dataKey={`${trend.year}지출`}
                  name={`${trend.year}년`}
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
