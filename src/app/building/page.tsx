'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
  BarChart
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
  Calculator
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

      // Easing function for smooth animation
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

// 통계 카드
function StatCard({
  icon,
  label,
  value,
  detail,
  color,
  highlight = false,
  progress: progressValue
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  color: 'gray' | 'green' | 'blue' | 'teal' | 'orange';
  highlight?: boolean;
  progress?: number;
}) {
  const colorClasses = {
    gray: 'bg-slate-50 border-slate-200 text-slate-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  const iconColorClasses = {
    gray: 'text-slate-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
    teal: 'text-teal-500',
    orange: 'text-orange-500'
  };

  const valueColorClasses = {
    gray: 'text-slate-900',
    green: 'text-green-900',
    blue: 'text-blue-900',
    teal: 'text-teal-900',
    orange: 'text-orange-900'
  };

  return (
    <div className={cn(
      "p-4 md:p-6 rounded-xl border-2 transition-all",
      colorClasses[color],
      highlight && "ring-2 ring-green-400 ring-offset-2"
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className={cn("", iconColorClasses[color])}>
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-500">{detail}</span>
      </div>
      <div className={cn("text-2xl md:text-4xl font-bold mb-1", valueColorClasses[color])}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-sm font-medium text-slate-600">{label}</div>
      {progressValue !== undefined && (
        <div className="mt-3">
          <Progress value={progressValue} className="h-2" />
        </div>
      )}
    </div>
  );
}

// 타임라인
function Timeline({ events }: { events: BuildingHistory[] }) {
  const milestones = events.filter(e => e.milestone);

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
      {milestones.map((event, index) => (
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

// 상환 시뮬레이션 결과 타입
interface SimulationResult {
  year: number;
  yearlyPrincipal: number;
  yearlyInterest: number;
  balance: number;
  cumulativeInterest: number;
}

// ============================================================================
// Main Page
// ============================================================================

export default function BuildingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BuildingData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 시뮬레이션 입력값 (만원 단위)
  const [annualRepayment, setAnnualRepayment] = useState<number>(5000); // 기본값 5천만원

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

    const annualAmount = annualRepayment * 10000; // 만원 -> 원
    const rate = data.simulation.interestRate / 100; // % -> 소수
    let balance = data.simulation.currentLoanBalance;
    let cumulativeInterest = data.simulation.cumulativeInterestPaid;
    const currentYear = new Date().getFullYear();

    const results: SimulationResult[] = [];
    let year = currentYear;

    // 최대 30년까지 시뮬레이션
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

  // 풀스크린 상태 감지
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

  // 차트 데이터 변환 (억 단위로)
  const chartData = data.history.map(h => ({
    year: h.year,
    건축헌금누적: h.cumulativeDonation / 100000000,
    원금상환: h.principalPaid / 100000000,
    이자지출: h.interestPaid / 100000000,
    대출잔액: h.loanBalance / 100000000,
  }));

  // 최근 5년 차트 데이터 (원금/이자 분리)
  const recentChartData = data.recent.years.map(y => ({
    year: y.year,
    건축헌금: y.donation / 100000000,
    원금상환: y.principal / 100000000,
    이자지출: y.interest / 100000000,
  }));

  // 시뮬레이션 차트 데이터
  const simChartData = simulationResult?.results.map(r => ({
    year: r.year,
    원금상환: r.yearlyPrincipal / 100000000,
    이자: r.yearlyInterest / 100000000,
    잔액: r.balance / 100000000,
  })) || [];

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
            예봄교회 성전 건축 재정 현황
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            2003년 토지 매입부터 현재까지의 여정
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

      {/* 상단 통계 카드 5개 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <StatCard
          icon={<Building2 className="h-8 w-8 md:h-10 md:w-10" />}
          label="총 건축비"
          value={data.summary.totalCost}
          detail="토지+건물"
          color="gray"
        />
        <StatCard
          icon={<Heart className="h-8 w-8 md:h-10 md:w-10" />}
          label="성도 헌금"
          value={data.summary.totalDonation}
          detail={`${data.summary.donationRate}%`}
          color="green"
          highlight
          progress={data.summary.donationRate}
        />
        <StatCard
          icon={<CreditCard className="h-8 w-8 md:h-10 md:w-10" />}
          label="은행 대출"
          value={data.summary.totalLoan}
          detail="원금"
          color="blue"
        />
        <StatCard
          icon={<CheckCircle className="h-8 w-8 md:h-10 md:w-10" />}
          label="상환 완료"
          value={data.summary.principalPaid}
          detail={`${data.summary.repaymentRate}%`}
          color="teal"
          progress={data.summary.repaymentRate}
        />
        <StatCard
          icon={<AlertCircle className="h-8 w-8 md:h-10 md:w-10" />}
          label="남은 대출"
          value={data.summary.loanBalance}
          detail="상환 필요"
          color="orange"
        />
      </div>

      {/* 건축 히스토리 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            우리의 여정: 건축 히스토리 (2003~현재)
          </CardTitle>
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

              {/* 건축헌금 누적 (영역 차트 - 초록) */}
              <Area
                type="monotone"
                dataKey="건축헌금누적"
                fill="#10b981"
                fillOpacity={0.2}
                stroke="#10b981"
                strokeWidth={2}
                name="건축헌금 누적"
              />

              {/* 원금 상환 (영역 차트 - 파랑) */}
              <Area
                type="monotone"
                dataKey="원금상환"
                fill="#3b82f6"
                fillOpacity={0.2}
                stroke="#3b82f6"
                strokeWidth={2}
                name="원금 상환"
              />

              {/* 이자 지출 (영역 차트 - 빨강) */}
              <Area
                type="monotone"
                dataKey="이자지출"
                fill="#ef4444"
                fillOpacity={0.2}
                stroke="#ef4444"
                strokeWidth={2}
                name="이자 지출"
              />

              {/* 대출 잔액 (라인 차트 - 주황) */}
              <Line
                type="monotone"
                dataKey="대출잔액"
                stroke="#f59e0b"
                strokeWidth={3}
                name="대출 잔액"
                dot={{ r: 3 }}
              />

              {/* 주요 마일스톤 */}
              <ReferenceLine x={2011} stroke="#6b7280" strokeDasharray="3 3" />
              <ReferenceLine x={2025} stroke="#f59e0b" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 타임라인 */}
          <Timeline events={data.history} />
        </CardContent>
      </Card>

      {/* 하단 2열 */}
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

            {/* 요약 통계 (원금/이자 분리) */}
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

        {/* 상환 시뮬레이션 도구 */}
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
            {/* 입력 */}
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

            {/* 시뮬레이션 결과 */}
            {simulationResult && (
              <>
                {/* 결과 요약 */}
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

                {/* 시뮬레이션 차트 */}
                {simChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={simChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${v}`}
                      />
                      <YAxis tickFormatter={(value) => `${value}억`} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="원금상환" fill="#3b82f6" name="원금상환" stackId="a" />
                      <Bar dataKey="이자" fill="#ef4444" name="이자" stackId="a" />
                      <Line
                        type="monotone"
                        dataKey="잔액"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="잔액"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* 안내 메시지 */}
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
