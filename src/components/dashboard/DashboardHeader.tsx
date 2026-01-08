'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { format, startOfWeek, differenceInWeeks } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DashboardHeaderProps {
  currentDate: Date;
  weekOffset?: number;
  unmatchedCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardHeader({
  currentDate,
  weekOffset = 0,
  unmatchedCount = 0,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const buildUrl = (weekParam: number | null) => {
    const params = new URLSearchParams();
    if (weekParam !== null && weekParam !== 0) {
      params.set('week', String(weekParam));
    }
    const query = params.toString();
    return query ? `/dashboard?${query}` : '/dashboard';
  };

  const handlePrevWeek = () => {
    const newOffset = weekOffset - 1;
    startTransition(() => {
      router.push(buildUrl(newOffset));
    });
  };

  const handleNextWeek = () => {
    const newOffset = weekOffset + 1;
    if (newOffset <= 0) {
      startTransition(() => {
        router.push(buildUrl(newOffset === 0 ? null : newOffset));
      });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setCalendarOpen(false);

    // 선택한 날짜의 주의 일요일 계산
    const selectedSunday = startOfWeek(date, { weekStartsOn: 0 });
    const today = new Date();
    const currentSunday = startOfWeek(today, { weekStartsOn: 0 });

    // 주차 차이 계산
    const weekDiff = differenceInWeeks(selectedSunday, currentSunday);

    startTransition(() => {
      router.push(buildUrl(weekDiff === 0 ? null : weekDiff));
    });
  };

  const dateStr = format(currentDate, 'M월 d일 (EEEE)', { locale: ko });
  const dateStrShort = format(currentDate, 'M/d (EEE)', { locale: ko });
  const isCurrentWeek = weekOffset >= 0;

  return (
    <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between md:mb-6">
      {/* Title Section */}
      <div className="flex items-center justify-between md:justify-start md:gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[22px] md:text-[28px] font-semibold text-[#2C3E50]">
            재정 대시보드
          </h1>
          <p className="hidden md:block text-[12px] text-[#6B7B8C]">
            주간 현황을 한눈에 확인하세요
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Week Navigation + Refresh */}
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevWeek}
            disabled={isPending}
            className="h-8 px-2 md:px-2.5 rounded-r-none border-r-0 bg-[#F8F6F3] border-[#E8E4DE] hover:bg-[#F0EDE8] hover:border-[#C9A962] disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 h-8 border border-[#E8E4DE] bg-white hover:bg-[#F8F6F3] transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#C9A962]" />
                    <span className="text-[12px] md:text-sm font-semibold text-[#6B7B8C]">로딩...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm md:text-base">📅</span>
                    <span className="text-[12px] md:text-sm font-semibold text-[#2C3E50] md:hidden">{dateStrShort}</span>
                    <span className="hidden md:inline text-sm font-semibold text-[#2C3E50]">{dateStr}</span>
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={handleDateSelect}
                locale={ko}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            disabled={isCurrentWeek || isPending}
            className="h-8 px-2 md:px-2.5 rounded-l-none border-l-0 bg-[#F8F6F3] border-[#E8E4DE] hover:bg-[#F0EDE8] hover:border-[#C9A962] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 ml-1.5 md:ml-2 bg-[#F8F6F3] border-[#E8E4DE] hover:bg-[#F0EDE8] hover:border-[#C9A962]"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Alert Badge - 미분류 거래 */}
        {unmatchedCount > 0 && (
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white border border-[#E8E4DE]">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#E67E22]" />
            <span className="hidden md:inline text-[12px] text-[#6B7B8C]">미분류</span>
            <span className="text-[11px] md:text-[13px] font-bold text-[#E67E22]">{unmatchedCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
