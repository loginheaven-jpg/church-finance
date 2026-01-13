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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Heart, Calendar, TrendingUp, Loader2, ChevronLeft, ChevronRight, Users, Wallet } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
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

interface FamilyMember {
  name: string;
  isRepresentative: boolean;
}

interface FamilyGroup {
  representative: string;
  members: FamilyMember[];
}

interface YearlyHistory {
  year: number;
  totalAmount: number;
}

interface PledgeStatus {
  type: '건축헌금' | '선교헌금';
  pledged_amount: number;
  fulfilled_amount: number;
  remaining: number;
}

interface MyOfferingData {
  year: number;
  userName: string;
  mode: string;
  totalAmount: number;
  totalCount: number;
  summaryByType: OfferingSummary[];
  monthlyData: MonthlyData[];
  previousYearMonthly: MonthlyData[];
  records: OfferingRecord[];
  familyGroup: FamilyGroup;
  yearlyHistory?: YearlyHistory[];
  pledgeStatus: PledgeStatus[];
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000)}만`;
  }
  return amount.toLocaleString();
}

export default function MyOfferingPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState<'personal' | 'family'>('family');
  const [data, setData] = useState<MyOfferingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 다이얼로그 상태
  const [showCumulativeDialog, setShowCumulativeDialog] = useState(false);
  const [showYearlyDialog, setShowYearlyDialog] = useState(false);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/my-offering?year=${year}&mode=${mode}`);
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
  }, [year, mode]);

  // 누계 다이얼로그 열기 (연도별 히스토리 조회)
  const openCumulativeDialog = async () => {
    setShowCumulativeDialog(true);
    if (yearlyHistory.length === 0) {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/my-offering?year=${year}&mode=${mode}&includeHistory=true`);
        if (res.ok) {
          const result = await res.json();
          setYearlyHistory(result.yearlyHistory || []);
        }
      } catch (err) {
        console.error('연도별 히스토리 조회 오류:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  // 연도별 추이 다이얼로그 열기
  const openYearlyDialog = async () => {
    setShowYearlyDialog(true);
    if (yearlyHistory.length === 0) {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/my-offering?year=${year}&mode=${mode}&includeHistory=true`);
        if (res.ok) {
          const result = await res.json();
          setYearlyHistory(result.yearlyHistory || []);
        }
      } catch (err) {
        console.error('연도별 히스토리 조회 오류:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // 누적 헌금 총액 계산
  const cumulativeTotal = yearlyHistory.reduce((sum, h) => sum + h.totalAmount, 0);

  // 월별 차트 데이터 (2년 비교)
  const chartData = data?.monthlyData.map((current, idx) => ({
    monthLabel: current.monthLabel,
    [`${year}년`]: current.amount,
    [`${year - 1}년`]: data.previousYearMonthly[idx]?.amount || 0,
  })) || [];

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            내 헌금
          </h1>
          <p className="text-slate-600 mt-1">
            {data.familyGroup.representative}님과 가족(연말정산기준 동일그룹)의 헌금 내역입니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 토글 필터 */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setMode('personal')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'personal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              본인명의
            </button>
            <button
              onClick={() => setMode('family')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'family'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              가족전체
            </button>
          </div>
          {/* 연도 선택 */}
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

      {/* 요약 카드 (3개) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 카드 1: 헌금 그룹 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 mb-2">헌금 그룹</p>
                <div className="space-y-1">
                  {mode === 'family' ? (
                    data.familyGroup.members.map((member) => (
                      <div key={member.name} className="text-sm">
                        <span className={member.isRepresentative ? 'font-bold' : ''}>
                          {member.name}
                        </span>
                        {member.isRepresentative && (
                          <span className="text-xs text-indigo-600 ml-1">(대표자)</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm font-bold">{data.userName}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 총 헌금액 (클릭 시 누계 다이얼로그) */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={openCumulativeDialog}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{year}년 총 헌금액</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.totalAmount.toLocaleString()}원
                </p>
                <p className="text-xs text-slate-400 mt-1">클릭하여 누계 보기</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 헌금 횟수 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{year}년 헌금 횟수</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.totalCount}회
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 월별 헌금 추이 (2년 비교 선그래프) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            월별 헌금 추이
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openYearlyDialog}>
            연도별 보기
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="monthLabel" />
                <YAxis
                  tickFormatter={(value) => formatAmount(value)}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value || 0).toLocaleString()}원`, '']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={`${year}년`}
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey={`${year}년`}
                    position="top"
                    formatter={(value) => (typeof value === 'number' && value > 0) ? formatAmount(value) : ''}
                    style={{ fontSize: '10px', fill: '#22c55e' }}
                  />
                </Line>
                <Line
                  type="monotone"
                  dataKey={`${year - 1}년`}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 하단 2열 레이아웃: 헌금종류별 집계 + 작정헌금 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="space-y-3">
                {data.summaryByType.map((item, index) => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-slate-500">({item.count}회)</span>
                    </div>
                    <span className="font-bold">
                      {item.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 작정헌금 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              작정헌금 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.pledgeStatus.every(p => p.pledged_amount === 0) ? (
              <p className="text-slate-500 text-center py-8">
                {year}년 작정헌금이 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {data.pledgeStatus.map((pledge) => (
                  pledge.pledged_amount > 0 && (
                    <div key={pledge.type} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{pledge.type}</span>
                        <span className="text-sm text-slate-500">
                          {Math.round((pledge.fulfilled_amount / pledge.pledged_amount) * 100)}% 달성
                        </span>
                      </div>
                      {/* 진행률 바 */}
                      <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full ${
                            pledge.fulfilled_amount >= pledge.pledged_amount
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (pledge.fulfilled_amount / pledge.pledged_amount) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-slate-500">작정액</p>
                          <p className="font-medium">{formatAmount(pledge.pledged_amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">누계액</p>
                          <p className="font-medium text-blue-600">{formatAmount(pledge.fulfilled_amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">잔액</p>
                          <p className={`font-medium ${pledge.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatAmount(pledge.remaining)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">헌금자</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">구분</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">금액</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((record) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm">{record.date}</td>
                      <td className="py-3 px-4 text-sm">{record.donor_name}</td>
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

      {/* 누계 다이얼로그 */}
      <Dialog open={showCumulativeDialog} onOpenChange={setShowCumulativeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>헌금 누계 (2003년~현재)</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-500">총 헌금 누계액</p>
                  <p className="text-3xl font-bold text-green-600">
                    {cumulativeTotal.toLocaleString()}원
                  </p>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {yearlyHistory.filter(h => h.totalAmount > 0).map((h) => (
                    <div
                      key={h.year}
                      className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"
                    >
                      <span className="font-medium">{h.year}년</span>
                      <span className="text-slate-700">{h.totalAmount.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 연도별 추이 다이얼로그 */}
      <Dialog open={showYearlyDialog} onOpenChange={setShowYearlyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>연도별 헌금 추이 (2003년~현재)</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyHistory.filter(h => h.totalAmount > 0)}>
                    <XAxis dataKey="year" />
                    <YAxis
                      tickFormatter={(value) => formatAmount(value)}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value) => [`${Number(value || 0).toLocaleString()}원`, '헌금액']}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalAmount"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey="totalAmount"
                        position="top"
                        formatter={(value) => (typeof value === 'number') ? formatAmount(value) : ''}
                        style={{ fontSize: '10px', fill: '#22c55e' }}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
