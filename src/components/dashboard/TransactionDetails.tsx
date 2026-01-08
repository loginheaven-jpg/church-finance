'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Transaction {
  date: string;
  description: string;
  category: string;
  amount: number;
}

interface TransactionDetailsProps {
  type: 'income' | 'expense';
  transactions: Transaction[];
}

export function TransactionDetails({ type, transactions }: TransactionDetailsProps) {
  const isIncome = type === 'income';
  const Icon = isIncome ? TrendingUp : TrendingDown;
  const title = isIncome ? '이번 주 수입 내역' : '이번 주 지출 내역';
  const iconColor = isIncome ? '#4A9B7F' : '#E74C3C';
  const amountColor = isIncome ? 'text-[#4A9B7F]' : 'text-[#E74C3C]';

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (transactions.length === 0) {
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

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[#6B7B8C]">날짜</TableHead>
                <TableHead className="text-[#6B7B8C]">내용</TableHead>
                <TableHead className="text-[#6B7B8C]">분류</TableHead>
                <TableHead className="text-right text-[#6B7B8C]">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction, idx) => (
                <TableRow key={idx} className="hover:bg-[#F8F6F3]">
                  <TableCell className="text-[#2C3E50]">{transaction.date}</TableCell>
                  <TableCell className="text-[#2C3E50] font-medium">{transaction.description}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-[#F8F6F3] text-[#6B7B8C]">
                      {transaction.category}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${amountColor}`}>
                    {formatAmount(transaction.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
