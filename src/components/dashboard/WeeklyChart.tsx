'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface WeekData {
  date: string;
  income: number;
  expense: number;
}

interface WeeklyChartProps {
  data: WeekData[];
}

const COLORS = {
  income: '#4A9B7F',
  expense: '#E74C3C',
};

const LABELS = {
  income: '수입',
  expense: '지출',
};

export function WeeklyChart({ data }: WeeklyChartProps) {
  const formatAmount = (value: number) => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(1)}억`;
    }
    if (value >= 1000000) {
      return `${Math.round(value / 1000000)}백만`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(0)}만`;
    }
    return value.toLocaleString();
  };

  return (
    <Card className="border-0 shadow-soft">
      <CardContent className="p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div
              className="w-5 h-5 md:w-[22px] md:h-[22px] flex items-center justify-center"
              style={{ color: '#C9A962' }}
            >
              <BarChart3 className="w-full h-full" />
            </div>
            <h3 className="font-display text-[16px] md:text-[20px] font-semibold text-[#2C3E50]">
              최근 8주 재정 현황
            </h3>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {Object.entries(LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1 md:gap-1.5">
                <div
                  className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm"
                  style={{ backgroundColor: COLORS[key as keyof typeof COLORS] }}
                />
                <span className="text-[12px] md:text-[14px] text-[#6B7B8C]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-[280px] md:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 30, right: 10, left: 10, bottom: 10 }}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6B7B8C' }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(201, 169, 98, 0.1)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  return (
                    <div
                      style={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 20px rgba(44, 62, 80, 0.1)',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                      }}
                    >
                      <p style={{ fontWeight: 600, marginBottom: '8px', color: '#2C3E50' }}>{label}</p>
                      {payload.map((entry, index) => {
                        const entryLabel = LABELS[entry.dataKey as keyof typeof LABELS] || entry.dataKey;
                        return (
                          <p key={index} style={{ color: entry.color, fontSize: '14px', margin: '4px 0' }}>
                            {entryLabel}: {Number(entry.value).toLocaleString()}원
                          </p>
                        );
                      })}
                    </div>
                  );
                }}
              />

              <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS.income} />
                ))}
                <LabelList
                  dataKey="income"
                  position="top"
                  fill="#4A9B7F"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(value) => {
                    const num = Number(value);
                    return num > 0 ? formatAmount(num) : '';
                  }}
                />
              </Bar>

              <Bar dataKey="expense" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS.expense} />
                ))}
                <LabelList
                  dataKey="expense"
                  position="top"
                  fill="#E74C3C"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(value) => {
                    const num = Number(value);
                    return num > 0 ? formatAmount(num) : '';
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
