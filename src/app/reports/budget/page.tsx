'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Percent,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  BarChart3,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface BudgetReportData {
  year: number;
  referenceDate: string;
  daysPassed: number;
  daysInYear: number;
  totalBudget: number;
  totalExecuted: number;
  executionRate: number;
  syncRate: number;
  overBudgetItems: Array<{
    code: number;
    name: string;
    syncRate: number;
  }>;
  categories: Array<{
    category_code: number;
    category_item: string;
    budget: number;
    executed: number;
    executionRate: number;
    syncRate: number;
    accounts: Array<{
      account_code: number;
      account_item: string;
      budgeted: number;
      executed: number;
      percentage: number;
      syncRate: number;
      remaining: number;
    }>;
  }>;
}

interface YearlyChartData {
  year: number;
  budget: number;
  executed: number;
  executionRate: number;
  syncRate: number;
}

interface Insight {
  type: 'danger' | 'warning' | 'info';
  message: string;
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
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}백만`;
  }
  return `${(amount / 10000).toFixed(0)}만`;
}

function formatFullCurrency(amount: number): string {
  return amount.toLocaleString() + '원';
}

function getStatus(syncRate: number): 'danger' | 'warning' | 'normal' {
  if (syncRate > 110) return 'danger';
  if (syncRate > 100) return 'warning';
  return 'normal';
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  title,
  value,
  icon,
  status
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  status?: 'danger' | 'warning' | 'normal';
}) {
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      status === 'danger' ? 'bg-red-50 border-red-200' :
      status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
      'bg-blue-50 border-blue-200'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className={cn(
          status === 'danger' ? 'text-red-600' :
          status === 'warning' ? 'text-yellow-600' :
          'text-blue-600'
        )}>
          {icon}
        </span>
      </div>
      <div className={cn(
        "text-2xl font-bold",
        status === 'danger' ? 'text-red-700' :
        status === 'warning' ? 'text-yellow-700' :
        'text-blue-700'
      )}>
        {value}
      </div>
    </div>
  );
}

function SubCategoryItem({ item }: { item: BudgetReportData['categories'][0]['accounts'][0] }) {
  return (
    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full",
          item.syncRate > 100 ? "bg-red-500" : "bg-blue-500"
        )} />
        <span>{item.account_item} ({item.account_code})</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-500 w-20 text-right">{formatCurrency(item.budgeted)}</span>
        <span className="font-semibold w-20 text-right">{formatCurrency(item.executed)}</span>
        <Badge variant={item.syncRate > 100 ? "destructive" : "secondary"} className="w-16 justify-center">
          {item.syncRate.toFixed(1)}%
        </Badge>
      </div>
    </div>
  );
}

function CategoryItem({
  category,
  isExpanded,
  onToggle
}: {
  category: BudgetReportData['categories'][0];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = getStatus(category.syncRate);

  return (
    <div className="border rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          <span className="font-semibold">{category.category_item} ({category.category_code})</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'danger' && <Badge variant="destructive">초과 경고</Badge>}
          {status === 'warning' && <Badge variant="outline" className="border-yellow-500 text-yellow-700">주의</Badge>}
          {status === 'normal' && <Badge variant="secondary">정상</Badge>}
        </div>
      </button>

      <div className="px-4 pb-2 grid grid-cols-4 gap-2 text-sm">
        <div>예산: <span className="font-semibold">{formatCurrency(category.budget)}</span></div>
        <div>집행: <span className="font-semibold">{formatCurrency(category.executed)}</span></div>
        <div>집행률: <span className="font-semibold">{category.executionRate.toFixed(1)}%</span></div>
        <div>동기: <span className={cn(
          "font-semibold",
          category.syncRate > 100 ? "text-red-600" : "text-blue-600"
        )}>{category.syncRate.toFixed(1)}%</span></div>
      </div>

      <div className="px-4 pb-2">
        <Progress
          value={Math.min(category.syncRate, 100)}
          className={cn("h-2", category.syncRate > 100 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500")}
        />
        {category.syncRate > 100 && (
          <div className="text-xs text-red-600 mt-1">
            동기예산 초과: +{formatFullCurrency(Math.round((category.syncRate - 100) * category.budget / 100))}
          </div>
        )}
      </div>

      {isExpanded && category.accounts.length > 0 && (
        <div className="px-4 pb-4 space-y-1">
          {category.accounts.map(item => (
            <SubCategoryItem key={item.account_code} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function BudgetExecutionPage() {
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<BudgetReportData | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyChartData[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([10, 20]));
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // 단일 연도 데이터 로드
  const loadYearData = async (year: number): Promise<BudgetReportData | null> => {
    try {
      const res = await fetch(`/api/reports/budget?year=${year}`);
      const data = await res.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to load ${year} data:`, error);
      return null;
    }
  };

  // 선택 연도 및 5개년 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 선택 연도 데이터
        const currentData = await loadYearData(selectedYear);
        setReportData(currentData);

        // 5개년 차트 데이터
        const chartDataPromises = availableYears.map(async (year) => {
          const data = await loadYearData(year);
          if (data) {
            return {
              year,
              budget: data.totalBudget,
              executed: data.totalExecuted,
              executionRate: data.executionRate,
              syncRate: data.syncRate,
            };
          }
          return { year, budget: 0, executed: 0, executionRate: 0, syncRate: 0 };
        });

        const chartData = await Promise.all(chartDataPromises);
        setYearlyData(chartData);
      } catch (error) {
        console.error('Load error:', error);
        toast.error('데이터를 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedYear]);

  // 인사이트 생성
  const insights = useMemo<Insight[]>(() => {
    if (!reportData) return [];

    const insights: Insight[] = [];

    // 위험 항목 (동기집행률 150% 초과)
    const dangerItems = reportData.overBudgetItems.filter(item => item.syncRate > 150);
    if (dangerItems.length > 0) {
      insights.push({
        type: 'danger',
        message: `${dangerItems[0].name}이(가) 동기집행률 ${dangerItems[0].syncRate.toFixed(1)}% → 즉시 예산 조정 필요`
      });
    }

    // 전년 대비 비교
    const prevYearData = yearlyData.find(d => d.year === selectedYear - 1);
    if (prevYearData && prevYearData.executed > 0) {
      const yoyRate = ((reportData.totalExecuted - prevYearData.executed) / prevYearData.executed) * 100;
      insights.push({
        type: yoyRate > 0 ? 'warning' : 'info',
        message: `전년 대비 총 집행액 ${yoyRate >= 0 ? '+' : ''}${yoyRate.toFixed(1)}% ${yoyRate > 0 ? '증가' : '감소'}${yoyRate < 0 ? ' (예산 절감 효과)' : ''}`
      });
    }

    // 사례비 증가 추세
    const salaryCategory = reportData.categories.find(c => c.category_code === 10);
    const prevSalaryData = yearlyData.find(d => d.year === selectedYear - 1);
    if (salaryCategory && prevSalaryData) {
      // 전년 사례비 데이터를 별도로 조회해야 하지만 간단히 처리
      if (salaryCategory.executed > salaryCategory.budget * 1.05) {
        insights.push({
          type: 'warning',
          message: `사례비 집행률 ${salaryCategory.executionRate.toFixed(1)}% → 예산 대비 초과 집행`
        });
      }
    }

    return insights;
  }, [reportData, yearlyData, selectedYear]);

  const handleToggleCategory = (code: number) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setExpandedCategories(newSet);
  };

  const toggleAll = () => {
    if (!reportData) return;
    if (expandedCategories.size === reportData.categories.length) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(reportData.categories.map(c => c.category_code)));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">예산 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p className="text-sm text-slate-500">예산 데이터가 없습니다.</p>
        <p className="text-xs text-slate-400">설정 {'>'} 예산 관리에서 예산을 등록해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">예산 및 집행현황</h1>
          <p className="text-sm text-slate-500 mt-1">
            5개년 예산 집행현황을 분석하고 동기집행률 기반으로 예산 초과 위험을 조기 발견합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Excel 다운로드
          </Button>
        </div>
      </div>

      {/* 연도별 요약 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {reportData.year}년 예산 집행 현황
            </CardTitle>
            <Badge variant="outline">
              기준일: {reportData.referenceDate} ({reportData.daysPassed}일 경과)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="총 예산"
              value={formatCurrency(reportData.totalBudget)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              title="총 집행"
              value={formatCurrency(reportData.totalExecuted)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="집행률"
              value={`${reportData.executionRate.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              status={reportData.executionRate > 100 ? 'warning' : 'normal'}
            />
            <StatCard
              title="동기집행률"
              value={`${reportData.syncRate.toFixed(1)}%`}
              icon={<AlertTriangle className="h-4 w-4" />}
              status={getStatus(reportData.syncRate)}
            />
          </div>

          {reportData.overBudgetItems.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>동기집행률 초과 항목: {reportData.overBudgetItems.length}개</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  {reportData.overBudgetItems.slice(0, 5).map(item => (
                    <span key={item.code} className="text-sm">
                      • {item.name} ({item.syncRate.toFixed(1)}%)
                    </span>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 5개년 추이 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>5개년 추이</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'chart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('chart')}
              >
                차트
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                테이블
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'chart' ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 120]} unit="%" />
                <Tooltip
                  formatter={(value, name) => {
                    const numValue = Number(value) || 0;
                    if (String(name).includes('률')) {
                      return `${numValue.toFixed(1)}%`;
                    }
                    return formatFullCurrency(numValue);
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="budget" fill="#94a3b8" name="예산" />
                <Bar yAxisId="left" dataKey="executed" fill="#3b82f6" name="집행액" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="executionRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="집행률 (%)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="syncRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="동기집행률 (%)"
                />
                <ReferenceLine
                  yAxisId="right"
                  y={100}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">연도</th>
                    <th className="text-right p-2">예산</th>
                    <th className="text-right p-2">집행</th>
                    <th className="text-right p-2">집행률</th>
                    <th className="text-right p-2">동기집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyData.map(row => (
                    <tr key={row.year} className="border-b">
                      <td className="p-2 font-medium">{row.year}년</td>
                      <td className="text-right p-2">{formatFullCurrency(row.budget)}</td>
                      <td className="text-right p-2">{formatFullCurrency(row.executed)}</td>
                      <td className="text-right p-2">{row.executionRate.toFixed(1)}%</td>
                      <td className={cn(
                        "text-right p-2 font-medium",
                        row.syncRate > 100 ? "text-red-600" : "text-blue-600"
                      )}>
                        {row.syncRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 분야별 상세 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>분야별 상세</CardTitle>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {expandedCategories.size === reportData.categories.length ? '전체 접기' : '전체 펼치기'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {reportData.categories.map(category => (
            <CategoryItem
              key={category.category_code}
              category={category}
              isExpanded={expandedCategories.has(category.category_code)}
              onToggle={() => handleToggleCategory(category.category_code)}
            />
          ))}
        </CardContent>
      </Card>

      {/* 인사이트 */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>인사이트</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={cn(
                    "mt-0.5",
                    insight.type === 'danger' ? "text-red-500" :
                    insight.type === 'warning' ? "text-yellow-500" :
                    "text-blue-500"
                  )}>
                    {insight.type === 'danger' ? '●' :
                     insight.type === 'warning' ? '▲' : '✓'}
                  </span>
                  <span className="text-sm">{insight.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
