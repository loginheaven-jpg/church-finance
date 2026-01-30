'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface WeeklyBriefingCardProps {
  weeklyIncome: number;
  weeklyExpense: number;
  balance: number;
  yearlyExecutionRate: number;
  isLoading?: boolean;
}

interface BuildingData {
  summary: {
    loanBalance: number;
    totalDonation: number;
    totalCost: number;
    donationRate: number;
  };
}

export function WeeklyBriefingCard({
  weeklyIncome,
  weeklyExpense,
  balance,
  yearlyExecutionRate,
  isLoading = false,
}: WeeklyBriefingCardProps) {
  // 건축 데이터 조회
  const { data: buildingData } = useQuery<{ success: boolean; data: BuildingData }>({
    queryKey: ['building-summary'],
    queryFn: async () => {
      const res = await fetch('/api/reports/building');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30분
  });

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 10000000) {
      return `${Math.round(amount / 10000)}만원`;
    }
    if (amount >= 1000000) {
      return `${Math.round(amount / 10000)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // 주간 브리핑 메시지 생성
  const generateBriefing = () => {
    const incomeFormatted = formatAmount(weeklyIncome);
    const expenseFormatted = formatAmount(weeklyExpense);
    const netFlow = weeklyIncome - weeklyExpense;
    const netFlowText = netFlow >= 0
      ? `${formatAmount(netFlow)} 흑자`
      : `${formatAmount(Math.abs(netFlow))} 적자`;

    let executionStatus = '';
    if (yearlyExecutionRate >= 90 && yearlyExecutionRate <= 110) {
      executionStatus = '예산 집행이 정상 범위입니다.';
    } else if (yearlyExecutionRate < 90) {
      executionStatus = '예산 집행률이 다소 낮습니다.';
    } else {
      executionStatus = '예산 집행률이 다소 높습니다.';
    }

    return {
      income: incomeFormatted,
      expense: expenseFormatted,
      netFlow: netFlowText,
      executionStatus,
      balance: formatAmount(balance),
    };
  };

  // 건축헌금 현황 메시지
  const getBuildingStatus = () => {
    if (!buildingData?.data?.summary) return null;

    const { loanBalance, donationRate } = buildingData.data.summary;
    return {
      loanBalance: formatAmount(loanBalance),
      donationRate: donationRate.toFixed(1),
    };
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft bg-gradient-to-br from-[#F5EFE0] to-[#E8E0D0]">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#C9A962]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const briefing = generateBriefing();
  const buildingStatus = getBuildingStatus();

  return (
    <Card className="border-0 shadow-soft bg-gradient-to-br from-[#F5EFE0] to-[#E8E0D0]">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* AI 주간 브리핑 */}
        <div className="flex items-start gap-3">
          <div className="text-xl md:text-2xl">📊</div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#2C3E50] text-[14px] md:text-[15px]">
              이번 주 재정 브리핑
            </h3>
            <p className="text-[#6B7B8C] text-[12px] md:text-[13px] mt-1 leading-relaxed">
              이번 주 헌금 <strong className="text-[#4A9B7F]">{briefing.income}</strong>이
              접수되었고, 지출은 <strong className="text-[#E74C3C]">{briefing.expense}</strong>입니다.
              <br />
              주간 수지는 <strong className="text-[#2C3E50]">{briefing.netFlow}</strong>이며,
              현재 잔액은 <strong className="text-[#2C3E50]">{briefing.balance}</strong>입니다.
              <br />
              <span className="text-[#6B7B8C]">{briefing.executionStatus}</span>
            </p>
          </div>
        </div>

        {/* 건축헌금 현황 */}
        {buildingStatus && (
          <div className="flex items-start gap-3 pt-2 border-t border-[#D4C5A9]">
            <div className="text-xl md:text-2xl">🏛️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#2C3E50] text-[14px] md:text-[15px]">
                성전건축 현황
              </h3>
              <p className="text-[#6B7B8C] text-[12px] md:text-[13px] mt-1 leading-relaxed">
                총 건축비 대비 헌금 달성률 <strong className="text-[#C9A962]">{buildingStatus.donationRate}%</strong>,
                대출 잔액 <strong className="text-[#2C3E50]">{buildingStatus.loanBalance}</strong>
                <br />
                함께 기도해 주세요!
              </p>
            </div>
          </div>
        )}

        {/* 감사 메시지 */}
        <div className="flex items-start gap-3 pt-2 border-t border-[#D4C5A9]">
          <div className="text-xl md:text-2xl">🙏</div>
          <div className="flex-1">
            <p className="text-[#6B7B8C] text-[12px] md:text-[13px] leading-relaxed italic">
              여러분의 헌금은 예배, 선교, 교육, 구제 사역에 소중히 사용됩니다.
              <br />
              투명한 재정 운영으로 하나님 나라 확장에 기여하겠습니다. 감사합니다.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
