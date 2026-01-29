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
  CalendarCheck,
  Wallet,
  Building2,
  ArrowRight,
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

interface BuildingPreview {
  targetYear: number;
  donation: number;
  interest: number;
  principal: number;
  currentLoanBalance: number;
  newLoanBalance: number;
}

interface AnnualClosingStatus {
  needsClosing: boolean;
  targetYear: number;
  carryover: {
    needsClosing: boolean;
    currentData: { year: number; balance: number; construction_balance: number } | null;
    preview: CarryoverPreview | null;
  };
  building: {
    needsClosing: boolean;
    snapshotYear: number;
    preview: BuildingPreview | null;
  };
}

export default function AnnualClosingPage() {
  const session = useFinanceSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AnnualClosingStatus | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // 이월잔액 폼 상태
  const [carryoverBalance, setCarryoverBalance] = useState('');
  const [constructionBalance, setConstructionBalance] = useState('');
  const [carryoverNote, setCarryoverNote] = useState('');
  const [carryoverSaving, setCarryoverSaving] = useState(false);
  const [carryoverDone, setCarryoverDone] = useState(false);

  // 성전봉헌 상태
  const [buildingSaving, setBuildingSaving] = useState(false);
  const [buildingDone, setBuildingDone] = useState(false);

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

        // 이월잔액이 이미 설정되어 있으면 step 2로
        if (!result.carryover.needsClosing) {
          setCarryoverDone(true);
          setStep(2);
        } else if (result.carryover.preview) {
          // 계산된 잔액을 기본값으로 설정
          setCarryoverBalance(String(result.carryover.preview.calculatedBalance));
        }

        // 성전봉헌도 완료되어 있으면
        if (!result.building.needsClosing) {
          setBuildingDone(true);
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

  // Step 1: 이월잔액 저장
  const handleSaveCarryover = async () => {
    if (!status || !carryoverBalance) {
      toast.error('이월잔액을 입력해주세요');
      return;
    }

    setCarryoverSaving(true);
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

      if (result.success || result.results?.carryover?.success) {
        toast.success('이월잔액이 저장되었습니다');
        setCarryoverDone(true);
        setStep(2);
      } else {
        toast.error(result.error || '저장 실패');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setCarryoverSaving(false);
    }
  };

  // Step 2: 성전봉헌 연마감
  const handleBuildingClosing = async () => {
    if (!status) return;

    setBuildingSaving(true);
    try {
      const res = await fetch('/api/admin/annual-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetYear: status.targetYear,
          building: true,
        }),
      });

      const result = await res.json();

      if (result.success || result.results?.building?.success) {
        toast.success('성전봉헌 연마감이 완료되었습니다');
        setBuildingDone(true);
      } else {
        toast.error(result.error || result.results?.building?.message || '연마감 실패');
      }
    } catch (error) {
      console.error('Building closing error:', error);
      toast.error('연마감 중 오류가 발생했습니다');
    } finally {
      setBuildingSaving(false);
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

  // 모두 완료된 경우
  if (carryoverDone && buildingDone) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">연마감</h1>
          <p className="text-sm text-slate-500 mt-1">
            {status.targetYear}년도 연마감이 완료되었습니다
          </p>
        </div>

        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800">연마감 완료</AlertTitle>
          <AlertDescription className="text-green-700">
            {status.targetYear}년도 일반회계 이월잔액과 성전봉헌 연마감이 모두 완료되었습니다.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
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

          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">성전봉헌 연마감</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-700">
                {formatAmount(status.building.preview?.newLoanBalance || 0)}
              </p>
              <p className="text-sm text-slate-500 mt-1">대출 잔액</p>
            </CardContent>
          </Card>
        </div>

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
            {status.targetYear}년도 회계 연마감을 진행합니다
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
        <div
          className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600 font-medium' : carryoverDone ? 'text-green-600' : 'text-slate-400'}`}
        >
          {carryoverDone ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-white'}`}>
              1
            </div>
          )}
          <span>이월잔액</span>
        </div>

        <ArrowRight className="h-4 w-4 text-slate-400" />

        <div
          className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600 font-medium' : buildingDone ? 'text-green-600' : 'text-slate-400'}`}
        >
          {buildingDone ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-white'}`}>
              2
            </div>
          )}
          <span>성전봉헌</span>
        </div>
      </div>

      {/* Step 1: 이월잔액 */}
      {step === 1 && !carryoverDone && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              <CardTitle>Step 1: 일반회계 이월잔액</CardTitle>
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
              <Button onClick={handleSaveCarryover} disabled={carryoverSaving}>
                {carryoverSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                저장하고 다음으로
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 성전봉헌 */}
      {step === 2 && !buildingDone && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              <CardTitle>Step 2: 성전봉헌 연마감</CardTitle>
            </div>
            <CardDescription>
              {status.targetYear}년도 성전봉헌 헌금 및 상환 내역을 마감합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.building.preview ? (
              <>
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">대상 연도</span>
                    <span className="font-bold">{status.building.preview.targetYear}년</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>건축헌금 합계</span>
                    <span className="font-bold">{formatAmount(status.building.preview.donation)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>이자 지출</span>
                    <span className="font-bold">{formatAmount(status.building.preview.interest)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>원금 상환</span>
                    <span className="font-bold">{formatAmount(status.building.preview.principal)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-slate-600">현재 대출 잔액</span>
                    <span>{formatAmount(status.building.preview.currentLoanBalance)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>마감 후 대출 잔액</span>
                    <span className="text-amber-600">
                      {formatAmount(status.building.preview.newLoanBalance)}
                    </span>
                  </div>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 text-sm">
                    연마감을 실행하면 {status.targetYear}년 데이터가 스냅샷으로 저장됩니다.
                    이 작업은 되돌릴 수 없으니 신중하게 진행해주세요.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  성전봉헌 연마감이 이미 완료되었습니다.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                이전으로
              </Button>
              {status.building.needsClosing && (
                <Button
                  onClick={handleBuildingClosing}
                  disabled={buildingSaving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {buildingSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  연마감 실행
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 이미 완료된 Step 표시 */}
      {carryoverDone && step === 2 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Step 1: 일반회계 이월잔액 완료</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-green-700 font-bold">
              {formatAmount(parseAmount(carryoverBalance) || status.carryover.currentData?.balance || 0)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
