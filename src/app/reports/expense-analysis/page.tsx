'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, TrendingDown, Receipt, Building2 } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useYear } from '@/contexts/YearContext';

interface ExpenseAnalysisData {
  year: number;
  summary: {
    totalExpense: number;
    totalBudget: number;
    executionRate: number;
    totalCount: number;
    averagePerTransaction: number;
  };
  byCategory: Array<{
    code: number;
    name: string;
    amount: number;
    count: number;
    budget: number;
    executionRate: number;
  }>;
  byCode: Array<{
    code: number;
    name: string;
    category: string;
    amount: number;
    count: number;
    budget: number;
    executionRate: number;
  }>;
  byMonth: Array<{ month: number; expense: number; count: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
  topVendors: Array<{ vendor: string; amount: number; count: number }>;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function ExpenseAnalysisPage() {
  const { year, setYear } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExpenseAnalysisData | null>(null);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/expense-analysis?year=${year}`);
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

  const formatFullAmount = (amount: number) => amount.toLocaleString() + '원';

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

  // 월별 차트 데이터
  const monthlyData = data.byMonth.map(m => ({
    month: `${m.month}월`,
    지출: m.expense,
    건수: m.count,
  }));

  // 카테고리 파이차트 데이터
  const categoryPieData = data.byCategory.map(c => ({
    name: c.name,
    value: c.amount,
  }));

  // 예산 대비 집행 차트 데이터 (상위 8개)
  const budgetComparisonData = data.byCategory
    .filter(c => c.budget > 0)
    .slice(0, 8)
    .map(c => ({
      name: c.name.length > 6 ? c.name.slice(0, 6) + '...' : c.name,
      예산: c.budget,
      집행: c.amount,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">지출 분석</h1>
          <p className="text-sm text-slate-500 mt-1">
            {year}년 지출 현황 상세 분석
          </p>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-sm text-slate-500">총 지출</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatFullAmount(data.summary.totalExpense)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">총 예산</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatFullAmount(data.summary.totalBudget)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">집행률</div>
            <div className="text-2xl font-bold text-slate-900">
              {data.summary.executionRate}%
            </div>
            <Progress value={Math.min(data.summary.executionRate, 100)} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-slate-500">총 건수</div>
                <div className="text-2xl font-bold text-slate-900">
                  {data.summary.totalCount.toLocaleString()}건
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>월별 지출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip formatter={(value) => formatFullAmount(Number(value) || 0)} />
              <Legend />
              <Bar dataKey="지출" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Budget vs Execution */}
      {budgetComparisonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>예산 대비 집행 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatAmount} />
                <Tooltip formatter={(value) => formatFullAmount(Number(value) || 0)} />
                <Legend />
                <Bar dataKey="예산" fill="#94a3b8" />
                <Bar dataKey="집행" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 비율</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {categoryPieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatFullAmount(Number(value) || 0)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>카테고리별 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="text-right">지출</TableHead>
                  <TableHead className="text-right">예산</TableHead>
                  <TableHead className="text-right">집행률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCategory.map(cat => (
                  <TableRow key={cat.code}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatFullAmount(cat.amount)}
                    </TableCell>
                    <TableCell className="text-right text-slate-500">
                      {formatFullAmount(cat.budget)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cat.executionRate > 100 ? 'text-red-600 font-medium' : ''}>
                        {cat.executionRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>결제수단별 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>결제수단</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right">건수</TableHead>
                <TableHead className="text-right">비율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byPaymentMethod.map(pm => (
                <TableRow key={pm.method}>
                  <TableCell className="font-medium">{pm.method}</TableCell>
                  <TableCell className="text-right">{formatFullAmount(pm.amount)}</TableCell>
                  <TableCell className="text-right">{pm.count}건</TableCell>
                  <TableCell className="text-right">
                    {((pm.amount / data.summary.totalExpense) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Vendors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            상위 거래처 (Top 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">순위</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead className="text-right">총 지출액</TableHead>
                <TableHead className="text-right">거래 횟수</TableHead>
                <TableHead className="text-right">평균</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topVendors.map((vendor, idx) => (
                <TableRow key={vendor.vendor}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{vendor.vendor}</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    {formatFullAmount(vendor.amount)}
                  </TableCell>
                  <TableCell className="text-right">{vendor.count}회</TableCell>
                  <TableCell className="text-right">
                    {formatFullAmount(Math.round(vendor.amount / vendor.count))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
