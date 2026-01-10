'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CategorySummary {
  category: string;
  amount: number;
}

interface TransactionDetailsProps {
  type: 'income' | 'expense';
  summary: CategorySummary[];
  total: number;
}

export function TransactionDetails({ type, summary, total }: TransactionDetailsProps) {
  const isIncome = type === 'income';
  const Icon = isIncome ? TrendingUp : TrendingDown;
  const title = isIncome ? '이번 주 수입 내역' : '이번 주 지출 내역';
  const iconColor = isIncome ? '#4A9B7F' : '#E74C3C';
  const amountColor = isIncome ? 'text-[#4A9B7F]' : 'text-[#E74C3C]';
  const barColor = isIncome ? 'bg-[#4A9B7F]' : 'bg-[#E74C3C]';

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  if (summary.length === 0) {
    return (
      <Card className="border-0 shadow-soft mt-4">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
            <h3 className="font-display text-[16px] md:text-[18px] font-semibold text-[#2C3E50]">
              {title}
            </h3>
          </div>
          <div className="text-center py-8 text-[#6B7B8C]">
            이번 주 {isIncome ? '수입' : '지출'} 내역이 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-soft mt-4">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
            <h3 className="font-display text-[16px] md:text-[18px] font-semibold text-[#2C3E50]">
              {title}
            </h3>
          </div>
          <div className={`font-display text-[18px] font-bold ${amountColor}`}>
            {formatAmount(total)}
          </div>
        </div>

        <div className="space-y-3">
          {summary.map((item, idx) => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[#2C3E50]">
                    {item.category}
                  </span>
                  <span className={`text-[14px] font-semibold ${amountColor}`}>
                    {formatAmount(item.amount)}
                  </span>
                </div>
                <div className="h-2 bg-[#F0EDE8] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-right text-[11px] text-[#6B7B8C]">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
