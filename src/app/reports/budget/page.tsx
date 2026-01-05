'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, ChevronLeft, ChevronRight, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import type { BudgetReport } from '@/types';

export default function BudgetReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<BudgetReport | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const fetchReport = async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/budget?year=${y}`);
      const data = await res.json();

      if (data.success) {
        setReport(data.data);
      } else {
        toast.error(data.error || '보고서 조회 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('보고서를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(year);
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalBudgeted = report?.categories.reduce(
    (sum, cat) => sum + cat.accounts.reduce((s, a) => s + a.budgeted, 0),
    0
  ) || 0;

  const totalExecuted = report?.categories.reduce(
    (sum, cat) => sum + cat.accounts.reduce((s, a) => s + a.executed, 0),
    0
  ) || 0;

  const overallPercentage = totalBudgeted > 0 ? Math.round((totalExecuted / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">예산 대비 보고서</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium w-20 text-center">{year}년</span>
          <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          {/* 전체 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                전체 예산 집행 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>총 예산: {totalBudgeted.toLocaleString()}원</span>
                  <span>집행: {totalExecuted.toLocaleString()}원 ({overallPercentage}%)</span>
                </div>
                <Progress
                  value={overallPercentage}
                  className="h-4"
                />
                <div className="text-sm text-slate-500">
                  잔액: {(totalBudgeted - totalExecuted).toLocaleString()}원
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 카테고리별 상세 */}
          {report.categories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                예산 데이터가 없습니다. 예산 시트에 데이터를 입력하세요.
              </CardContent>
            </Card>
          ) : (
            report.categories.map((category) => {
              const catBudgeted = category.accounts.reduce((s, a) => s + a.budgeted, 0);
              const catExecuted = category.accounts.reduce((s, a) => s + a.executed, 0);
              const catPercentage = catBudgeted > 0 ? Math.round((catExecuted / catBudgeted) * 100) : 0;

              return (
                <Card key={category.category_code}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {category.category_item}
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        ({catPercentage}% 집행)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {category.accounts.map((account) => (
                        <div key={account.account_code} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{account.account_item}</span>
                            <span className={account.percentage > 100 ? 'text-red-600 font-medium' : ''}>
                              {account.executed.toLocaleString()} / {account.budgeted.toLocaleString()}원
                              ({account.percentage}%)
                            </span>
                          </div>
                          <Progress
                            value={Math.min(account.percentage, 100)}
                            className={`h-2 ${account.percentage > 100 ? '[&>div]:bg-red-500' : ''}`}
                          />
                          {account.percentage > 100 && (
                            <div className="text-xs text-red-600">
                              예산 초과: {(account.executed - account.budgeted).toLocaleString()}원
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
