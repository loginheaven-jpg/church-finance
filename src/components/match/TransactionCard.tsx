'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, ArrowUpCircle, Calendar, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BankTransaction, MatchingRule } from '@/types';

interface TransactionCardProps {
  transaction: BankTransaction & { suggestions?: MatchingRule[] };
  isSelected: boolean;
  onSelect: () => void;
}

export function TransactionCard({ transaction, isSelected, onSelect }: TransactionCardProps) {
  const isDeposit = transaction.deposit > 0;
  const amount = isDeposit ? transaction.deposit : transaction.withdrawal;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500 bg-blue-50'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-full',
              isDeposit ? 'bg-green-100' : 'bg-red-100'
            )}>
              {isDeposit ? (
                <ArrowDownCircle className="h-5 w-5 text-green-600" />
              ) : (
                <ArrowUpCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">
                {transaction.description || transaction.detail || '내역 없음'}
              </div>
              <div className="text-sm text-slate-500 truncate">
                {transaction.detail && transaction.detail !== transaction.description
                  ? transaction.detail
                  : transaction.memo || ''}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {transaction.transaction_date}
                </span>
                {transaction.branch && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {transaction.branch}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn(
              'font-bold',
              isDeposit ? 'text-green-600' : 'text-red-600'
            )}>
              {isDeposit ? '+' : '-'}{amount.toLocaleString()}원
            </div>
            <div className="text-xs text-slate-400 mt-1">
              잔액: {transaction.balance.toLocaleString()}원
            </div>
          </div>
        </div>

        {transaction.suggestions && transaction.suggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-slate-500 mb-2">추천 분류:</div>
            <div className="flex flex-wrap gap-2">
              {transaction.suggestions.slice(0, 2).map((rule) => (
                <Button
                  key={rule.id}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                  }}
                >
                  {rule.target_name} ({Math.round(rule.confidence * 100)}%)
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
