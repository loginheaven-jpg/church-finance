'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, FileBarChart, FileSpreadsheet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BankBudgetReport } from '@/components/reports/BankBudgetReport';
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
} from 'recharts';

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
}

interface PeriodData {
  startDate: string;
  endDate: string;
  label: string;
  income: {
    total: number;
    byCategory: Array<{ code: number; name: string; amount: number }>;
  };
  expense: {
    total: number;
    byCategory: Array<{ code: number; name: string; amount: number }>;
  };
  budget?: {
    total: number;
    executed: number;
    rate: number;
  };
}

interface ComparisonData {
  label: string;
  incomeChange: number;
  incomeChangeRate: number;
  expenseChange: number;
  expenseChangeRate: number;
}

interface ReportResult {
  periods: PeriodData[];
  comparison: ComparisonData[] | null;
}

export default function CustomReportPage() {
  const currentYear = new Date().getFullYear();
  const [periods, setPeriods] = useState<Period[]>([
    {
      id: '1',
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      label: `${currentYear}년`,
    },
  ]);
  const [includeIncome, setIncludeIncome] = useState(true);
  const [includeExpense, setIncludeExpense] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankBudgetOpen, setBankBudgetOpen] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const addPeriod = () => {
    if (periods.length >= 3) {
      toast.error('최대 3개 기간까지 비교할 수 있습니다');
      return;
    }
    const prevYear = currentYear - periods.length;
    setPeriods([
      ...periods,
      {
        id: String(Date.now()),
        startDate: `${prevYear}-01-01`,
        endDate: `${prevYear}-12-31`,
        label: `${prevYear}년`,
      },
    ]);
  };

  const removePeriod = (id: string) => {
    if (periods.length <= 1) {
      toast.error('최소 하나의 기간이 필요합니다');
      return;
    }
    setPeriods(periods.filter(p => p.id !== id));
  };

  const updatePeriod = (id: string, field: keyof Period, value: string) => {
    setPeriods(periods.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const generateReport = async () => {
    if (!includeIncome && !includeExpense && !includeBudget) {
      toast.error('최소 하나의 분석 항목을 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periods: periods.map(p => ({
            startDate: p.startDate,
            endDate: p.endDate,
            label: p.label,
          })),
          includeIncome,
          includeExpense,
          includeBudget,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.data);
        toast.success('보고서가 생성되었습니다');
      } else {
        toast.error(data.error || '보고서 생성 실패');
      }
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('보고서 생성 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    if (Math.abs(amount) >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`;
    }
    if (Math.abs(amount) >= 1000000) {
      return `${Math.round(amount / 1000000)}백만`;
    }
    if (Math.abs(amount) >= 10000) {
      return `${Math.round(amount / 10000).toLocaleString()}만`;
    }
    return amount.toLocaleString();
  };

  // 비교 차트 데이터
  const comparisonChartData = result?.periods.map(p => ({
    name: p.label,
    수입: p.income.total,
    지출: p.expense.total,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">커스텀 보고서</h1>
        <p className="text-sm text-slate-500 mt-1">
          원하는 기간과 항목을 선택하여 맞춤형 보고서를 생성합니다
        </p>
      </div>

      {/* 은행 보고서 */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Button variant="outline" onClick={() => setBankBudgetOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            은행제출용 예산안
          </Button>
          <Button variant="outline" disabled>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            은행제출용 연간보고 (준비중)
          </Button>
        </CardContent>
      </Card>
      <BankBudgetReport open={bankBudgetOpen} onOpenChange={setBankBudgetOpen} />

      {/* 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            보고서 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 기간 설정 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">비교 기간</Label>
              <Button variant="outline" size="sm" onClick={addPeriod}>
                <Plus className="h-4 w-4 mr-1" />
                기간 추가
              </Button>
            </div>
            <div className="space-y-3">
              {periods.map((period, idx) => (
                <div key={period.id} className="flex items-end gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">시작일</Label>
                      <Input
                        type="date"
                        value={period.startDate}
                        onChange={(e) => updatePeriod(period.id, 'startDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">종료일</Label>
                      <Input
                        type="date"
                        value={period.endDate}
                        onChange={(e) => updatePeriod(period.id, 'endDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">라벨</Label>
                      <Input
                        value={period.label}
                        onChange={(e) => updatePeriod(period.id, 'label', e.target.value)}
                        placeholder="예: 2024년"
                      />
                    </div>
                  </div>
                  {periods.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => removePeriod(period.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 포함 항목 */}
          <div className="space-y-3">
            <Label className="text-base font-medium">포함 항목</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeIncome"
                  checked={includeIncome}
                  onCheckedChange={(checked) => setIncludeIncome(checked === true)}
                />
                <Label htmlFor="includeIncome" className="cursor-pointer">
                  수입 분석
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeExpense"
                  checked={includeExpense}
                  onCheckedChange={(checked) => setIncludeExpense(checked === true)}
                />
                <Label htmlFor="includeExpense" className="cursor-pointer">
                  지출 분석
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeBudget"
                  checked={includeBudget}
                  onCheckedChange={(checked) => setIncludeBudget(checked === true)}
                />
                <Label htmlFor="includeBudget" className="cursor-pointer">
                  예산 대비
                </Label>
              </div>
            </div>
          </div>

          {/* 생성 버튼 */}
          <Button onClick={generateReport} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              '보고서 생성'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 결과 */}
      {result && (
        <div className="space-y-6">
          {/* 비교 차트 */}
          {result.periods.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>기간별 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatAmount} />
                    <Tooltip formatter={(value) => [(Number(value) || 0).toLocaleString() + '원', '']} />
                    <Legend />
                    <Bar dataKey="수입" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="지출" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* 변화율 */}
                {result.comparison && result.comparison.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.comparison.map((comp, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-sm text-slate-500 mb-2">{comp.label}</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-400">수입 변화</div>
                            <div className={`text-lg font-bold flex items-center gap-1 ${
                              comp.incomeChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comp.incomeChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              {comp.incomeChangeRate}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400">지출 변화</div>
                            <div className={`text-lg font-bold flex items-center gap-1 ${
                              comp.expenseChange <= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comp.expenseChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              {comp.expenseChangeRate}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 기간별 상세 */}
          {result.periods.map((period, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {period.label}
                  <span className="text-sm font-normal text-slate-500">
                    ({period.startDate} ~ {period.endDate})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 요약 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <div className="text-sm text-slate-500">총 수입</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatAmount(period.income.total)}원
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <TrendingDown className="h-6 w-6 text-red-600 mx-auto mb-2" />
                    <div className="text-sm text-slate-500">총 지출</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatAmount(period.expense.total)}원
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-slate-500">수지 차액</div>
                    <div className={`text-xl font-bold ${
                      period.income.total - period.expense.total >= 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {period.income.total - period.expense.total >= 0 ? '+' : ''}
                      {formatAmount(period.income.total - period.expense.total)}원
                    </div>
                  </div>
                </div>

                {/* 예산 대비 */}
                {period.budget && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">예산 집행률</span>
                      <span className="font-bold">{period.budget.rate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>집행: {formatAmount(period.budget.executed)}원</span>
                      <span>예산: {formatAmount(period.budget.total)}원</span>
                    </div>
                  </div>
                )}

                {/* 수입 카테고리 */}
                {period.income.byCategory.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-green-600">수입 카테고리별</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>카테고리</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="text-right">비율</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {period.income.byCategory.slice(0, 5).map(cat => (
                          <TableRow key={cat.code}>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell className="text-right">{formatAmount(cat.amount)}원</TableCell>
                            <TableCell className="text-right">
                              {Math.round((cat.amount / period.income.total) * 100)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* 지출 카테고리 */}
                {period.expense.byCategory.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-600">지출 카테고리별</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>카테고리</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="text-right">비율</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {period.expense.byCategory.slice(0, 5).map(cat => (
                          <TableRow key={cat.code}>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell className="text-right">{formatAmount(cat.amount)}원</TableCell>
                            <TableCell className="text-right">
                              {Math.round((cat.amount / period.expense.total) * 100)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
