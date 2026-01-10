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
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, Users, UserPlus, UserMinus } from 'lucide-react';
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
}

interface DonorAnalysisData {
  year: number;
  summary: {
    totalDonors: number;
    totalHouseholds: number;
    totalAmount: number;
    avgPerDonor: number;
    avgPerHousehold: number;
    totalTransactions: number;
  };
  amountDistribution: Array<{
    label: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  monthlyDonors: Array<{
    month: number;
    count: number;
    amount: number;
  }>;
  frequencyDistribution: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  retention: {
    newDonors: number;
    lostDonors: number;
    retainedDonors: number;
    retentionRate: number;
  };
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function IncomeAnalysisPage() {
  const { year, setYear } = useYear();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IncomeAnalysisData | null>(null);
  const [donorData, setDonorData] = useState<DonorAnalysisData | null>(null);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incomeRes, donorRes] = await Promise.all([
        fetch(`/api/reports/income-analysis?year=${year}`),
        fetch(`/api/reports/donor-analysis?year=${year}`),
      ]);
      const [incomeResult, donorResult] = await Promise.all([
        incomeRes.json(),
        donorRes.json(),
      ]);

      if (incomeResult.success) {
        setData(incomeResult.data);
      } else {
        toast.error(incomeResult.error || '수입 데이터를 불러오는 데 실패했습니다');
      }

      if (donorResult.success) {
        setDonorData(donorResult.data);
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
          <CardHeader className="pb-2">
            <CardTitle>카테고리별 비율</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={0}
                  label={({ name, value, percent }) =>
                    `${name} ${formatAmount(value)} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={{ strokeWidth: 1 }}
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
          <CardHeader className="pb-2">
            <CardTitle>세부내역</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead className="w-[80px]">카테고리</TableHead>
                    <TableHead>항목명</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right w-[60px]">비율</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCode
                    .sort((a, b) => b.amount - a.amount)
                    .map(item => (
                    <TableRow key={item.code}>
                      <TableCell className="text-slate-500 text-xs">{item.category}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{formatFullAmount(item.amount)}</TableCell>
                      <TableCell className="text-right text-slate-600">
                        {((item.amount / data.summary.totalIncome) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

      {/* 헌금자 분석 섹션 */}
      {donorData && (
        <>
          {/* 헌금자 Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">총 헌금자(가구)</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {donorData.summary.totalDonors.toLocaleString()}명
                      <span className="text-lg text-slate-600">({donorData.summary.totalHouseholds.toLocaleString()}가구)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">인당평균(가구당 평균)</div>
                    <div className="text-2xl font-bold text-slate-900" title={`${formatFullAmount(donorData.summary.avgPerDonor)} (가구당: ${formatFullAmount(donorData.summary.avgPerHousehold)})`}>
                      {formatAmount(donorData.summary.avgPerDonor)}원
                      <span className="text-lg text-slate-600">({formatAmount(donorData.summary.avgPerHousehold)}원)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-full">
                    <UserPlus className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">신규 헌금자</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      +{donorData.retention.newDonors}명
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <UserMinus className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">이탈 헌금자</div>
                    <div className="text-2xl font-bold text-red-600">
                      -{donorData.retention.lostDonors}명
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 유지율 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>전년 대비 헌금자 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {donorData.retention.retainedDonors}명
                  </div>
                  <div className="text-sm text-slate-500 mt-1">유지</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-600">
                    +{donorData.retention.newDonors}명
                  </div>
                  <div className="text-sm text-slate-500 mt-1">신규</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">
                    -{donorData.retention.lostDonors}명
                  </div>
                  <div className="text-sm text-slate-500 mt-1">이탈</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
                <span className="text-sm text-slate-600">전년 대비 유지율: </span>
                <span className="text-lg font-bold text-blue-600">
                  {donorData.retention.retentionRate}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 월별 헌금자 수 추이 */}
          <Card>
            <CardHeader>
              <CardTitle>월별 헌금자 수 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={donorData.monthlyDonors.map(m => ({
                  name: `${m.month}월`,
                  헌금자수: m.count,
                  헌금액: m.amount,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={formatAmount} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === '헌금액'
                        ? [Number(value).toLocaleString() + '원', name]
                        : [value + '명', name]
                    }
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="헌금자수"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="헌금액"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 금액 분포 & 빈도 분포 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>월평균 헌금액 분포</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donorData.amountDistribution.map(d => ({
                        name: d.label,
                        value: d.count,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {donorData.amountDistribution.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value + '명', '헌금자수']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {donorData.amountDistribution.map((d, idx) => (
                    <div key={d.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span>{d.label}</span>
                      </div>
                      <span className="font-medium">{d.count}명 ({d.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>연간 헌금 빈도 분포</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={donorData.frequencyDistribution.map(f => ({
                    name: f.label,
                    헌금자수: f.count,
                    비율: f.percentage,
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value) => [value + '명', '헌금자수']} />
                    <Bar dataKey="헌금자수" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey="헌금자수"
                        position="right"
                        formatter={(value) => `${value}명`}
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    <strong>분석:</strong> 연간 헌금 빈도 분포를 통해 정기적으로 헌금하는 성도와
                    비정기적으로 헌금하는 성도의 비율을 파악할 수 있습니다.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
