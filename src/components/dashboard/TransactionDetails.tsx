'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryDetail {
  code: number;
  item: string;
  amount: number;
}

interface CategorySummaryWithDetails {
  categoryCode: number;
  category: string;
  amount: number;
  details: CategoryDetail[];
}

interface TransactionDetailsProps {
  type: 'income' | 'expense';
  summary: CategorySummaryWithDetails[];
  total: number;
}

// 파이차트 색상 팔레트
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export function TransactionDetails({ type, summary, total }: TransactionDetailsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isIncome = type === 'income';
  const Icon = isIncome ? TrendingUp : TrendingDown;
  const title = isIncome ? '이번 주 수입 내역' : '이번 주 지출 내역';
  const iconColor = isIncome ? '#4A9B7F' : '#E74C3C';
  const amountColor = isIncome ? 'text-[#4A9B7F]' : 'text-[#E74C3C]';

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

  // 파이차트 데이터
  const chartData = summary.map((item, idx) => ({
    ...item,
    fill: COLORS[idx % COLORS.length],
  }));

  // 선택된 카테고리의 세부항목
  const selectedCategory = activeIndex !== null ? summary[activeIndex] : null;

  return (
    <Card className="border-0 shadow-soft mt-4">
      <CardContent className="p-4 md:p-6">
        {/* 헤더 */}
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

        {/* 파이차트 + 세부항목 레이아웃 */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* 좌측: 파이차트 */}
          <div className="flex-1 min-w-0">
            <div className="h-[260px] md:h-[286px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={activeIndex !== null ? 85 : 91}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        stroke={activeIndex === index ? '#2C3E50' : 'transparent'}
                        strokeWidth={activeIndex === index ? 3 : 0}
                        style={{
                          cursor: 'pointer',
                          transform: activeIndex === index ? 'scale(1.08)' : 'scale(1)',
                          transformOrigin: 'center',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatAmount(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E8E4DE',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {chartData.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all ${
                    activeIndex === idx
                      ? 'bg-[#2C3E50] text-white'
                      : 'bg-[#F8F6F3] text-[#2C3E50] hover:bg-[#E8E4DE]'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span>{item.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 우측: 세부항목 */}
          <div className="flex-1 min-w-0 md:max-w-[50%]">
            {selectedCategory ? (
              <div className="bg-[#F8F6F3] rounded-lg p-3 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[14px] text-[#2C3E50]">
                    {selectedCategory.category} 세부
                  </h4>
                  <span className={`text-[13px] font-semibold ${amountColor}`}>
                    {formatAmount(selectedCategory.amount)}
                  </span>
                </div>
                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                  {selectedCategory.details.map((detail, idx) => {
                    const detailPercentage = selectedCategory.amount > 0
                      ? (detail.amount / selectedCategory.amount) * 100
                      : 0;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 border-b border-[#E8E4DE] last:border-0"
                      >
                        <span className="text-[13px] text-[#2C3E50]">{detail.item}</span>
                        <div className="text-right">
                          <span className={`text-[13px] font-medium ${amountColor}`}>
                            {formatAmount(detail.amount)}
                          </span>
                          <span className="text-[10px] text-[#6B7B8C] ml-1">
                            ({detailPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[#F8F6F3] rounded-lg p-3 h-full flex items-center justify-center min-h-[120px]">
                <p className="text-[13px] text-[#6B7B8C] text-center">
                  카테고리를 클릭하면<br />세부항목을 볼 수 있습니다
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
