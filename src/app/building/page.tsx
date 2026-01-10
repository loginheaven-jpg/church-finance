'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  LabelList,
} from 'recharts';
import {
  Building2,
  CreditCard,
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Calculator,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface BuildingHistory {
  year: number;
  yearlyDonation: number;
  cumulativeDonation: number;
  principalPaid: number;
  interestPaid: number;
  loanBalance: number;
  milestone?: {
    title: string;
    description: string;
    icon: string;
  };
}

interface RecentYear {
  year: number;
  donation: number;
  repayment: number;
  principal: number;
  interest: number;
}

interface BuildingData {
  summary: {
    totalCost: number;
    landCost: number;
    buildingCost: number;
    totalDonation: number;
    totalLoan: number;
    principalPaid: number;
    interestPaid: number;
    loanBalance: number;
    donationRate: number;
    repaymentRate: number;
  };
  history: BuildingHistory[];
  recent: {
    totalDonation: number;
    totalRepayment: number;
    totalPrincipal: number;
    totalInterest: number;
    shortage: number;
    years: RecentYear[];
  };
  simulation: {
    currentLoanBalance: number;
    interestRate: number;
    cumulativeInterestPaid: number;
  };
}

// ============================================================================
// Utils
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    const billions = amount / 100000000;
    // .0 제거 (8.0억 → 8억)
    return billions % 1 === 0 ? `${Math.round(billions)}억` : `${billions.toFixed(1)}억`;
  }
  if (amount >= 1000000) {
    return `${Math.round(amount / 1000000)}백만`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만`;
  }
  return amount.toLocaleString();
}

function formatFullCurrency(amount: number): string {
  return amount.toLocaleString() + '원';
}

// ============================================================================
// Components
// ============================================================================

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  interface PayloadItem {
    dataKey: string;
    value: number;
    name: string;
    color: string;
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
      <p className="font-semibold mb-2">{label}년</p>
      {(payload as PayloadItem[]).map((item, index) => (
        <p key={index} className="text-sm" style={{ color: item.color }}>
          {item.name}: {formatFullCurrency(item.value)}
        </p>
      ))}
    </div>
  );
}

// 타임라인
function Timeline({ events }: { events: BuildingHistory[] }) {
  const milestones = events.filter(e => e.milestone);

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
      {milestones.map((event) => (
        <div
          key={event.year}
          className={cn(
            "flex flex-col items-center text-center",
            event.milestone?.icon === '📍' && "text-orange-600 font-bold",
            event.milestone?.icon === '📌' && "text-blue-600 font-bold",
            event.milestone?.icon === '🎯' && "text-green-600"
          )}
        >
          <span className="text-2xl mb-1">{event.milestone?.icon}</span>
          <span className="text-sm font-semibold">{event.year}</span>
          <span className="text-xs text-slate-500">{event.milestone?.title}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function BuildingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BuildingData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [annualRepayment, setAnnualRepayment] = useState<number>(5000);
  const [flippedCards, setFlippedCards] = useState<{card1: boolean, card2: boolean}>({card1: false, card2: false});

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/reports/building');
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to load building data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 시뮬레이션 계산
  const simulationResult = useMemo(() => {
    if (!data) return null;

    const annualAmount = annualRepayment * 10000;
    const rate = data.simulation.interestRate / 100;
    let balance = data.simulation.currentLoanBalance;
    let cumulativeInterest = data.simulation.cumulativeInterestPaid;
    const currentYear = new Date().getFullYear();

    const results: Array<{
      year: number;
      yearlyPrincipal: number;
      yearlyInterest: number;
      balance: number;
      cumulativeInterest: number;
    }> = [];
    let year = currentYear;

    while (balance > 0 && year < currentYear + 50) {
      const yearlyInterest = Math.round(balance * rate);

      // 봉헌헌금에서 이자를 먼저 지불하고, 남은 금액으로 원금 상환
      const availableForPrincipal = annualAmount - yearlyInterest;

      // 이자도 못 내는 경우 완납 불가
      if (availableForPrincipal <= 0) {
        // 최소한 이자만 계속 내는 상황 기록 후 종료
        results.push({
          year,
          yearlyPrincipal: 0,
          yearlyInterest,
          balance,
          cumulativeInterest: cumulativeInterest + yearlyInterest
        });
        break;
      }

      const yearlyPrincipal = Math.min(availableForPrincipal, balance);
      balance = Math.max(0, balance - yearlyPrincipal);
      cumulativeInterest += yearlyInterest;

      results.push({
        year,
        yearlyPrincipal,
        yearlyInterest,
        balance,
        cumulativeInterest
      });

      year++;
      if (balance === 0) break;
    }

    return {
      results,
      payoffYear: results.length > 0 && results[results.length - 1].balance === 0
        ? results[results.length - 1].year
        : null,
      totalInterestPaid: cumulativeInterest,
      additionalInterest: cumulativeInterest - data.simulation.cumulativeInterestPaid
    };
  }, [data, annualRepayment]);

  // 풀스크린 토글
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">건축헌금 현황을 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertCircle className="h-8 w-8 text-yellow-500" />
        <p className="text-sm text-slate-500">건축헌금 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 차트 데이터
  const chartData = data.history.map(h => ({
    year: h.year,
    건축헌금누적: h.cumulativeDonation / 100000000,
    원금상환: h.principalPaid / 100000000,
    이자지출: h.interestPaid / 100000000,
    대출잔액: h.loanBalance / 100000000,
  }));

  // 5년 실적 차트 데이터 (2021~2025, 스택형 바 2개)
  // 사용자 제공 데이터 (단위: 백만원)
  const fiveYearData = [
    { year: '2021', 건축헌금: 79.1, 원금상환: 195.0, 이자지출: 42.7 },
    { year: '2022', 건축헌금: 100.0, 원금상환: 150.0, 이자지출: 53.1 },
    { year: '2023', 건축헌금: 74.2, 원금상환: 45.2, 이자지출: 73.6 },
    { year: '2024', 건축헌금: 63.7, 원금상환: 50.0, 이자지출: 71.3 },
    { year: '2025', 건축헌금: 55.1, 원금상환: 50.0, 이자지출: 61.0 },
  ];
  const recentChartData = fiveYearData.map(y => ({
    year: y.year,
    // 건축헌금 바 (스택: 건축헌금 + 일반예산)
    건축헌금: y.건축헌금 / 100,  // 백만원 → 억
    일반예산: Math.max(0, (y.원금상환 + y.이자지출 - y.건축헌금)) / 100,
    // 건축지출 바 (스택: 원금상환 + 이자지출)
    원금상환: y.원금상환 / 100,
    이자지출: y.이자지출 / 100,
  }));

  return (
    <div className={cn(
      "space-y-6",
      isFullscreen && "fixed inset-0 z-50 bg-[#F8F6F3] p-8 overflow-auto"
    )}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            성전봉헌 현황
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            건축헌금 및 대출 상환 현황
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? (
            <><Minimize2 className="h-4 w-4 mr-2" />축소</>
          ) : (
            <><Maximize2 className="h-4 w-4 mr-2" />전체화면</>
          )}
        </Button>
      </div>

      {/* 상단 3개 카드 (클릭 토글) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* 카드 1: 건축비 총액 ↔ 건축비 출처 */}
        <Card
          className="border-l-4 border-l-slate-500 cursor-pointer hover:shadow-lg transition-shadow h-[200px] flex flex-col"
          onClick={() => setFlippedCards(prev => ({...prev, card1: !prev.card1}))}
        >
          <CardHeader className="pb-0 pt-2 shrink-0">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {flippedCards.card1 ? '건축비 출처' : '건축비 총액'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1 pt-0">
            {flippedCards.card1 ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-green-600">32억</div>
                  <div className="text-sm text-muted-foreground">건축헌금 (2003~2011)</div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-red-600">21억</div>
                  <div className="text-sm text-muted-foreground">대출</div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-5xl font-bold text-slate-900">
                  {formatCurrency(data.summary.totalCost)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  토지 {formatCurrency(data.summary.landCost)} + 건물 {formatCurrency(data.summary.buildingCost)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 카드 2: 건축지출 (2012~2025) */}
        <Card
          className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow h-[200px] flex flex-col"
          onClick={() => setFlippedCards(prev => ({...prev, card2: !prev.card2}))}
        >
          <CardHeader className="pb-0 pt-2 shrink-0">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              건축지출 (2012~2025)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1 pt-0">
            {flippedCards.card2 ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-blue-600">{formatCurrency(data.summary.principalPaid)}</div>
                  <div className="text-sm text-muted-foreground">원금상환</div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-red-600">{formatCurrency(data.summary.interestPaid)}</div>
                  <div className="text-sm text-muted-foreground">이자지출</div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-5xl font-bold text-blue-600">
                  {formatCurrency(data.summary.principalPaid + data.summary.interestPaid)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  원금 {formatCurrency(data.summary.principalPaid)} + 이자 {formatCurrency(data.summary.interestPaid)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 카드 3: 대출 잔액 */}
        <Card className="border-l-4 border-l-red-500 h-[200px] flex flex-col">
          <CardHeader className="pb-0 pt-2 shrink-0">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              대출 잔액
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center flex-1 pt-0">
            <div className="text-5xl font-bold text-red-600">
              {formatCurrency(data.summary.loanBalance)}
            </div>
            <div className="mt-2">
              <Progress value={data.summary.repaymentRate} className="h-3" />
              <p className="text-sm text-muted-foreground mt-1">
                원금 상환률 {data.summary.repaymentRate}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 금액 구성 (가로 누적 막대) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">금액 구성 (2012~2025)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 mx-auto" style={{ width: '90%' }}>
            {/* 지출 막대 (위) */}
            <div>
              <div className="flex justify-between text-lg mb-2">
                <span className="font-semibold">지출</span>
                <span className="text-muted-foreground font-medium">18.3억</span>
              </div>
              <div className="flex h-20 rounded-lg overflow-hidden">
                <div className="flex items-center justify-center text-white text-xl font-bold" style={{ width: '56.3%', backgroundColor: '#ea580c' }}>
                  이자 10.3억
                </div>
                <div className="flex items-center justify-center text-white text-xl font-bold" style={{ width: '43.7%', backgroundColor: '#f97316' }}>
                  원금 8억
                </div>
              </div>
            </div>
            {/* 수입 막대 (아래) */}
            <div>
              <div className="flex justify-between text-lg mb-2">
                <span className="font-semibold">수입</span>
                <span className="text-muted-foreground font-medium">18.3억</span>
              </div>
              <div className="flex h-20 rounded-lg overflow-hidden">
                <div className="bg-green-500 flex items-center justify-center text-white text-xl font-bold" style={{ width: '66.7%' }}>
                  건축헌금 12.2억
                </div>
                <div className="flex items-center justify-center text-white text-xl font-bold" style={{ width: '33.3%', backgroundColor: '#166534' }}>
                  일반예산 6.1억
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5년 실적 분석 + 상환 시뮬레이션 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 5년 실적 분석 (스택형 바 차트) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              5개년 실적 분석 (2021-2025)
            </CardTitle>
            <CardDescription>
              건축헌금/일반예산 vs 원금상환/이자지출
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={recentChartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `${value}억`} />
                <Tooltip
                  formatter={(value) => [formatFullCurrency((Number(value) || 0) * 100000000), '']}
                  labelFormatter={(label) => `${label}년`}
                />
                <Legend />
                {/* 건축헌금 스택 */}
                <Bar dataKey="건축헌금" stackId="income" fill="#22c55e" name="건축헌금">
                  <LabelList dataKey="건축헌금" position="center" formatter={(v) => { const n = Number(v); return n > 0.3 ? `${Math.round(n * 100)}` : ''; }} style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
                <Bar dataKey="일반예산" stackId="income" fill="#166534" name="일반예산">
                  <LabelList dataKey="일반예산" position="center" formatter={(v) => { const n = Number(v); return n > 0.3 ? `${Math.round(n * 100)}` : ''; }} style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
                {/* 건축지출 스택 */}
                <Bar dataKey="원금상환" stackId="expense" fill="#f97316" name="원금상환">
                  <LabelList dataKey="원금상환" position="center" formatter={(v) => { const n = Number(v); return n > 0.3 ? `${Math.round(n * 100)}` : ''; }} style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
                <Bar dataKey="이자지출" stackId="expense" fill="#ea580c" name="이자지출">
                  <LabelList dataKey="이자지출" position="center" formatter={(v) => { const n = Number(v); return n > 0.3 ? `${Math.round(n * 100)}` : ''; }} style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 상환 시뮬레이션 */}
        <Card className="bg-gradient-to-br from-blue-50 to-slate-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              상환 시뮬레이션
            </CardTitle>
            <CardDescription>
              연간 상환 금액을 조절하여 완납 시점 및 총 이자를 확인하세요 (이자율: {data.simulation.interestRate}%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 슬라이더 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-medium">연간 봉헌헌금</Label>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(annualRepayment * 10000)}
                </span>
              </div>
              <Slider
                value={[annualRepayment]}
                onValueChange={(value) => setAnnualRepayment(value[0])}
                min={1000}
                max={20000}
                step={500}
                className="my-4"
              />
              <div className="flex justify-between text-muted-foreground">
                <span className="text-xs">1천만원</span>
                <span className="text-base font-bold">월 {formatCurrency(annualRepayment * 10000 / 12)}</span>
                <span className="text-xs">2억원</span>
              </div>
            </div>

            {/* 시뮬레이션 결과 */}
            {simulationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white rounded-lg border-2 border-blue-300 text-center">
                    <p className="text-sm text-muted-foreground mb-2">예상 완납 시점</p>
                    <p className={`text-5xl font-bold ${simulationResult.payoffYear ? 'text-blue-600' : 'text-red-600'}`}>
                      {simulationResult.payoffYear
                        ? `${simulationResult.payoffYear}년`
                        : '완납 불가'}
                    </p>
                    {simulationResult.payoffYear && (
                      <p className="text-base text-blue-500 mt-2">
                        {simulationResult.payoffYear - new Date().getFullYear()}년 후
                      </p>
                    )}
                  </div>
                  <div className="p-6 bg-white rounded-lg border-2 border-red-300 text-center">
                    <p className="text-sm text-muted-foreground mb-2">총 이자 (누적)</p>
                    <p className="text-5xl font-bold text-red-600">
                      {formatCurrency(simulationResult.totalInterestPaid)}
                    </p>
                    <p className="text-base text-red-500 mt-2">
                      +{formatCurrency(simulationResult.additionalInterest)} 추가
                    </p>
                  </div>
                </div>

                {/* 결과 메시지 */}
                <div className="p-4 bg-slate-100 rounded-lg">
                  {simulationResult.payoffYear ? (
                    <p className="text-sm">
                      매년 <strong className="text-blue-600">{formatCurrency(annualRepayment * 10000)}</strong>을 봉헌하면{' '}
                      <strong className="text-blue-600">{simulationResult.payoffYear}년</strong>에 대출을 완납합니다.
                      완납까지 발생하는 추가 이자는{' '}
                      <strong className="text-red-600">{formatCurrency(simulationResult.additionalInterest)}</strong>입니다.
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">
                      봉헌헌금이 연간 이자보다 적어 원금 상환이 불가능합니다. 봉헌헌금을 늘려주세요.
                    </p>
                  )}
                </div>

                {/* 빠른 선택 버튼 */}
                <div className="flex flex-wrap gap-2">
                  {[3000, 5000, 8000, 10000, 15000].map(v => (
                    <Button
                      key={v}
                      variant={annualRepayment === v ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAnnualRepayment(v)}
                    >
                      {formatCurrency(v * 10000)}/년
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 우리의 여정 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">건축 히스토리 (2003~현재)</CardTitle>
          <CardDescription>
            건축헌금 누적, 대출 상환, 대출 잔액의 변화 추이
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value % 5 === 0 || value === 2025 || value === 2026 ? value : ''}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}억`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Area
                type="monotone"
                dataKey="건축헌금누적"
                fill="#10b981"
                fillOpacity={0.2}
                stroke="#10b981"
                strokeWidth={2}
                name="건축헌금 누적"
              />

              <Area
                type="monotone"
                dataKey="원금상환"
                fill="#3b82f6"
                fillOpacity={0.2}
                stroke="#3b82f6"
                strokeWidth={2}
                name="원금 상환"
              />

              <Area
                type="monotone"
                dataKey="이자지출"
                fill="#ef4444"
                fillOpacity={0.2}
                stroke="#ef4444"
                strokeWidth={2}
                name="이자 지출"
              />

              <Line
                type="monotone"
                dataKey="대출잔액"
                stroke="#f59e0b"
                strokeWidth={3}
                name="대출 잔액"
                dot={{ r: 3 }}
              />

              <ReferenceLine x={2011} stroke="#6b7280" strokeDasharray="3 3" />
              <ReferenceLine x={2025} stroke="#f59e0b" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>

          <Timeline events={data.history} />
        </CardContent>
      </Card>
    </div>
  );
}
