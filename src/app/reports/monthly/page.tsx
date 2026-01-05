'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import type { MonthlyReport } from '@/types';

export default function MonthlyReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());

  const fetchReport = async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/monthly?year=${y}`);
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

  const totalIncome = report?.months.reduce((sum, m) => sum + m.income, 0) || 0;
  const totalExpense = report?.months.reduce((sum, m) => sum + m.expense, 0) || 0;
  const totalBalance = totalIncome - totalExpense;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">월간 보고서</h1>
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
          {/* 연간 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">연간 총 수입</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {totalIncome.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">연간 총 지출</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {totalExpense.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">연간 수지차액</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 월별 상세 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                월별 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>월</TableHead>
                    <TableHead className="text-right">수입</TableHead>
                    <TableHead className="text-right">지출</TableHead>
                    <TableHead className="text-right">수지차액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.months.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="font-medium">{month.month}월</TableCell>
                      <TableCell className="text-right text-green-600">
                        {month.income.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {month.expense.toLocaleString()}원
                      </TableCell>
                      <TableCell className={`text-right font-medium ${month.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {month.balance >= 0 ? '+' : ''}{month.balance.toLocaleString()}원
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-bold">
                    <TableCell>합계</TableCell>
                    <TableCell className="text-right text-green-600">
                      {totalIncome.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {totalExpense.toLocaleString()}원
                    </TableCell>
                    <TableCell className={`text-right ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString()}원
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
