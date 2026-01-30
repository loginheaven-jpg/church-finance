'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import { useRouter } from 'next/navigation';

interface CarryoverPreview {
  targetYear: number;
  prevBalance: number;
  totalIncome: number;
  totalExpense: number;
  calculatedBalance: number;
  lastBankBalance: number;
  lastBankDate: string | null;
  difference: number;
}

interface AnnualClosingStatus {
  needsClosing: boolean;
  targetYear: number;
  carryover: {
    needsClosing: boolean;
    currentData: { year: number; balance: number; construction_balance: number } | null;
    preview: CarryoverPreview | null;
  };
}

export default function AnnualClosingPage() {
  const session = useFinanceSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AnnualClosingStatus | null>(null);

  // 이월잔액 폼 상태
  const [carryoverBalance, setCarryoverBalance] = useState('');
  const [constructionBalance, setConstructionBalance] = useState('');
  const [carryoverNote, setCarryoverNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // super_admin 체크
  useEffect(() => {
    if (session && session.finance_role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [session, router]);

  // 상태 로드
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/annual-closing');
      const result = await res.json();

      if (result.success) {
        setStatus(result);

        if (!result.carryover.needsClosing) {
          setDone(true);
        } else if (result.carryover.preview) {
          setCarryoverBalance(String(result.carryover.preview.calculatedBalance));
        }
      }
    } catch (error) {
      console.error('Status load error:', error);
      toast.error('연마감 상태를 불러오는 데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => amount.toLocaleString() + '원';

  const formatInputAmount = (value: string) => {
    const num = value.replace(/[^\d-]/g, '');
    if (!num || num === '-') return num;
    const isNegative = num.startsWith('-');
    const absNum = num.replace('-', '');
    const formatted = absNum ? Number(absNum).toLocaleString() : '';
    return isNegative ? '-' + formatted : formatted;
  };

  const parseAmount = (value: string) => {
    return Number(value.replace(/[^\d-]/g, '')) || 0;
  };

  const handleSave = async () => {
    if (!status || !carryoverBalance) {
      toast.error('이월잔액을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/annual-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetYear: status.targetYear,
          carryover: {
            balance: parseAmount(carryoverBalance),
            construction_balance: parseAmount(constructionBalance),
            note: carryoverNote || `${status.targetYear}년 연마감`,
          },
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success('이월잔액이 저장되었습니다');
        setDone(true);
      } else {
        toast.error(result.error || '저장 실패');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">연마감 상태 확인 중...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-slate-600">연마감 상태를 불러올 수 없습니다</p>
        <Button onClick={loadStatus}>다시 시도</Button>
      </div>
    );
  }

  // 완료된 경우
  if (done) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">연마감</h1>
          <p className="text-sm text-slate-500 mt-1">
            {status.targetYear}년도 이월잔액이 설정되었습니다
          </p>
        </div>

        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800">이월잔액 설정 완료</AlertTitle>
          <AlertDescription className="text-green-700">
            {status.targetYear}년도 일반회계 이월잔액이 저장되었습니다.
          </AlertDescription>
        </Alert>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">일반회계 이월잔액</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {formatAmount(parseAmount(carryoverBalance) || status.carryover.currentData?.balance || 0)}
            </p>
            <p className="text-sm text-slate-500 mt-1">{status.targetYear}년 말 기준</p>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          대시보드로 이동
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">연마감</h1>
          <p className="text-sm text-slate-500 mt-1">
            {status.targetYear}년도 이월잔액을 설정합니다
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 이월잔액 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            <CardTitle>일반회계 이월잔액</CardTitle>
          </div>
          <CardDescription>
            {status.targetYear}년 말 기준 일반회계 이월잔액을 확정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 계산 내역 */}
          {status.carryover.preview && (
            <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">전년 이월잔액 ({status.targetYear - 1}년)</span>
                <span>{formatAmount(status.carryover.preview.prevBalance)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>+ 연간 수입</span>
                <span>{formatAmount(status.carryover.preview.totalIncome)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>- 연간 지출</span>
                <span>{formatAmount(status.carryover.preview.totalExpense)}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between font-bold">
                <span>= 계산 잔액</span>
                <span className="text-blue-600">
                  {formatAmount(status.carryover.preview.calculatedBalance)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>
                  은행원장 잔액
                  {status.carryover.preview.lastBankDate && ` (${status.carryover.preview.lastBankDate})`}
                </span>
                <span>{formatAmount(status.carryover.preview.lastBankBalance)}</span>
              </div>
              {status.carryover.preview.difference !== 0 && (
                <div className="flex justify-between text-amber-600 font-medium pt-2 border-t">
                  <span>차액</span>
                  <span>{formatAmount(Math.abs(status.carryover.preview.difference))}</span>
                </div>
              )}
            </div>
          )}

          {/* 입력 폼 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>일반회계 이월잔액</Label>
              <Input
                value={carryoverBalance}
                onChange={(e) => setCarryoverBalance(formatInputAmount(e.target.value))}
                placeholder="0"
                className="text-right text-lg"
              />
              <p className="text-xs text-slate-500">
                위 계산 잔액을 기본값으로 설정했습니다. 필요시 수정하세요.
              </p>
            </div>

            <div className="space-y-2">
              <Label>건축회계 이월잔액 (선택)</Label>
              <Input
                value={constructionBalance}
                onChange={(e) => setConstructionBalance(formatInputAmount(e.target.value))}
                placeholder="0"
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <Label>비고</Label>
              <Textarea
                value={carryoverNote}
                onChange={(e) => setCarryoverNote(e.target.value)}
                placeholder="연마감 메모"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              저장
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
