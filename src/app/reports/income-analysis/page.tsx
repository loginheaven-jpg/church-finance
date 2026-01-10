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
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, Users } from 'lucide-react';
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
  LineChart,
  Line,
  LabelList,
} from 'recharts';
import { useYear } from '@/contexts/YearContext';

interface IncomeAnalysisData {
  year: number;
  summary: {
    totalIncome: number;
    totalCount: number;
    averagePerTransaction: number;
  };
  byCategory: Array<{ name: string; amount: number; count: number }>;
  byCode: Array<{ code: number; name: string; category: string; amount: number; count: number }>;
  byMonth: Array<{ month: number; income: number; count: number }>;
  bySource: Array<{ source: string; amount: number; count: number }>;
  topDonors: Array<{ representative: string; amount: number; count: number }>;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function IncomeAnalysisPage() {
  const { year, setYear } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IncomeAnalysisData | null>(null);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/income-analysis?year=${year}`);
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
    수입: m.income,
    건수: m.count,
  }));

  // 카테고리 파이차트 데이터
  const categoryPieData = data.byCategory.map(c => ({
    name: c.name,
    value: c.amount,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">수입 분석</h1>
          <p className="text-sm text-slate-500 mt-1">
            {year}년 수입 현황 상세 분석
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-slate-500">총 수입</div>
                <div className="text-2xl font-bold text-slate-900">
                  {formatFullAmount(data.summary.totalIncome)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">건당 평균</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatFullAmount(data.summary.averagePerTransaction)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>월별 수입 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAmount} />
              <Tooltip formatter={(value) => formatFullAmount(Number(value) || 0)} />
              <Legend />
              <Bar dataKey="수입" fill="#22c55e" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="수입"
                  position="top"
                  formatter={(value) => formatAmount(Number(value) || 0)}
                  style={{ fontSize: 11, fill: '#374151' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                  <TableHead className="text-right">비율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCategory.map(cat => (
                  <TableRow key={cat.name}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right">{formatFullAmount(cat.amount)}</TableCell>
                    <TableCell className="text-right">{cat.count}건</TableCell>
                    <TableCell className="text-right">
                      {((cat.amount / data.summary.totalIncome) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Source Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>경로별 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>경로</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right">건수</TableHead>
                <TableHead className="text-right">비율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bySource.map(src => (
                <TableRow key={src.source}>
                  <TableCell className="font-medium">{src.source}</TableCell>
                  <TableCell className="text-right">{formatFullAmount(src.amount)}</TableCell>
                  <TableCell className="text-right">{src.count}건</TableCell>
                  <TableCell className="text-right">
                    {((src.amount / data.summary.totalIncome) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Donors */}
      <Card>
        <CardHeader>
          <CardTitle>상위 헌금자 (Top 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">순위</TableHead>
                <TableHead>대표자</TableHead>
                <TableHead className="text-right">총 헌금액</TableHead>
                <TableHead className="text-right">헌금 횟수</TableHead>
                <TableHead className="text-right">평균</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topDonors.map((donor, idx) => (
                <TableRow key={donor.representative}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{donor.representative}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatFullAmount(donor.amount)}
                  </TableCell>
                  <TableCell className="text-right">{donor.count}회</TableCell>
                  <TableCell className="text-right">
                    {formatFullAmount(Math.round(donor.amount / donor.count))}
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
