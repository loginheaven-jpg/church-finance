'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SyncResult } from '@/types';

export function CashOfferingSync() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    if (!startDate || !endDate) {
      toast.error('시작일과 종료일을 선택하세요');
      return;
    }

    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch('/api/sync/cash-offering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data);
        toast.success(`${data.processed}건의 현금헌금을 동기화했습니다`);
      } else {
        toast.error(data.error || '동기화 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('동기화 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>현금헌금 동기화</CardTitle>
        <CardDescription>
          Google Sheets 헌금함 데이터를 수입부로 가져옵니다.
          동일 금액의 은행 입금은 자동으로 말소됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">시작일</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">종료일</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSync} disabled={syncing} className="w-full">
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              동기화 중...
            </>
          ) : (
            '구글시트에서 가져오기'
          )}
        </Button>

        {result && (
          <Alert className={result.warnings?.length ? 'border-amber-500' : 'border-green-500'}>
            {result.warnings?.length ? (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <AlertTitle>동기화 완료</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>처리된 헌금: {result.processed}건</li>
                <li>총 금액: {result.totalAmount?.toLocaleString()}원</li>
                {result.suppressedBankTransactions > 0 && (
                  <li>말소된 은행 입금: {result.suppressedBankTransactions}건</li>
                )}
              </ul>
              {result.warnings?.map((warning, idx) => (
                <p key={idx} className="text-amber-600 mt-2">⚠️ {warning}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
