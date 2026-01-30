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
  Line,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface WeekData {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

interface WeeklyChartProps {
  data: WeekData[];
  yearlyIncome?: number;
  yearlyExpense?: number;
}

const COLORS = {
  income: '#4A9B7F',
  expense: '#E74C3C',
  balance: '#D4DAE0',
};

const LABELS = {
  income: '수입',
  expense: '지출',
  balance: '잔액',
};

// 주차별 세그먼트에 색상 음영 적용 (오래된 주 = 연한색, 최근 주 = 진한색)
function getShade(baseColor: string, index: number, total: number): string {
  const opacity = 0.35 + (0.65 * index) / (total - 1 || 1);
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function WeeklyChart({ data, yearlyIncome, yearlyExpense }: WeeklyChartProps) {
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

  // 누적 가로 바차트용 데이터 변환
  // [{date, income, expense}, ...] → [{category: '수입', w0: val, w1: val, ...}, ...]
  const incomeRow: Record<string, string | number> = { category: '수입' };
  const expenseRow: Record<string, string | number> = { category: '지출' };
  data.forEach((week, i) => {
    incomeRow[`w${i}`] = week.income;
    expenseRow[`w${i}`] = week.expense;
  });
  const cumulativeData = [incomeRow, expenseRow];
  const weekKeys = data.map((_, i) => `w${i}`);

  const totalIncome = data.reduce((sum, w) => sum + w.income, 0);
  const totalExpense = data.reduce((sum, w) => sum + w.expense, 0);

  // 공통 툴팁 스타일
  const tooltipStyle = {
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 20px rgba(44, 62, 80, 0.1)',
    padding: '12px 16px',
    backgroundColor: 'white',
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

        {/* 1. 꺾은선 그래프 - 수입/지출 추이 + 잔액 막대그래프 */}
        <div className="h-[180px] md:h-[240px] mb-6">
          <p className="text-[12px] md:text-[13px] text-[#6B7B8C] mb-2 font-medium">주간 추이</p>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 40, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#6B7B8C' }}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#6B7B8C' }}
                tickFormatter={(v) => formatAmount(v)}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={(v) => formatAmount(v)}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: '#C9A962', strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div style={tooltipStyle}>
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
              {/* 잔액 막대그래프 (뒤에 배치, 연한색) */}
              <Bar
                yAxisId="right"
                dataKey="balance"
                fill={COLORS.balance}
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="income"
                stroke={COLORS.income}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: COLORS.income, strokeWidth: 0 }}
                activeDot={{ r: 5.5, strokeWidth: 2, stroke: '#fff' }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="expense"
                stroke={COLORS.expense}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: COLORS.expense, strokeWidth: 0 }}
                activeDot={{ r: 5.5, strokeWidth: 2, stroke: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 2. 가로 누적 바차트 - 8주 누적 합계 */}
        <div>
          <p className="text-[12px] md:text-[13px] text-[#6B7B8C] mb-2 font-medium">8주 누적 합계</p>
          <div className="h-[100px] md:h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cumulativeData}
                layout="vertical"
                margin={{ top: 5, right: 60, left: 5, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 13, fill: '#2C3E50', fontWeight: 600 }}
                  width={35}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(201, 169, 98, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const category = payload[0]?.payload?.category;
                    const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                    return (
                      <div style={tooltipStyle}>
                        <p style={{ fontWeight: 600, marginBottom: '8px', color: '#2C3E50' }}>
                          {category} 8주 누적: {total.toLocaleString()}원
                        </p>
                        {payload.map((entry, index) => {
                          const weekIdx = parseInt(String(entry.dataKey).replace('w', ''));
                          const weekLabel = data[weekIdx]?.date || `${weekIdx + 1}주`;
                          const val = Number(entry.value);
                          if (val === 0) return null;
                          return (
                            <p key={index} style={{ color: entry.color as string, fontSize: '13px', margin: '2px 0' }}>
                              {weekLabel}: {val.toLocaleString()}원
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {weekKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="stack"
                    radius={i === weekKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  >
                    {cumulativeData.map((_, rowIdx) => (
                      <Cell
                        key={rowIdx}
                        fill={getShade(
                          rowIdx === 0 ? COLORS.income : COLORS.expense,
                          i,
                          weekKeys.length
                        )}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* 8주 누적 합계 */}
          <div className="flex justify-end gap-4 mt-1 text-[12px] md:text-[13px] font-semibold">
            <span style={{ color: COLORS.income }}>8주 누적 수입: {formatAmount(totalIncome)}</span>
            <span style={{ color: COLORS.expense }}>8주 누적 지출: {formatAmount(totalExpense)}</span>
          </div>
          {/* 연간 누적 합계 */}
          {(yearlyIncome !== undefined || yearlyExpense !== undefined) && (
            <div className="flex justify-end gap-4 mt-1 text-[12px] md:text-[13px] font-semibold">
              <span style={{ color: COLORS.income }}>연간 수입: {formatAmount(yearlyIncome || 0)}</span>
              <span style={{ color: COLORS.expense }}>연간 지출: {formatAmount(yearlyExpense || 0)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
