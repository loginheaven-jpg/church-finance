'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, CalendarIcon, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { WeeklyReport } from '@/types';
import { ExpenseDetailModal } from '@/components/expense-detail-modal';
import { useFinanceRole } from '@/lib/auth/use-finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';

// 주어진 날짜의 주일(일요일)을 계산
function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function WeeklyReportPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 사용자 권한 확인 (제직 이상만 지출 상세 조회 가능)
  const userRole = useFinanceRole();
  const canViewExpenseDetail = hasRole(userRole, 'deacon');

  // 지출 상세 모달 상태
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<{
    accountCode?: number;
    categoryCode?: number;
    name: string;
  } | null>(null);

  const handleCategoryClick = (categoryCode: number, name: string) => {
    setSelectedExpense({ categoryCode, name });
    setExpenseModalOpen(true);
  };

  const handleAccountClick = (accountCode: number, name: string) => {
    setSelectedExpense({ accountCode, name });
    setExpenseModalOpen(true);
  };

  const fetchReport = async (offset: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/weekly?week=${offset}`);
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
    fetchReport(weekOffset);
  }, [weekOffset]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekOffset(prev => prev + (direction === 'prev' ? -1 : 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    const selectedSunday = getSundayOfWeek(date);
    const today = new Date();
    const currentSunday = getSundayOfWeek(today);

    // 주 차이 계산
    const diffTime = selectedSunday.getTime() - currentSunday.getTime();
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

    setWeekOffset(diffWeeks);
    setCalendarOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
  };

  // 현재 표시 중인 주일 계산
  const displaySunday = report ? new Date(report.sundayDate + 'T00:00:00') : getSundayOfWeek(new Date());

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">보고서를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {report?.weekNumber || '--'} 주차 보고
          </h1>
          <span className="text-sm text-slate-500">
            {report?.year}년
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 주 네비게이션 */}
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 날짜 선택 (캘린더 팝업) */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(displaySunday, 'M월 d일 (EEEE)', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={displaySunday}
                onSelect={handleDateSelect}
                locale={ko}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            인쇄
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">예봄교회 주간재정보고</h1>
        <p className="text-lg mt-2">
          {report?.year}년 {report?.weekNumber}주차 ({report?.dateRange.start} ~ {report?.dateRange.end})
        </p>
      </div>

      {report && (
        <div ref={printRef} className="space-y-6 print:space-y-4">
          {/* 잔고 현황 (3열: 전주최종잔고 | 수지차액 | 현재잔고) */}
          <Card className="print:shadow-none print:border-2">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg print:bg-white print:border">
                  <div className="text-sm text-slate-500 mb-1">전주최종잔고</div>
                  <div className="text-xl font-bold text-slate-900">
                    {formatAmount(report.previousBalance)}원
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg print:bg-white print:border ${report.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`text-sm mb-1 ${report.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>수지차액</div>
                  <div className={`text-xl font-bold ${report.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {report.balance >= 0 ? '+' : ''}{formatAmount(report.balance)}원
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg print:bg-white print:border">
                  <div className="text-sm text-blue-600 mb-1">현재잔고</div>
                  <div className="text-xl font-bold text-blue-700">
                    {formatAmount(report.currentBalance)}원
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 수입/지출 테이블 (2열 레이아웃) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
            {/* 수입 */}
            <Card className="print:shadow-none print:border-2">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="text-lg font-bold text-green-700">수입</h3>
                  <span className="text-lg font-bold text-green-700">
                    {formatAmount(report.income.subtotal)}원
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">항목</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.income.byCategory
                      .filter(cat => cat.amount > 0)
                      .map((cat) => (
                        <TableRow key={cat.categoryCode}>
                          <TableCell className="font-medium">{cat.categoryName}</TableCell>
                          <TableCell className="text-right">{formatAmount(cat.amount)}</TableCell>
                        </TableRow>
                      ))}
                    {report.income.byCategory.filter(c => c.amount > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-400 py-4">
                          수입 내역 없음
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4 pt-4 border-t-2 border-amber-200 flex justify-between items-center">
                  <span className="font-bold text-amber-700">건축헌금</span>
                  <span className="text-lg font-bold text-amber-700">
                    {formatAmount(report.construction.income)}원
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 지출 */}
            <Card className="print:shadow-none print:border-2">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="text-lg font-bold text-red-700">지출</h3>
                  <span className="text-lg font-bold text-red-700">
                    {formatAmount(report.expense.subtotal)}원
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">항목</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.expense.byCategory
                      .filter(cat => cat.amount > 0)
                      .map((cat) => (
                        <TableRow
                          key={cat.categoryCode}
                          className={canViewExpenseDetail ? "cursor-pointer hover:bg-red-50" : ""}
                          onClick={canViewExpenseDetail ? () => handleCategoryClick(cat.categoryCode, cat.categoryName) : undefined}
                        >
                          <TableCell className="font-medium">{cat.categoryName}</TableCell>
                          <TableCell className="text-right">{formatAmount(cat.amount)}</TableCell>
                        </TableRow>
                      ))}
                    {report.expense.byCategory.filter(c => c.amount > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-400 py-4">
                          지출 내역 없음
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4 pt-4 border-t-2 border-amber-200 flex justify-between items-center">
                  <span className="font-bold text-amber-700">건축비지출</span>
                  <span className="text-lg font-bold text-amber-700">
                    {formatAmount(report.construction.expense)}원
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 상세 내역 (코드별) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
            {/* 수입 상세 */}
            {report.income.byCode.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-md font-semibold text-slate-700 mb-3">수입 상세</h3>
                  <div className="space-y-1">
                    {report.income.byCode.map((item) => (
                      <div key={item.code} className="flex justify-between text-sm py-1 border-b border-slate-100">
                        <span className="text-slate-600">
                          <span className="text-slate-400 mr-2">[{item.code}]</span>
                          {item.name}
                        </span>
                        <span className="text-green-600">{formatAmount(item.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 지출 상세 */}
            {report.expense.byCode.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-md font-semibold text-slate-700 mb-3">지출 상세</h3>
                  <div className="space-y-1">
                    {report.expense.byCode.map((item) => (
                      <div
                        key={item.code}
                        className={`flex justify-between text-sm py-1 border-b border-slate-100 rounded px-1 ${canViewExpenseDetail ? 'cursor-pointer hover:bg-red-50' : ''}`}
                        onClick={canViewExpenseDetail ? () => handleAccountClick(item.code, item.name) : undefined}
                      >
                        <span className="text-slate-600">
                          <span className="text-slate-400 mr-2">[{item.code}]</span>
                          {item.name}
                        </span>
                        <span className="text-red-600">{formatAmount(item.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 지출 상세 모달 (제직 이상만) */}
      {canViewExpenseDetail && selectedExpense && (
        <ExpenseDetailModal
          open={expenseModalOpen}
          onOpenChange={setExpenseModalOpen}
          accountCode={selectedExpense.accountCode}
          categoryCode={selectedExpense.categoryCode}
          accountName={selectedExpense.name}
          year={report?.year || new Date().getFullYear()}
        />
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .space-y-6.print\\:space-y-4,
          .space-y-6.print\\:space-y-4 * {
            visibility: visible;
          }
          .space-y-6.print\\:space-y-4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
