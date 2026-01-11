'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Calendar, TrendingUp, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface OfferingSummary {
  code: number;
  name: string;
  amount: number;
  count: number;
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  amount: number;
}

interface OfferingRecord {
  id: string;
  date: string;
  offering_code: number;
  donor_name: string;
  representative: string;
  amount: number;
  note: string;
}

interface MyOfferingData {
  year: number;
  userName: string;
  totalAmount: number;
  totalCount: number;
  summaryByType: OfferingSummary[];
  monthlyData: MonthlyData[];
  records: OfferingRecord[];
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만`;
  }
  return amount.toLocaleString();
}

export default function MyOfferingPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<MyOfferingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/my-offering?year=${year}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || '데이터를 불러올 수 없습니다');
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            내 헌금
          </h1>
          <p className="text-slate-600 mt-1">
            {data.userName}님의 헌금 내역입니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear(prev => prev - 1)}
            disabled={year <= currentYear - 4}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear(prev => prev + 1)}
            disabled={year >= currentYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">총 헌금액</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.totalAmount.toLocaleString()}원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">헌금 횟수</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.totalCount}회
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">헌금 종류</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.summaryByType.length}종
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 월별 헌금 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>월별 헌금 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <XAxis dataKey="monthLabel" />
                <YAxis
                  tickFormatter={(value) => formatAmount(value)}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value || 0).toLocaleString()}원`, '헌금액']}
                />
                <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  {data.monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.amount > 0 ? '#22c55e' : '#e5e7eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 헌금 종류별 집계 */}
      <Card>
        <CardHeader>
          <CardTitle>헌금 종류별 집계</CardTitle>
        </CardHeader>
        <CardContent>
          {data.summaryByType.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              {year}년 헌금 내역이 없습니다
            </p>
          ) : (
            <div className="space-y-4">
              {data.summaryByType.map((item, index) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-slate-500">({item.count}회)</span>
                  </div>
                  <span className="font-bold text-lg">
                    {item.amount.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세 내역 */}
      <Card>
        <CardHeader>
          <CardTitle>상세 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {data.records.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              {year}년 헌금 내역이 없습니다
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">날짜</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">구분</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">금액</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm">{record.date}</td>
                      <td className="py-3 px-4 text-sm">
                        {data.summaryByType.find(s => s.code === record.offering_code)?.name ||
                          `코드${record.offering_code}`}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium">
                        {record.amount.toLocaleString()}원
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {record.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
