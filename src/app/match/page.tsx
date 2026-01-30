'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2, RefreshCw, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { TransactionCard } from '@/components/match/TransactionCard';
import { ClassificationForm } from '@/components/match/ClassificationForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BankTransaction, CardTransaction, IncomeCode, ExpenseCode, MatchingRule } from '@/types';

interface UnmatchedData {
  bank: (BankTransaction & { suggestions?: MatchingRule[] })[];
  card: CardTransaction[];
  total: number;
}

export default function MatchPage() {
  const [loading, setLoading] = useState(true);
  const [autoMatching, setAutoMatching] = useState(false);
  const [data, setData] = useState<UnmatchedData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<(BankTransaction & { suggestions?: MatchingRule[] }) | null>(null);
  const [incomeCodes, setIncomeCodes] = useState<IncomeCode[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);

  // 매칭 규칙 현황
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<MatchingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  const fetchUnmatched = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/match/unmatched');
      const result = await res.json();

      if (result.success) {
        setData(result);
      } else {
        toast.error(result.error || '데이터 조회 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchCodes = async () => {
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        fetch('/api/codes/income'),
        fetch('/api/codes/expense'),
      ]);

      const incomeData = await incomeRes.json();
      const expenseData = await expenseRes.json();

      if (incomeData.success) setIncomeCodes(incomeData.data);
      if (expenseData.success) setExpenseCodes(expenseData.data);
    } catch (error) {
      console.error('Failed to fetch codes:', error);
    }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/settings/matching-rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    fetchUnmatched();
    fetchCodes();
  }, []);

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await fetch('/api/match/auto', { method: 'POST' });
      const result = await res.json();

      if (result.success) {
        toast.success(result.message);
        fetchUnmatched();
      } else {
        toast.error(result.error || '자동 매칭 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('자동 매칭 중 오류가 발생했습니다');
    } finally {
      setAutoMatching(false);
    }
  };

  const handleConfirm = () => {
    setSelectedTransaction(null);
    fetchUnmatched();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">거래 매칭</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowRules(!showRules);
              if (!showRules && rules.length === 0) fetchRules();
            }}
          >
            <Zap className="mr-2 h-4 w-4" />
            매칭규칙 현황
            {showRules ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={fetchUnmatched}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          <Button onClick={handleAutoMatch} disabled={autoMatching}>
            {autoMatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                자동 매칭 중...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                자동 매칭 실행
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 매칭규칙 현황 패널 */}
      {showRules && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5" />
              자동 매칭 규칙
            </CardTitle>
            <CardDescription>
              수동 분류 시 자동으로 학습됩니다. ({rules.length}개)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                학습된 매칭 규칙이 없습니다
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>유형</TableHead>
                      <TableHead>패턴</TableHead>
                      <TableHead>대상 항목</TableHead>
                      <TableHead className="text-right">신뢰도</TableHead>
                      <TableHead className="text-right">사용</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            rule.rule_type === 'bank_income'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {rule.rule_type === 'bank_income' ? '수입' : '지출'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-[150px] truncate">
                          {rule.pattern}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{rule.target_name}</div>
                            <div className="text-slate-500 text-xs">코드: {rule.target_code}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${
                            rule.confidence >= 0.8 ? 'text-green-600' :
                            rule.confidence >= 0.6 ? 'text-amber-600' : 'text-slate-500'
                          }`}>
                            {Math.round(rule.confidence * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{rule.usage_count}회</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 미매칭 거래 목록 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>미매칭 은행 거래</CardTitle>
              <CardDescription>
                {data?.bank.length || 0}건의 거래가 분류되지 않았습니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {data?.bank.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  모든 거래가 분류되었습니다
                </div>
              ) : (
                data?.bank.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    isSelected={selectedTransaction?.id === tx.id}
                    onSelect={() => setSelectedTransaction(tx)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {data?.card && data.card.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>미완료 카드 거래</CardTitle>
                <CardDescription>
                  {data.card.length}건의 카드 거래가 상세입력 대기 중입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="/card-details">카드내역 상세입력으로 이동</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 분류 폼 */}
        <div>
          {selectedTransaction ? (
            <ClassificationForm
              transaction={selectedTransaction}
              incomeCodes={incomeCodes}
              expenseCodes={expenseCodes}
              onConfirm={handleConfirm}
              onCancel={() => setSelectedTransaction(null)}
            />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-slate-500">
                <p>거래를 선택하여 분류하세요</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
