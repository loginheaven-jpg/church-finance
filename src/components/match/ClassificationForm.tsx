'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { BankTransaction, IncomeCode, ExpenseCode, MatchingRule } from '@/types';

interface ClassificationFormProps {
  transaction: BankTransaction & { suggestions?: MatchingRule[] };
  incomeCodes: IncomeCode[];
  expenseCodes: ExpenseCode[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClassificationForm({
  transaction,
  incomeCodes,
  expenseCodes,
  onConfirm,
  onCancel,
}: ClassificationFormProps) {
  const isDeposit = transaction.deposit > 0;
  const [type, setType] = useState<'income' | 'expense'>(isDeposit ? 'income' : 'expense');
  const [selectedCode, setSelectedCode] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [categoryCode, setCategoryCode] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [donorName, setDonorName] = useState(transaction.detail || '');
  const [vendor, setVendor] = useState(transaction.detail || transaction.description || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 추천 분류가 있으면 자동 선택
  useEffect(() => {
    if (transaction.suggestions && transaction.suggestions.length > 0) {
      const suggestion = transaction.suggestions[0];
      setSelectedCode(suggestion.target_code);
      setSelectedName(suggestion.target_name);
      setType(suggestion.target_type === 'income' ? 'income' : 'expense');
    }
  }, [transaction.suggestions]);

  const handleCodeSelect = (code: IncomeCode | ExpenseCode) => {
    setSelectedCode(code.code);
    setSelectedName(code.item);
    setCategoryCode(code.category_code);
    setCategoryName(code.category_item);
  };

  const handleSubmit = async () => {
    if (!selectedCode || !selectedName) {
      toast.error('분류 항목을 선택하세요');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          transaction,
          classification: {
            type,
            code: selectedCode,
            name: selectedName,
            category_code: categoryCode,
            category_name: categoryName,
            donor_name: type === 'income' ? donorName : undefined,
            vendor: type === 'expense' ? vendor : undefined,
            note,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('거래가 분류되었습니다');
        onConfirm();
      } else {
        toast.error(data.error || '분류 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error(error);
      toast.error('분류 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 코드 목록을 카테고리별로 그룹화
  const groupedIncomeCodes = incomeCodes.reduce((acc, code) => {
    const key = `${code.category_code}_${code.category_item}`;
    if (!acc[key]) {
      acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
    }
    acc[key].codes.push(code);
    return acc;
  }, {} as Record<string, { category_code: number; category_item: string; codes: IncomeCode[] }>);

  const groupedExpenseCodes = expenseCodes.reduce((acc, code) => {
    const key = `${code.category_code}_${code.category_item}`;
    if (!acc[key]) {
      acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
    }
    acc[key].codes.push(code);
    return acc;
  }, {} as Record<string, { category_code: number; category_item: string; codes: ExpenseCode[] }>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">거래 분류</CardTitle>
        <div className="text-sm text-slate-500">
          {transaction.transaction_date} | {transaction.description}
        </div>
        <div className={`text-lg font-bold ${isDeposit ? 'text-green-600' : 'text-red-600'}`}>
          {isDeposit ? '+' : '-'}{(isDeposit ? transaction.deposit : transaction.withdrawal).toLocaleString()}원
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income" disabled={!isDeposit && transaction.withdrawal > 0}>
              수입
            </TabsTrigger>
            <TabsTrigger value="expense" disabled={isDeposit && transaction.deposit > 0}>
              지출
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income" className="space-y-4">
            <div className="space-y-2">
              <Label>헌금 종류</Label>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {Object.values(groupedIncomeCodes).map((group) => (
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

            <div className="space-y-2">
              <Label htmlFor="donorName">헌금자명</Label>
              <Input
                id="donorName"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="헌금자 이름"
              />
            </div>
          </TabsContent>

          <TabsContent value="expense" className="space-y-4">
            <div className="space-y-2">
              <Label>지출 항목</Label>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {Object.values(groupedExpenseCodes).map((group) => (
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

            <div className="space-y-2">
              <Label htmlFor="vendor">거래처</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="거래처명"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="note">비고</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="추가 메모"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedCode}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                분류 확정
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            취소
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
