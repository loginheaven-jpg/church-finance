'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { WeeklyReport } from '@/types';

export default function WeeklyReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchReport = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/weekly?date=${date}`);
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
    fetchReport(currentDate);
  }, [currentDate]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(date.toISOString().split('T')[0]);
  };

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
        <h1 className="text-3xl font-bold text-slate-900">주간 보고서</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          {/* 기간 표시 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {report.week} 주간 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500">
                {report.dateRange.start} ~ {report.dateRange.end}
              </div>
            </CardContent>
          </Card>

          {/* 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">총 수입</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {report.income.total.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">총 지출</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {report.expense.total.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">수지차액</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${report.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {report.balance >= 0 ? '+' : ''}{report.balance.toLocaleString()}원
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 수입 상세 */}
          <Card>
            <CardHeader>
              <CardTitle>수입 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {report.income.byType.length === 0 ? (
                <div className="text-center py-4 text-slate-500">수입 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {report.income.byType.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-slate-700">{item.type}</span>
                      <span className="font-medium text-green-600">
                        {item.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 지출 상세 */}
          <Card>
            <CardHeader>
              <CardTitle>지출 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {report.expense.byCategory.length === 0 ? (
                <div className="text-center py-4 text-slate-500">지출 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {report.expense.byCategory.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-slate-700">{item.category}</span>
                      <span className="font-medium text-red-600">
                        {item.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
