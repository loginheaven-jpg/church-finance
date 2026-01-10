'use client';

import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  rawValue?: number; // 원본 숫자 (툴팁 표시용)
  color: 'income' | 'expense' | 'balance' | 'warning';
  isSelected?: boolean;
  onClick?: () => void;
}

const colorMap = {
  income: {
    iconBg: 'linear-gradient(135deg, #E8F5F0 0%, #D1EBE3 100%)',
    iconColor: '#4A9B7F',
    textColor: 'text-[#4A9B7F]',
    labelColor: 'text-[#6B7B8C]',
  },
  expense: {
    iconBg: 'linear-gradient(135deg, #FDECEA 0%, #F8D7D5 100%)',
    iconColor: '#E74C3C',
    textColor: 'text-[#E74C3C]',
    labelColor: 'text-[#6B7B8C]',
  },
  balance: {
    iconBg: 'linear-gradient(135deg, #E8F4FD 0%, #D1E9FA 100%)',
    iconColor: '#3498db',
    textColor: 'text-[#3498db]',
    labelColor: 'text-[#6B7B8C]',
  },
  warning: {
    iconBg: 'linear-gradient(135deg, #FDF8E8 0%, #F5EFD1 100%)',
    iconColor: '#E67E22',
    textColor: 'text-[#E67E22]',
    labelColor: 'text-[#6B7B8C]',
  },
};

export function StatsCard({ icon: Icon, label, value, rawValue, color, isSelected, onClick }: StatsCardProps) {
  const colors = colorMap[color];

  // 원본 숫자를 포맷팅하여 툴팁으로 표시
  const tooltipText = rawValue !== undefined
    ? new Intl.NumberFormat('ko-KR').format(rawValue) + '원'
    : undefined;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-0 shadow-soft cursor-pointer transition-all duration-300 bg-white',
        'hover:shadow-medium hover:-translate-y-0.5',
        isSelected && 'ring-2 ring-[#C9A962] shadow-medium'
      )}
      onClick={onClick}
    >
      {/* Gold Top Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: 'linear-gradient(90deg, #C9A962 0%, #E8D5A8 100%)' }}
      />

      <CardContent className="p-3 pt-4 md:p-4 md:pt-5">
        <div className="flex items-center gap-2.5 md:gap-[14px]">
          {/* Icon Box */}
          <div
            className="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: colors.iconBg }}
          >
            <Icon
              className="h-5 w-5 md:h-[26px] md:w-[26px]"
              style={{ color: colors.iconColor }}
            />
          </div>

          {/* Value and Label */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-display text-[22px] md:text-[28px] font-bold leading-none',
                colors.textColor
              )}
              title={tooltipText}
            >
              {value}
            </p>
            <p className={cn(
              'text-[11px] md:text-[12px] font-medium mt-0.5',
              colors.labelColor
            )}>
              {label}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
