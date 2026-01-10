'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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
  ArrowDown,
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
  target: {
    remainingLoan: number;
    targetYear: number;
    yearsRemaining: number;
    annualRequired: number;
    monthlyRequired: number;
    scenarios: Array<{
      households: number;
      amountPerMonth: number;
      total: number;
    }>;
  };
  projection: {
    avgPrincipalPerYear: number;
    avgInterestPerYear: number;
    projectedPayoffYear: number;
    targetYear: number;
    yearsToPayoff: number;
    requiredAnnualPrincipal: number;
    additionalRequired: number;
    projectedTotalInterest: number;
    insights: string[];
  };
}

// ============================================================================
// Utils
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}천만`;
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

// 참여 시나리오 옵션
function ParticipationOption({
  households,
  amount,
  total
}: {
  households: number;
  amount: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-blue-500" />
        <span className="font-semibold">{households}가정</span>
      </div>
      <div className="text-sm">
        월 <span className="font-semibold text-blue-600">{formatCurrency(amount)}</span>
      </div>
      <div className="text-sm text-slate-500">
        = {formatCurrency(total)}/월
      </div>
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

// ============================================================================
// Main Page
// ============================================================================

export default function BuildingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BuildingData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
            2003년 토지 매입부터 2030년 완전 봉헌까지의 여정
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
          detail="목표까지"
          color="orange"
        />
      </div>

      {/* 건축 히스토리 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            우리의 여정: 건축 히스토리 (2003~2030)
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
              <ReferenceLine x={2030} stroke="#10b981" strokeWidth={2} />
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
              최근 5년 실적 분석 (2020-2024)
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

            {/* 인사이트 */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-2">분석</div>
              <ul className="space-y-1 text-xs text-slate-600">
                {data.projection.insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={cn(
                      "mt-0.5",
                      idx === 0 ? "text-blue-500" : idx === 1 ? "text-orange-500" : "text-red-500"
                    )}>
                      {idx === 0 ? '📍' : idx === 1 ? '🎯' : '💰'}
                    </span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>긴급 상황</AlertTitle>
              <AlertDescription className="text-sm">
                최근 5년간 건축헌금만으로는 대출 상환이 불가능했습니다.
                부족분 {formatCurrency(data.recent.shortage)}은 교회 일반 재정으로 충당되었습니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* 5개년 목표 */}
        <Card className="bg-gradient-to-br from-blue-50 to-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              5개년 목표 (2026-2030)
            </CardTitle>
            <CardDescription>
              성전 봉헌 완성을 위한 5년 집중 헌신
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 목표 요약 */}
            <div className="mb-4 p-4 bg-white rounded-lg shadow-sm border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-600">현재 대출 잔액</span>
                <span className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.target.remainingLoan)}
                </span>
              </div>
              <div className="flex items-center justify-center my-2">
                <ArrowDown className="w-6 h-6 text-slate-400 animate-bounce" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">2030년 목표</span>
                <span className="text-2xl font-bold text-green-600">0억</span>
              </div>
            </div>

            {/* 필요 금액 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg text-center">
                <div className="text-xs text-blue-700">연간 필요액</div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(data.target.annualRequired)}
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-lg text-center">
                <div className="text-xs text-green-700">월간 필요액</div>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(data.target.monthlyRequired)}
                </div>
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="space-y-2 mb-4">
              {[2026, 2027, 2028, 2029, 2030].map((year, index) => {
                const currentYear = new Date().getFullYear();
                const isCurrentYear = year === currentYear;
                const isPast = year < currentYear;
                return (
                  <div key={year} className="flex items-center gap-2">
                    <span className={cn(
                      "w-12 text-sm font-semibold",
                      isCurrentYear && "text-blue-600"
                    )}>{year}</span>
                    <div className="flex-1">
                      <Progress
                        value={isPast ? 100 : isCurrentYear ? 5 : 0}
                        className="h-4"
                      />
                    </div>
                    <span className="w-16 text-xs text-right">
                      {((index + 1) * 20)}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 참여 방법 */}
            <div className="p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg">
              <h4 className="text-sm font-bold mb-3 text-center">우리의 참여 방법</h4>
              <div className="space-y-2">
                {data.target.scenarios.map((scenario, index) => (
                  <ParticipationOption
                    key={index}
                    households={scenario.households}
                    amount={scenario.amountPerMonth}
                    total={scenario.total}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
