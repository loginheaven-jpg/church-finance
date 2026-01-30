'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CreditCard, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { CardTransaction, ExpenseCode } from '@/types';

// 날짜 포맷 함수 (숫자 시리얼 번호 또는 문자열 처리)
function formatDate(value: string | number | undefined | null): string {
  if (!value && value !== 0) return '-';

  // 숫자인 경우 (Google Sheets 시리얼 번호)
  if (typeof value === 'number') {
    // Excel/Google Sheets 날짜 시리얼 번호 변환 (1899-12-30 기준)
    const date = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '-';
  }

  // 문자열인 경우
  const str = String(value).trim();
  if (!str) return '-';

  // 이미 날짜 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0];
  }

  // 숫자 문자열인 경우 (시리얼 번호가 문자열로 전달된 경우)
  const num = Number(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return str || '-';
}

export default function CardDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);
  const [selectedTx, setSelectedTx] = useState<CardTransaction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폼 상태
  const [purpose, setPurpose] = useState('');
  const [selectedCode, setSelectedCode] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, codesRes] = await Promise.all([
        fetch('/api/card/my-transactions'),
        fetch('/api/codes/expense'),
      ]);

      const txData = await txRes.json();
      const codesData = await codesRes.json();

      if (txData.success) setTransactions(txData.data);
      if (codesData.success) setExpenseCodes(codesData.data);
    } catch (error) {
      console.error(error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    // 캐시 무효화 후 데이터 새로고침
    await fetch('/api/cache/invalidate', { method: 'POST' });
    await fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectTx = (tx: CardTransaction) => {
    setSelectedTx(tx);
    setPurpose(tx.purpose || tx.merchant);
    setSelectedCode(tx.account_code || null);
  };

  const handleCodeSelect = (code: ExpenseCode) => {
    setSelectedCode(code.code);
  };

  const handleSubmit = async () => {
    if (!selectedTx || !purpose || !selectedCode) {
      toast.error('사용목적과 계정과목을 입력하세요');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/card/submit-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          transaction: selectedTx,
          details: {
            purpose,
            account_code: selectedCode,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('카드내역이 저장되었습니다');
        setSelectedTx(null);
        fetchData();
      } else {
        toast.error(data.error || '저장 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error(error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 코드 그룹화
  const groupedCodes = expenseCodes.reduce((acc, code) => {
    const key = `${code.category_code}_${code.category_item}`;
    if (!acc[key]) {
      acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
    }
    acc[key].codes.push(code);
    return acc;
  }, {} as Record<string, { category_code: number; category_item: string; codes: ExpenseCode[] }>);

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
        <h1 className="text-3xl font-bold text-slate-900">카드내역 상세입력</h1>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            미완료 카드 거래
          </CardTitle>
          <CardDescription>
            {transactions.length}건의 카드 거래가 상세입력 대기 중입니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              모든 카드 거래가 입력 완료되었습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이용일</TableHead>
                  <TableHead>카드소유자</TableHead>
                  <TableHead>가맹점</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.sale_date) !== '-' ? formatDate(tx.sale_date) : formatDate(tx.billing_date)}</TableCell>
                    <TableCell>{tx.card_owner || '미지정'}</TableCell>
                    <TableCell>{tx.merchant}</TableCell>
                    <TableCell className="text-right font-medium">
                      {tx.sale_amount.toLocaleString()}원
                    </TableCell>
                    <TableCell>
                      {tx.detail_completed ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          완료
                        </span>
                      ) : (
                        <span className="text-amber-600">대기</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectTx(tx)}
                        disabled={tx.detail_completed}
                      >
                        입력
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 상세입력 다이얼로그 */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>카드내역 상세입력</DialogTitle>
            <DialogDescription>
              {selectedTx?.merchant} | {selectedTx?.sale_amount.toLocaleString()}원
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="purpose">사용목적</Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="카드 사용 목적을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label>계정과목</Label>
              <div className="space-y-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {Object.values(groupedCodes).map((group) => (
                  <div key={group.category_code}>
                    <div className="text-xs text-slate-500 mb-1">{group.category_item}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.codes.map((code) => (
                        <Button
                          key={code.code}
                          variant={selectedCode === code.code ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleCodeSelect(code)}
                        >
                          {code.item}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !purpose || !selectedCode}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    저장
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setSelectedTx(null)}>
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
