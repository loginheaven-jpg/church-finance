'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Heart, Building2, Globe, Calendar } from 'lucide-react';
import type { OfferingType, PledgePeriod, Pledge } from '@/types';

interface PledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donorName: string;
  representative?: string;
  defaultOfferingType?: OfferingType;
  existingPledge?: Pledge | null;
  onSuccess?: () => void;
}

const OFFERING_TYPES: { value: OfferingType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'building', label: '성전봉헌', icon: <Building2 className="h-5 w-5" />, description: '건축 대출 상환' },
  { value: 'mission', label: '선교', icon: <Globe className="h-5 w-5" />, description: '선교사역 지원' },
  { value: 'weekly', label: '주정', icon: <Calendar className="h-5 w-5" />, description: '주일 헌금' },
];

const PLEDGE_PERIODS: { value: PledgePeriod; label: string; multiplier: number; amountLabel: string }[] = [
  { value: 'weekly', label: '주정', multiplier: 52, amountLabel: '주별 작정금액' },
  { value: 'monthly', label: '월정', multiplier: 12, amountLabel: '월별 작정금액' },
  { value: 'yearly', label: '연간', multiplier: 1, amountLabel: '연간 작정금액' },
];

export function PledgeModal({
  open,
  onOpenChange,
  donorName,
  representative,
  defaultOfferingType,
  existingPledge,
  onSuccess,
}: PledgeModalProps) {
  const currentYear = new Date().getFullYear();

  const [offeringType, setOfferingType] = useState<OfferingType>(defaultOfferingType || 'building');
  const [pledgePeriod, setPledgePeriod] = useState<PledgePeriod>('monthly');
  const [amount, setAmount] = useState<string>('');
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);
  const [memo, setMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기존 작정 편집 모드
  useEffect(() => {
    if (existingPledge) {
      setOfferingType(existingPledge.offering_type);
      setPledgePeriod(existingPledge.pledge_period);
      setAmount(existingPledge.amount.toString());
      setYear(existingPledge.year);
      setStartMonth(existingPledge.start_month);
      setEndMonth(existingPledge.end_month);
      setMemo(existingPledge.memo || '');
    } else {
      // 새 작정 모드
      setOfferingType(defaultOfferingType || 'building');
      setPledgePeriod('monthly');
      setAmount('');
      setYear(currentYear);
      setStartMonth(1);
      setEndMonth(12);
      setMemo('');
    }
  }, [existingPledge, defaultOfferingType, currentYear, open]);

  // 연간 환산 금액 계산
  const yearlyAmount = (() => {
    const numAmount = parseInt(amount.replace(/,/g, '')) || 0;
    const period = PLEDGE_PERIODS.find(p => p.value === pledgePeriod);
    if (!period) return 0;

    if (pledgePeriod === 'monthly') {
      const months = endMonth - startMonth + 1;
      return numAmount * months;
    }
    return numAmount * period.multiplier;
  })();

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setAmount(formatAmount(parseInt(value)));
    } else {
      setAmount('');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const numAmount = parseInt(amount.replace(/,/g, '')) || 0;
      if (numAmount <= 0) {
        setError('금액을 입력해주세요');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        donor_name: donorName,
        representative: representative || donorName,
        offering_type: offeringType,
        pledge_period: pledgePeriod,
        amount: numAmount,
        year,
        start_month: startMonth,
        end_month: endMonth,
        memo,
      };

      const url = existingPledge
        ? `/api/pledges/${existingPledge.id}`
        : '/api/pledges';
      const method = existingPledge ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '작정 등록에 실패했습니다');
        setIsSubmitting(false);
        return;
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError('작정 등록 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountLabel = PLEDGE_PERIODS.find(p => p.value === pledgePeriod)?.amountLabel || '작정금액';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] pt-10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-rose-500" />
            {existingPledge ? `${donorName}님 작정 수정` : `${donorName}님 헌금작정`}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 italic">
            "각각 그 마음에 정한 대로 할 것이요 인색함으로나 억지로 하지 말지니<br />
            하나님은 즐겨 내는 자를 사랑하시느니라" (고후 9:7)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {/* 헌금 종류 선택 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">헌금 종류</Label>
            <div className="grid grid-cols-3 gap-2">
              {OFFERING_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setOfferingType(type.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                    offeringType === type.value
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {type.icon}
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 작정 주기 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">작정 주기</Label>
            <div className="flex gap-2">
              {PLEDGE_PERIODS.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => setPledgePeriod(period.value)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    pledgePeriod === period.value
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* 작정 금액 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">{amountLabel}</Label>
            <div className="relative">
              <Input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="text-right pr-8 text-lg font-semibold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">원</span>
            </div>
          </div>

          {/* 작정 기간 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">작정 기간</Label>
            <div className="flex items-center gap-2">
              <Select
                value={year.toString()}
                onValueChange={(v) => setYear(parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={startMonth.toString()}
                onValueChange={(v) => setStartMonth(parseInt(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-slate-500">~</span>
              <Select
                value={endMonth.toString()}
                onValueChange={(v) => setEndMonth(parseInt(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 총 작정금액 */}
          {yearlyAmount > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-700 font-medium">총 작정금액 (연간)</p>
              <p className="text-xl font-bold text-green-700">
                {formatAmount(yearlyAmount)}원
              </p>
              {offeringType === 'building' && yearlyAmount >= 1000000 && (
                <p className="text-xs text-green-600 mt-1">
                  이 금액으로 대출 이자 약 {Math.floor(yearlyAmount / 5000000)}개월분을 갚을 수 있습니다!
                </p>
              )}
            </div>
          )}

          {/* 메모 */}
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">감사노트 (선택)</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="감사의 마음으로 드립니다..."
              className="resize-none h-6"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Heart className="mr-2 h-4 w-4" />
                {existingPledge ? '수정하기' : '작정하기'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
