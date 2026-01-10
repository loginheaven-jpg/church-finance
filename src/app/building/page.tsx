'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Building2,
  Heart,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Calculator,
  TrendingDown,
  Zap,
  DollarSign,
  Clock,
  ArrowRight,
  Target,
  Users
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

interface Scenario {
  name: string;
  years: number;
  monthlyPayment: number;
  futureInterest: number;
  totalInterest: number;
  saving: number;
  highlight: boolean;
}

interface RealTimeInterest {
  perSecond: number;
  perDay: number;
  perMonth: number;
  perYear: number;
}

interface ChallengeData {
  currentMonthlyDonation: number;
  targetMonthlyPayment: number;
  additionalNeeded: number;
  saving: number;
  perPersonByCount: {
    50: number;
    100: number;
    150: number;
    200: number;
  };
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
  scenarios: Scenario[];
  realTimeInterest: RealTimeInterest;
  challenge: ChallengeData;
}

// ============================================================================
// Utils
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
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

// 애니메이션 숫자 카운트업
function AnimatedNumber({
  value,
  suffix = '',
  duration = 2000
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <span>
      {formatCurrency(displayValue)}{suffix}
    </span>
  );
}

// 실시간 이자 카운터 Hook
function useRealTimeInterestCounter(baseData: RealTimeInterest | null) {
  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!baseData) return null;

  const now = new Date(time);
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dayOfMonth = now.getDate();
  const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  return {
    perSecond: baseData.perSecond,
    today: Math.round(baseData.perSecond * secondsToday),
    thisMonth: Math.round(baseData.perDay * dayOfMonth),
    thisYear: Math.round(baseData.perDay * dayOfYear),
    dailyAvg: Math.round(baseData.perDay),
    monthlyAvg: Math.round(baseData.perMonth),
  };
}

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

  // 실시간 이자 카운터
  const realTimeCounter = useRealTimeInterestCounter(data?.realTimeInterest || null);

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

    while (balance > 0 && year < currentYear + 30) {
      const yearlyInterest = Math.round(balance * rate);
      const yearlyPrincipal = Math.min(annualAmount, balance);
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

  // 10년 완납 시나리오
  const tenYearScenario = data.scenarios?.find(s => s.years === 10);
  const currentScenario = data.scenarios?.find(s => s.name === '현재 속도');

  // 차트 데이터
  const chartData = data.history.map(h => ({
    year: h.year,
    건축헌금누적: h.cumulativeDonation / 100000000,
    원금상환: h.principalPaid / 100000000,
    이자지출: h.interestPaid / 100000000,
    대출잔액: h.loanBalance / 100000000,
  }));

  const recentChartData = data.recent.years.map(y => ({
    year: y.year,
    건축헌금: y.donation / 100000000,
    원금상환: y.principal / 100000000,
    이자지출: y.interest / 100000000,
  }));

  // 시나리오 차트 데이터
  const scenarioChartData = data.scenarios?.map(s => ({
    name: s.name,
    완납기간: s.years,
    월상환액: s.monthlyPayment / 10000,
    향후이자: s.futureInterest / 100000000,
    이자절감: s.saving / 100000000,
    highlight: s.highlight,
  })) || [];

  // 과거 돈의 흐름 (이자 vs 원금)
  const pastFlowData = [
    { name: '이자 지출', value: data.summary.interestPaid / 100000000, fill: '#ef4444' },
    { name: '원금 상환', value: data.summary.principalPaid / 100000000, fill: '#3b82f6' },
  ];

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
            10년 완납 챌린지
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            빚 없는 교회를 향한 우리의 여정
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

      {/* A. 히어로 섹션 - 4대 핵심 지표 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 지표 1: 남은 부채 */}
        <Card className="border-2 border-red-500 bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              남은 부채
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl md:text-5xl font-bold text-red-600 mb-2">
              <AnimatedNumber value={data.summary.loanBalance} />
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {data.summary.loanBalance.toLocaleString()}원
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <Badge variant="outline" className="text-green-600 border-green-300">
                {formatCurrency(data.summary.principalPaid)} 상환 완료
              </Badge>
            </div>
            <Progress value={data.summary.repaymentRate} className="h-2" />
            <p className="text-xs text-center mt-1 text-muted-foreground">
              원금 상환률 {data.summary.repaymentRate}%
            </p>
          </CardContent>
        </Card>

        {/* 지표 2: 총 이자 비용 */}
        <Card className="border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              총 이자 비용
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl md:text-5xl font-bold text-orange-600 mb-2">
              {((data.summary.interestPaid + (currentScenario?.futureInterest || 0)) / 100000000).toFixed(1)}억
            </div>
            <div className="text-xs space-y-1 mb-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">과거 지출</span>
                <span className="font-semibold">{formatCurrency(data.summary.interestPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">향후 예상</span>
                <span className="font-semibold text-orange-600">{formatCurrency(currentScenario?.futureInterest || 0)}</span>
              </div>
            </div>
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">
                현재 속도면 {currentScenario?.years || 17}년 더 걸림
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 지표 3: 10년 완납 목표 */}
        <Card className="border-4 border-blue-600 bg-gradient-to-br from-blue-50 via-white to-blue-50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-700 flex items-center gap-2 font-bold">
              <Zap className="h-5 w-5 text-blue-600 animate-pulse" />
              10년 완납 목표
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">월 상환 필요액</p>
              <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-1">
                {Math.round((tenYearScenario?.monthlyPayment || 0) / 10000)}만
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {(tenYearScenario?.monthlyPayment || 0).toLocaleString()}원/월
              </div>

              <div className="bg-blue-100 rounded-lg p-3 mb-2">
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  추가 필요: 월 {Math.round((data.challenge?.additionalNeeded || 0) / 10000)}만원
                </p>
                <p className="text-xl font-bold text-blue-700">
                  100명 × {Math.round((data.challenge?.perPersonByCount?.[100] || 0) / 10000)}만원
                </p>
              </div>

              <Badge className="bg-blue-600 text-white w-full justify-center py-1">
                달성 가능!
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 지표 4: 이자 절감 */}
        <Card className="border-2 border-green-500 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              이자 절감
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">10년 완납 시</p>
              <div className="text-4xl md:text-5xl font-bold text-green-600 mb-2">
                {((tenYearScenario?.saving || 0) / 100000000).toFixed(1)}억
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {(tenYearScenario?.saving || 0).toLocaleString()}원 절약
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">현재 속도 이자</span>
                  <span className="font-semibold line-through text-red-500">
                    {formatCurrency(currentScenario?.futureInterest || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">10년 완납 이자</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(tenYearScenario?.futureInterest || 0)}
                  </span>
                </div>
              </div>

              <Alert className="mt-3 py-2 bg-green-50 border-green-300">
                <AlertDescription className="text-xs text-green-900 font-semibold">
                  선교/교육에 투자 가능!
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* B. 실시간 이자 카운터 */}
      {realTimeCounter && (
        <Card className="border-2 border-red-400 bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Clock className="h-5 w-5 animate-pulse" />
              지금 이 순간에도 이자가 발생하고 있습니다
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border-2 border-red-300">
                <p className="text-xs text-muted-foreground mb-1">1초당</p>
                <div className="text-2xl md:text-3xl font-bold text-red-600 font-mono">
                  {realTimeCounter.perSecond.toFixed(2)}원
                </div>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border-2 border-orange-300">
                <p className="text-xs text-muted-foreground mb-1">오늘 누적</p>
                <div className="text-2xl md:text-3xl font-bold text-orange-600 font-mono">
                  {realTimeCounter.today.toLocaleString()}원
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  평균 {Math.round(realTimeCounter.dailyAvg / 10000)}만원/일
                </p>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border-2 border-amber-300">
                <p className="text-xs text-muted-foreground mb-1">이번 달 누적</p>
                <div className="text-2xl md:text-3xl font-bold text-amber-600 font-mono">
                  {realTimeCounter.thisMonth.toLocaleString()}원
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  평균 {Math.round(realTimeCounter.monthlyAvg / 10000)}만원/월
                </p>
              </div>

              <div className="text-center p-4 bg-white rounded-lg border-2 border-yellow-300">
                <p className="text-xs text-muted-foreground mb-1">올해 누적</p>
                <div className="text-2xl md:text-3xl font-bold text-yellow-700 font-mono">
                  {realTimeCounter.thisYear.toLocaleString()}원
                </div>
              </div>
            </div>

            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-center font-semibold">
                <span className="text-lg">하루 {Math.round(realTimeCounter.dailyAvg / 10000)}만원, 한 달 {Math.round(realTimeCounter.monthlyAvg / 10000)}만원</span>의 이자가 계속 발생합니다.
                빠른 상환만이 이자 출혈을 막는 유일한 방법입니다!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* C. 돈의 흐름 시각화 (과거 + 미래 선택지) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            우리의 선택이 미래를 바꿉니다
          </CardTitle>
          <CardDescription>
            과거의 손실과 미래의 기회
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 과거: 이자 vs 원금 */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                과거 14년 (2012~2025)
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="font-medium">이자 지출 (허공으로)</span>
                      <span className="font-bold text-red-600">{formatCurrency(data.summary.interestPaid)}</span>
                    </div>
                    <div className="h-10 bg-red-500 rounded flex items-center justify-center text-white font-bold text-sm">
                      {data.summary.interestPaid.toLocaleString()}원
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="font-medium">원금 상환 (부채 감소)</span>
                      <span className="font-bold text-blue-600">{formatCurrency(data.summary.principalPaid)}</span>
                    </div>
                    <div
                      className="h-10 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-sm"
                      style={{ width: `${(data.summary.principalPaid / (data.summary.principalPaid + data.summary.interestPaid)) * 100}%` }}
                    >
                      {data.summary.principalPaid.toLocaleString()}원
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pastFlowData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${value.toFixed(1)}억`}
                      >
                        {pastFlowData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Alert variant="destructive" className="w-full">
                    <AlertDescription className="text-xs text-center">
                      갚은 돈 {formatCurrency(data.summary.principalPaid + data.summary.interestPaid)} 중<br />
                      <strong>{Math.round(data.summary.interestPaid / (data.summary.principalPaid + data.summary.interestPaid) * 100)}%가 이자</strong>
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>

            <Separator />

            {/* 미래: 선택지 */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                미래 선택지 (남은 부채 {formatCurrency(data.summary.loanBalance)})
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                {/* 선택 1: 현재 속도 */}
                <Card className="border-2 border-orange-300 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      현재 속도 유지
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">완납까지</p>
                      <p className="text-3xl font-bold text-orange-600">{currentScenario?.years || 17}년</p>
                      <p className="text-xs text-muted-foreground">{new Date().getFullYear() + (currentScenario?.years || 17)}년</p>
                    </div>

                    <Separator />

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>향후 이자</span>
                        <span className="font-bold text-red-600">{formatCurrency(currentScenario?.futureInterest || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>총 이자</span>
                        <span className="font-bold text-red-600">{formatCurrency(currentScenario?.totalInterest || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 선택 2: 10년 완납 */}
                <Card className="border-4 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-600 animate-pulse" />
                      10년 완납 챌린지
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">완납까지</p>
                      <p className="text-3xl font-bold text-green-600">10년</p>
                      <p className="text-xs text-muted-foreground">{new Date().getFullYear() + 10}년</p>
                    </div>

                    <Separator />

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>향후 이자</span>
                        <span className="font-bold text-green-600">{formatCurrency(tenYearScenario?.futureInterest || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>총 이자</span>
                        <span className="font-bold text-green-700">{formatCurrency(tenYearScenario?.totalInterest || 0)}</span>
                      </div>
                    </div>

                    <Alert className="py-2 bg-green-100 border-green-400">
                      <AlertDescription className="text-xs text-green-900">
                        <strong className="text-lg">{formatCurrency(tenYearScenario?.saving || 0)} 절감!</strong>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* D. 5개 시나리오 비교 */}
      {data.scenarios && data.scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">시나리오별 완납 비교</CardTitle>
            <CardDescription>
              상환 기간별 이자 절감 효과 (이자율 {data.simulation.interestRate}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">시나리오</th>
                    <th className="text-right py-2">월 상환</th>
                    <th className="text-right py-2">완납 시기</th>
                    <th className="text-right py-2">향후 이자</th>
                    <th className="text-right py-2">절감액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scenarios.map((scenario, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b",
                        scenario.highlight && "bg-blue-50 font-bold"
                      )}
                    >
                      <td className="py-3">
                        {scenario.highlight && <Zap className="inline h-4 w-4 text-blue-600 mr-1" />}
                        {scenario.name}
                      </td>
                      <td className="text-right">{Math.round(scenario.monthlyPayment / 10000)}만원</td>
                      <td className="text-right">{scenario.years}년 ({new Date().getFullYear() + scenario.years})</td>
                      <td className={cn(
                        "text-right",
                        scenario.highlight ? "text-green-600" : "text-orange-600"
                      )}>
                        {formatCurrency(scenario.futureInterest)}
                      </td>
                      <td className="text-right text-green-600">
                        {scenario.saving > 0 ? `${formatCurrency(scenario.saving)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 타임라인 시각화 */}
            <div className="mt-6 space-y-2">
              {data.scenarios.map((scenario, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-right">{scenario.name}</span>
                  <div
                    className={cn(
                      "h-6 rounded flex items-center justify-center text-white text-xs font-bold transition-all",
                      scenario.highlight ? "bg-blue-600" : "bg-slate-400"
                    )}
                    style={{ width: `${(scenario.years / 17) * 100}%`, minWidth: '60px' }}
                  >
                    {scenario.years}년
                  </div>
                  {scenario.highlight && (
                    <Badge className="bg-green-600">목표</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* E. 10년 완납 챌린지 CTA */}
      {data.challenge && (
        <Card className="border-4 border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              10년의 기적, 우리가 만듭니다
            </CardTitle>
            <CardDescription>
              함께하면 빚 없는 교회를 만들 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">현재 건축헌금</p>
                <p className="text-2xl font-bold text-slate-700">월 {Math.round(data.challenge.currentMonthlyDonation / 10000)}만원</p>
              </div>
              <div className="p-4 bg-blue-100 rounded-lg border-2 border-blue-400">
                <p className="text-xs text-blue-700 font-semibold">10년 목표</p>
                <p className="text-2xl font-bold text-blue-700">월 {Math.round(data.challenge.targetMonthlyPayment / 10000)}만원</p>
              </div>
              <div className="p-4 bg-white rounded-lg border">
                <p className="text-xs text-muted-foreground">추가 필요</p>
                <p className="text-2xl font-bold text-orange-600">월 {Math.round(data.challenge.additionalNeeded / 10000)}만원</p>
              </div>
            </div>

            <Card className="bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  참여 인원별 1인당 월 헌금
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(data.challenge.perPersonByCount).map(([count, amount]) => (
                    <div
                      key={count}
                      className={cn(
                        "p-3 rounded-lg text-center border",
                        count === '100' ? "bg-blue-100 border-blue-400" : "bg-white"
                      )}
                    >
                      <p className="text-xs text-muted-foreground">{count}명</p>
                      <p className={cn(
                        "text-lg font-bold",
                        count === '100' ? "text-blue-700" : "text-slate-700"
                      )}>
                        {Math.round(amount / 10000)}만원
                      </p>
                      {count === '100' && <Badge className="mt-1 text-xs">추천</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Alert className="bg-blue-50 border-blue-300">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">100명이 매월 {Math.round(data.challenge.perPersonByCount[100] / 10000)}만원씩 더 헌금하면,</AlertTitle>
              <AlertDescription className="text-blue-700">
                상환 기간이 {currentScenario?.years || 17}년 → 10년으로 단축되고,
                총 <strong>{formatCurrency(tenYearScenario?.saving || 0)}</strong>의 이자를 절약할 수 있습니다!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* F. 우리의 여정 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">우리의 여정: 건축 히스토리 (2003~현재)</CardTitle>
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

      {/* G. 최근 5년 실적 + 시뮬레이션 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 최근 5년 실적 분석 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              최근 5년 실적 분석 ({data.recent.years[0]?.year}-{data.recent.years[data.recent.years.length - 1]?.year})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={recentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `${value}억`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="건축헌금" fill="#10b981" name="건축헌금" />
                <Bar dataKey="원금상환" fill="#3b82f6" name="원금상환" />
                <Bar dataKey="이자지출" fill="#ef4444" name="이자지출" />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="p-2 bg-green-50 rounded-lg border border-green-200 text-center">
                <div className="text-xs text-green-700">건축헌금</div>
                <div className="text-base font-bold text-green-900">
                  {formatCurrency(data.recent.totalDonation)}
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <div className="text-xs text-blue-700">원금상환</div>
                <div className="text-base font-bold text-blue-900">
                  {formatCurrency(data.recent.totalPrincipal)}
                </div>
              </div>
              <div className="p-2 bg-red-50 rounded-lg border border-red-200 text-center">
                <div className="text-xs text-red-700">이자지출</div>
                <div className="text-base font-bold text-red-900">
                  {formatCurrency(data.recent.totalInterest)}
                </div>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg border border-orange-200 text-center">
                <div className="text-xs text-orange-700">부족분</div>
                <div className="text-base font-bold text-orange-900">
                  {formatCurrency(data.recent.shortage)}
                </div>
              </div>
            </div>

            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>참고</AlertTitle>
              <AlertDescription className="text-sm">
                최근 5년간 건축헌금만으로는 대출 상환이 불가능했습니다.
                부족분 {formatCurrency(data.recent.shortage)}은 교회 일반 재정으로 충당되었습니다.
              </AlertDescription>
            </Alert>
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
              연간 상환 금액에 따른 완납 시점 및 이자 부담 계산 (이자율: {data.simulation.interestRate}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="annualRepayment" className="text-sm font-medium">
                연간 원금 상환액 (만원)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="annualRepayment"
                  type="number"
                  value={annualRepayment}
                  onChange={(e) => setAnnualRepayment(Math.max(100, Number(e.target.value) || 0))}
                  className="w-32"
                  min={100}
                  step={100}
                />
                <span className="text-sm text-slate-500">
                  = 월 {formatCurrency(annualRepayment * 10000 / 12)}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {[3000, 5000, 7000, 10000].map(v => (
                  <Button
                    key={v}
                    variant={annualRepayment === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnnualRepayment(v)}
                  >
                    {v >= 10000 ? `${v/10000}억` : `${v/100}백만`}
                  </Button>
                ))}
              </div>
            </div>

            {simulationResult && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-200 text-center">
                    <div className="text-xs text-blue-700">예상 완납 시점</div>
                    <div className="text-xl font-bold text-blue-900">
                      {simulationResult.payoffYear
                        ? `${simulationResult.payoffYear}년`
                        : '30년 이상'}
                    </div>
                    {simulationResult.payoffYear && (
                      <div className="text-xs text-slate-500">
                        {simulationResult.payoffYear - new Date().getFullYear()}년 후
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-red-200 text-center">
                    <div className="text-xs text-red-700">추가 이자 부담</div>
                    <div className="text-xl font-bold text-red-900">
                      {formatCurrency(simulationResult.additionalInterest)}
                    </div>
                    <div className="text-xs text-slate-500">
                      누적 이자: {formatCurrency(simulationResult.totalInterestPaid)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-slate-100 rounded-lg">
                  <p className="text-xs text-slate-600">
                    {simulationResult.payoffYear ? (
                      <>
                        매년 <strong>{formatCurrency(annualRepayment * 10000)}</strong>씩 원금을 상환하면{' '}
                        <strong className="text-blue-600">{simulationResult.payoffYear}년</strong>에 대출을 완납할 수 있습니다.
                        이 경우 완납까지 추가로 발생하는 이자는{' '}
                        <strong className="text-red-600">{formatCurrency(simulationResult.additionalInterest)}</strong>입니다.
                      </>
                    ) : (
                      <>
                        연간 상환액이 너무 적어 30년 내 완납이 어렵습니다. 상환액을 늘려보세요.
                      </>
                    )}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
