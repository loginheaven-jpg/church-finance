'use client';

import { useState, useMemo } from 'react';
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
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface BudgetSummary {
  year: number;
  referenceDate: string;
  daysPassed: number;
  totalBudget: number;
  totalExecuted: number;
  executionRate: number;
  syncRate: number;
  overBudgetItems: OverBudgetItem[];
}

interface OverBudgetItem {
  code: string;
  name: string;
  syncRate: number;
}

interface YearlyData {
  year: number;
  budget: number;
  executed: number;
  executionRate: number;
  syncRate: number;
}

interface CategoryData {
  code: number;
  name: string;
  budget: number;
  executed: number;
  executionRate: number;
  syncRate: number;
  items: SubCategoryData[];
}

interface SubCategoryData {
  code: string;
  name: string;
  budget: number;
  executed: number;
  syncRate: number;
  previousYearExecuted?: number;
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

function calculateSyncRate(executed: number, budget: number, daysPassed: number): number {
  const syncBudget = (budget / 365) * daysPassed;
  return syncBudget > 0 ? (executed / syncBudget) * 100 : 0;
}

// ============================================================================
// 5개년 데이터 (xlsx에서 추출)
// ============================================================================

const YEARLY_DATA: Record<number, {
  referenceDate: string;
  daysPassed: number;
  categories: CategoryData[];
}> = {
  2021: {
    referenceDate: '2021-12-31',
    daysPassed: 365,
    categories: [
      { code: 10, name: '사례비', budget: 72706080, executed: 72706080, executionRate: 100, syncRate: 100, items: [
        { code: '11', name: '교역자사례', budget: 67200000, executed: 67200000, syncRate: 100 },
        { code: '13', name: '기타수당', budget: 5506080, executed: 5506080, syncRate: 100 },
      ]},
      { code: 20, name: '예배비', budget: 6580000, executed: 6580000, executionRate: 100, syncRate: 100, items: [
        { code: '21', name: '예배환경비', budget: 1600000, executed: 1600000, syncRate: 100 },
        { code: '23', name: '찬양대', budget: 4800000, executed: 4800000, syncRate: 100 },
      ]},
      { code: 30, name: '선교비', budget: 22080000, executed: 22080000, executionRate: 100, syncRate: 100, items: [
        { code: '31', name: '전도비', budget: 4880000, executed: 4880000, syncRate: 100 },
        { code: '32', name: '선교보고비', budget: 1600000, executed: 1600000, syncRate: 100 },
        { code: '33', name: '선교후원비', budget: 15600000, executed: 15600000, syncRate: 100 },
      ]},
      { code: 40, name: '교육비', budget: 69500000, executed: 69500000, executionRate: 100, syncRate: 100, items: [] },
      { code: 50, name: '봉사비', budget: 5500000, executed: 5500000, executionRate: 100, syncRate: 100, items: [] },
      { code: 60, name: '관리비', budget: 80000000, executed: 80000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 70, name: '운영비', budget: 8000000, executed: 8000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 80, name: '상회비', budget: 6000000, executed: 6000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 90, name: '기타비용', budget: 10000000, executed: 10000000, executionRate: 100, syncRate: 100, items: [] },
    ]
  },
  2022: {
    referenceDate: '2022-12-31',
    daysPassed: 365,
    categories: [
      { code: 10, name: '사례비', budget: 85000000, executed: 85000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 20, name: '예배비', budget: 8000000, executed: 8000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 30, name: '선교비', budget: 25000000, executed: 25000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 40, name: '교육비', budget: 75000000, executed: 75000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 50, name: '봉사비', budget: 6000000, executed: 6000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 60, name: '관리비', budget: 85000000, executed: 85000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 70, name: '운영비', budget: 9000000, executed: 9000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 80, name: '상회비', budget: 6200000, executed: 6200000, executionRate: 100, syncRate: 100, items: [] },
      { code: 90, name: '기타비용', budget: 10000000, executed: 10000000, executionRate: 100, syncRate: 100, items: [] },
    ]
  },
  2023: {
    referenceDate: '2023-12-31',
    daysPassed: 365,
    categories: [
      { code: 10, name: '사례비', budget: 115420000, executed: 114998110, executionRate: 99.6, syncRate: 99.6, items: [
        { code: '11', name: '교역자사례', budget: 106720000, executed: 103452260, syncRate: 96.9 },
        { code: '13', name: '기타수당', budget: 8200000, executed: 8800000, syncRate: 107.3 },
        { code: '14', name: '중식대', budget: 500000, executed: 2745850, syncRate: 549.2 },
      ]},
      { code: 20, name: '예배비', budget: 20200000, executed: 35940260, executionRate: 177.9, syncRate: 177.9, items: [
        { code: '21', name: '예배환경비', budget: 14000000, executed: 29678090, syncRate: 211.9 },
        { code: '23', name: '찬양대', budget: 6200000, executed: 6262170, syncRate: 101.0 },
      ]},
      { code: 30, name: '선교비', budget: 44200000, executed: 42327270, executionRate: 95.8, syncRate: 95.8, items: [
        { code: '31', name: '전도비', budget: 4000000, executed: 3236650, syncRate: 80.9 },
        { code: '32', name: '선교보고비', budget: 1000000, executed: 1307220, syncRate: 130.7 },
        { code: '33', name: '선교후원비', budget: 39200000, executed: 37783400, syncRate: 96.4 },
      ]},
      { code: 40, name: '교육비', budget: 95590000, executed: 66490015, executionRate: 69.6, syncRate: 69.6, items: [
        { code: '41', name: '교육훈련비', budget: 20000000, executed: 12251995, syncRate: 61.3 },
        { code: '42', name: '어린이부', budget: 7900000, executed: 7336670, syncRate: 92.9 },
        { code: '43', name: '청소년부', budget: 3980000, executed: 3356250, syncRate: 84.3 },
        { code: '44', name: '청년부', budget: 7110000, executed: 6811246, syncRate: 95.8 },
        { code: '46', name: '행사비', budget: 15000000, executed: 5333750, syncRate: 35.6 },
        { code: '47', name: '친교비', budget: 16000000, executed: 12419144, syncRate: 77.6 },
        { code: '48', name: '도서비', budget: 5000000, executed: 1644660, syncRate: 32.9 },
        { code: '49', name: '장학금', budget: 20000000, executed: 17336300, syncRate: 86.7 },
      ]},
      { code: 50, name: '봉사비', budget: 7650000, executed: 6815000, executionRate: 89.1, syncRate: 89.1, items: [] },
      { code: 60, name: '관리비', budget: 95000000, executed: 95000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 70, name: '운영비', budget: 10000000, executed: 10000000, executionRate: 100, syncRate: 100, items: [] },
      { code: 80, name: '상회비', budget: 6450000, executed: 6450000, executionRate: 100, syncRate: 100, items: [] },
      { code: 90, name: '기타비용', budget: 10000000, executed: 10000000, executionRate: 100, syncRate: 100, items: [] },
    ]
  },
  2024: {
    referenceDate: '2024-12-31',
    daysPassed: 366,
    categories: [
      { code: 10, name: '사례비', budget: 118600000, executed: 122176330, executionRate: 103.0, syncRate: 103.0, items: [
        { code: '11', name: '교역자사례', budget: 106600000, executed: 108815430, syncRate: 102.1, previousYearExecuted: 103452260 },
        { code: '13', name: '기타수당', budget: 9000000, executed: 8531000, syncRate: 94.8, previousYearExecuted: 8800000 },
        { code: '14', name: '중식대', budget: 3000000, executed: 4829900, syncRate: 161.0, previousYearExecuted: 2745850 },
      ]},
      { code: 20, name: '예배비', budget: 36500000, executed: 11381590, executionRate: 31.2, syncRate: 31.2, items: [
        { code: '21', name: '예배환경비', budget: 30000000, executed: 4622180, syncRate: 15.4, previousYearExecuted: 29678090 },
        { code: '23', name: '찬양대', budget: 6500000, executed: 6759410, syncRate: 104.0, previousYearExecuted: 6262170 },
      ]},
      { code: 30, name: '선교비', budget: 49600000, executed: 31642970, executionRate: 63.8, syncRate: 63.8, items: [
        { code: '31', name: '전도비', budget: 2500000, executed: 936270, syncRate: 37.5, previousYearExecuted: 3236650 },
        { code: '32', name: '선교보고비', budget: 1700000, executed: 800000, syncRate: 47.1, previousYearExecuted: 1307220 },
        { code: '33', name: '선교후원비', budget: 45400000, executed: 29906700, syncRate: 65.9, previousYearExecuted: 37783400 },
      ]},
      { code: 40, name: '교육비', budget: 92960000, executed: 81751122, executionRate: 87.9, syncRate: 87.9, items: [
        { code: '41', name: '교육훈련비', budget: 26000000, executed: 9312810, syncRate: 35.8, previousYearExecuted: 12251995 },
        { code: '42', name: '어린이부', budget: 7500000, executed: 8773610, syncRate: 117.0, previousYearExecuted: 7336670 },
        { code: '43', name: '청소년부', budget: 5800000, executed: 3364940, syncRate: 58.0, previousYearExecuted: 3356250 },
        { code: '44', name: '청년부', budget: 7960000, executed: 7984764, syncRate: 100.3, previousYearExecuted: 6811246 },
        { code: '46', name: '행사비', budget: 4000000, executed: 16699705, syncRate: 417.5, previousYearExecuted: 5333750 },
        { code: '47', name: '친교비', budget: 19000000, executed: 13762653, syncRate: 72.4, previousYearExecuted: 12419144 },
        { code: '48', name: '도서비', budget: 1700000, executed: 4292640, syncRate: 252.5, previousYearExecuted: 1644660 },
        { code: '49', name: '장학금', budget: 21000000, executed: 17560000, syncRate: 83.6, previousYearExecuted: 17336300 },
      ]},
      { code: 50, name: '봉사비', budget: 6800000, executed: 1223600, executionRate: 18.0, syncRate: 18.0, items: [] },
      { code: 60, name: '관리비', budget: 115000000, executed: 121970654, executionRate: 106.1, syncRate: 106.1, items: [] },
      { code: 70, name: '운영비', budget: 9000000, executed: 8266131, executionRate: 91.8, syncRate: 91.8, items: [] },
      { code: 80, name: '상회비', budget: 6430000, executed: 6430000, executionRate: 100, syncRate: 100, items: [] },
      { code: 90, name: '기타비용', budget: 10000000, executed: 10613550, executionRate: 106.1, syncRate: 106.1, items: [] },
    ]
  },
  2025: {
    referenceDate: '2025-12-28',
    daysPassed: 363,
    categories: [
      { code: 10, name: '사례비', budget: 148800000, executed: 156313691, executionRate: 105.0, syncRate: 105.7, items: [
        { code: '11', name: '교역자사례', budget: 128200000, executed: 136245721, syncRate: 106.8, previousYearExecuted: 108815430 },
        { code: '13', name: '기타수당', budget: 16100000, executed: 14433000, syncRate: 90.1, previousYearExecuted: 8531000 },
        { code: '14', name: '중식대', budget: 4500000, executed: 5634970, syncRate: 125.9, previousYearExecuted: 4829900 },
      ]},
      { code: 20, name: '예배비', budget: 20000000, executed: 19584867, executionRate: 97.9, syncRate: 98.5, items: [
        { code: '21', name: '예배환경비', budget: 12000000, executed: 9116067, syncRate: 76.4, previousYearExecuted: 4622180 },
        { code: '23', name: '찬양대', budget: 8000000, executed: 10468800, syncRate: 131.6, previousYearExecuted: 6759410 },
      ]},
      { code: 30, name: '선교비', budget: 32000000, executed: 30150250, executionRate: 94.2, syncRate: 94.7, items: [
        { code: '31', name: '전도비', budget: 1000000, executed: 1391650, syncRate: 140.0, previousYearExecuted: 936270 },
        { code: '32', name: '선교보고비', budget: 1000000, executed: 1267000, syncRate: 127.4, previousYearExecuted: 800000 },
        { code: '33', name: '선교후원비', budget: 30000000, executed: 27491600, syncRate: 92.1, previousYearExecuted: 29906700 },
      ]},
      { code: 40, name: '교육비', budget: 122800000, executed: 93800035, executionRate: 76.4, syncRate: 76.8, items: [
        { code: '41', name: '교육훈련비', budget: 2800000, executed: 7507250, syncRate: 269.6, previousYearExecuted: 9312810 },
        { code: '42', name: '어린이부', budget: 16200000, executed: 14760480, syncRate: 91.6, previousYearExecuted: 8773610 },
        { code: '43', name: '청소년부', budget: 6800000, executed: 5785050, syncRate: 85.6, previousYearExecuted: 3364940 },
        { code: '44', name: '청년부', budget: 10000000, executed: 10426390, syncRate: 104.8, previousYearExecuted: 7984764 },
        { code: '45', name: '목장비', budget: 19000000, executed: 5363150, syncRate: 28.4, previousYearExecuted: 0 },
        { code: '46', name: '행사비', budget: 19000000, executed: 14850330, syncRate: 78.6, previousYearExecuted: 16699705 },
        { code: '47', name: '친교비', budget: 15000000, executed: 17790450, syncRate: 119.3, previousYearExecuted: 13762653 },
        { code: '48', name: '도서비', budget: 4000000, executed: 2623935, syncRate: 66.0, previousYearExecuted: 4292640 },
        { code: '49', name: '장학금', budget: 30000000, executed: 14693000, syncRate: 49.3, previousYearExecuted: 17560000 },
      ]},
      { code: 50, name: '봉사비', budget: 2100000, executed: 7908040, executionRate: 376.6, syncRate: 378.7, items: [
        { code: '51', name: '경조비', budget: 600000, executed: 1800000, syncRate: 301.6, previousYearExecuted: 528000 },
        { code: '52', name: '구호비', budget: 500000, executed: 3100000, syncRate: 623.5, previousYearExecuted: 95600 },
        { code: '53', name: '지역사회봉사비', budget: 1000000, executed: 3008040, syncRate: 302.5, previousYearExecuted: 600000 },
      ]},
      { code: 60, name: '관리비', budget: 68100000, executed: 63739060, executionRate: 93.6, syncRate: 94.1, items: [
        { code: '61', name: '사택관리비', budget: 9000000, executed: 9652200, syncRate: 107.9, previousYearExecuted: 11288710 },
        { code: '62', name: '수도광열비', budget: 20000000, executed: 24506900, syncRate: 123.2, previousYearExecuted: 21724790 },
        { code: '63', name: '공과금', budget: 2000000, executed: 2400530, syncRate: 120.7, previousYearExecuted: 48000 },
        { code: '64', name: '관리대행비', budget: 6100000, executed: 6597560, syncRate: 108.8, previousYearExecuted: 6444840 },
        { code: '65', name: '차량유지비', budget: 11000000, executed: 10959000, syncRate: 100.2, previousYearExecuted: 57896684 },
        { code: '66', name: '수선유지비', budget: 20000000, executed: 9622870, syncRate: 48.4, previousYearExecuted: 24567630 },
      ]},
      { code: 70, name: '운영비', budget: 6700000, executed: 9782733, executionRate: 146.0, syncRate: 146.8, items: [
        { code: '71', name: '통신비', budget: 2200000, executed: 2240270, syncRate: 102.4, previousYearExecuted: 2338620 },
        { code: '72', name: '도서인쇄비', budget: 500000, executed: 1042250, syncRate: 209.6, previousYearExecuted: 392000 },
        { code: '74', name: '사무비', budget: 3000000, executed: 6200853, syncRate: 207.9, previousYearExecuted: 4342330 },
        { code: '75', name: '잡비', budget: 1000000, executed: 299360, syncRate: 30.1, previousYearExecuted: 1193181 },
      ]},
      { code: 80, name: '상회비', budget: 6500000, executed: 6381500, executionRate: 98.2, syncRate: 98.7, items: [
        { code: '81', name: '상회비', budget: 6500000, executed: 6381500, syncRate: 98.7, previousYearExecuted: 6430000 },
      ]},
      { code: 90, name: '기타비용', budget: 10020000, executed: 10595133, executionRate: 105.7, syncRate: 106.3, items: [
        { code: '91', name: '목회활동비', budget: 10000000, executed: 10550663, syncRate: 106.1, previousYearExecuted: 10598400 },
        { code: '94', name: '법인세', budget: 20000, executed: 44470, syncRate: 223.6, previousYearExecuted: 15150 },
      ]},
    ]
  }
};

// 5개년 추이 데이터 생성
function getFiveYearData(): YearlyData[] {
  return [2021, 2022, 2023, 2024, 2025].map(year => {
    const data = YEARLY_DATA[year];
    if (!data) return { year, budget: 0, executed: 0, executionRate: 0, syncRate: 0 };

    const totalBudget = data.categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalExecuted = data.categories.reduce((sum, cat) => sum + cat.executed, 0);
    const executionRate = totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0;
    const syncRate = calculateSyncRate(totalExecuted, totalBudget, data.daysPassed);

    return { year, budget: totalBudget, executed: totalExecuted, executionRate, syncRate };
  });
}

// 연도별 요약 생성
function getYearlySummary(year: number): BudgetSummary {
  const data = YEARLY_DATA[year];
  if (!data) {
    return {
      year,
      referenceDate: `${year}-12-31`,
      daysPassed: 365,
      totalBudget: 0,
      totalExecuted: 0,
      executionRate: 0,
      syncRate: 0,
      overBudgetItems: []
    };
  }

  const totalBudget = data.categories.reduce((sum, cat) => sum + cat.budget, 0);
  const totalExecuted = data.categories.reduce((sum, cat) => sum + cat.executed, 0);
  const executionRate = totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0;
  const syncRate = calculateSyncRate(totalExecuted, totalBudget, data.daysPassed);

  // 초과 항목 추출
  const overBudgetItems: OverBudgetItem[] = [];
  for (const cat of data.categories) {
    for (const item of cat.items) {
      if (item.syncRate > 100) {
        overBudgetItems.push({
          code: item.code,
          name: item.name,
          syncRate: item.syncRate
        });
      }
    }
  }
  overBudgetItems.sort((a, b) => b.syncRate - a.syncRate);

  return {
    year,
    referenceDate: data.referenceDate,
    daysPassed: data.daysPassed,
    totalBudget,
    totalExecuted,
    executionRate,
    syncRate,
    overBudgetItems: overBudgetItems.slice(0, 5)
  };
}

// 인사이트 생성
function generateInsights(year: number): Insight[] {
  const data = YEARLY_DATA[year];
  if (!data) return [];

  const insights: Insight[] = [];

  // 위험 항목 찾기
  const dangerItems: { name: string; syncRate: number }[] = [];
  for (const cat of data.categories) {
    for (const item of cat.items) {
      if (item.syncRate > 150) {
        dangerItems.push({ name: item.name, syncRate: item.syncRate });
      }
    }
  }
  dangerItems.sort((a, b) => b.syncRate - a.syncRate);

  if (dangerItems.length > 0) {
    insights.push({
      type: 'danger',
      message: `${dangerItems[0].name}이 동기집행률 ${dangerItems[0].syncRate.toFixed(1)}% → 즉시 예산 조정 필요`
    });
  }

  // 전년 대비 비교
  const prevYear = year - 1;
  const prevData = YEARLY_DATA[prevYear];
  if (prevData) {
    const currentTotal = data.categories.reduce((sum, cat) => sum + cat.executed, 0);
    const prevTotal = prevData.categories.reduce((sum, cat) => sum + cat.executed, 0);
    const yoyRate = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    insights.push({
      type: yoyRate > 0 ? 'warning' : 'info',
      message: `전년 대비 총 집행액 ${yoyRate >= 0 ? '+' : ''}${yoyRate.toFixed(1)}% ${yoyRate > 0 ? '증가' : '감소'}${yoyRate < 0 ? ' (예산 절감 효과)' : ''}`
    });
  }

  // 사례비 증가 추세
  const salaryCategory = data.categories.find(c => c.code === 10);
  const prevSalaryCategory = prevData?.categories.find(c => c.code === 10);
  if (salaryCategory && prevSalaryCategory) {
    const salaryGrowth = ((salaryCategory.executed - prevSalaryCategory.executed) / prevSalaryCategory.executed) * 100;
    if (salaryGrowth > 10) {
      insights.push({
        type: 'warning',
        message: `사례비 증가율 +${salaryGrowth.toFixed(1)}% → 인건비 상승 추세`
      });
    }
  }

  return insights;
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

function SubCategoryItem({ item }: { item: SubCategoryData }) {
  return (
    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full",
          item.syncRate > 100 ? "bg-red-500" : "bg-blue-500"
        )} />
        <span>{item.name} ({item.code})</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-500 w-20 text-right">{formatCurrency(item.budget)}</span>
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
  category: CategoryData;
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
          <span className="font-semibold">{category.name} ({category.code})</span>
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

      {isExpanded && category.items.length > 0 && (
        <div className="px-4 pb-4 space-y-1">
          {category.items.map(item => (
            <SubCategoryItem key={item.code} item={item} />
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
  const [selectedYear, setSelectedYear] = useState(2025);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([10, 20]));
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const summary = useMemo(() => getYearlySummary(selectedYear), [selectedYear]);
  const fiveYearData = useMemo(() => getFiveYearData(), []);
  const categories = useMemo(() => YEARLY_DATA[selectedYear]?.categories || [], [selectedYear]);
  const insights = useMemo(() => generateInsights(selectedYear), [selectedYear]);

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
    if (expandedCategories.size === categories.length) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(categories.map(c => c.code)));
    }
  };

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
              {[2021, 2022, 2023, 2024, 2025].map(year => (
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
              {summary.year}년 예산 집행 현황
            </CardTitle>
            <Badge variant="outline">
              기준일: {summary.referenceDate} ({summary.daysPassed}일 경과)
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="총 예산"
              value={formatCurrency(summary.totalBudget)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              title="총 집행"
              value={formatCurrency(summary.totalExecuted)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="집행률"
              value={`${summary.executionRate.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              status={summary.executionRate > 100 ? 'warning' : 'normal'}
            />
            <StatCard
              title="동기집행률"
              value={`${summary.syncRate.toFixed(1)}%`}
              icon={<AlertTriangle className="h-4 w-4" />}
              status={getStatus(summary.syncRate)}
            />
          </div>

          {summary.overBudgetItems.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>동기집행률 초과 항목: {summary.overBudgetItems.length}개</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  {summary.overBudgetItems.map(item => (
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
              <ComposedChart data={fiveYearData}>
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
                  {fiveYearData.map(row => (
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
              {expandedCategories.size === categories.length ? '전체 접기' : '전체 펼치기'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map(category => (
            <CategoryItem
              key={category.code}
              category={category}
              isExpanded={expandedCategories.has(category.code)}
              onToggle={() => handleToggleCategory(category.code)}
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
