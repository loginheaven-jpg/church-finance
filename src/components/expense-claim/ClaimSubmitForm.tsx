'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseCode {
  category_code: number;
  category_item: string;
  code: number;
  item: string;
  active: boolean;
}

interface ClaimSubmitFormProps {
  userName: string;
  onSuccess?: () => void;
}

export function ClaimSubmitForm({ userName, onSuccess }: ClaimSubmitFormProps) {
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<ExpenseCode[]>([]);
  // 서버에서 읽어온 기본 계좌 (변경 감지용)
  const [defaultAccount, setDefaultAccount] = useState({ bankName: '', accountNumber: '' });

  // 오늘 날짜 (KST) — toISOString은 항상 UTC이므로 +9h가 정확
  const todayKST = () => {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  };

  const [form, setForm] = useState({
    claimDate: todayKST(),
    categoryCode: '',
    accountCode: '',
    amount: '',
    description: '',
    bankName: '',
    accountNumber: '',
    accountHolder: userName,
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // 계정과목 코드 조회
  useEffect(() => {
    fetch('/api/codes/expense')
      .then(r => r.json())
      .then(d => { if (d.success) setCodes(d.data.filter((c: ExpenseCode) => c.active !== false)); })
      .catch(() => {});
  }, []);

  // 계좌/은행 자동 조회
  useEffect(() => {
    fetch('/api/expense-claim/account-info')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const bk = d.data.bankName || '';
          const ac = d.data.accountNumber || '';
          setForm(prev => ({ ...prev, bankName: bk, accountNumber: ac }));
          setDefaultAccount({ bankName: bk, accountNumber: ac });
        }
      })
      .catch(() => {});
  }, []);

  // 카테고리별 그룹핑
  const categories = Array.from(
    new Map(codes.map(c => [c.category_code, c.category_item])).entries()
  ).sort((a, b) => a[0] - b[0]);

  const itemsInCategory = codes.filter(
    c => String(c.category_code) === form.categoryCode
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 합니다');
      return;
    }
    setReceiptFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accountCode) { toast.error('계정과목을 선택해주세요'); return; }
    if (!form.amount || Number(form.amount.replace(/,/g, '')) <= 0) {
      toast.error('금액을 올바르게 입력해주세요'); return;
    }
    if (!form.bankName || !form.accountNumber) {
      toast.error('입금 은행과 계좌번호를 입력해주세요'); return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('claimDate', form.claimDate);
      fd.append('accountCode', form.accountCode);
      fd.append('amount', form.amount.replace(/,/g, ''));
      fd.append('description', form.description);
      fd.append('bankName', form.bankName);
      fd.append('accountNumber', form.accountNumber);
      fd.append('accountHolder', form.accountHolder);
      if (receiptFile) fd.append('receipt', receiptFile);

      const res = await fetch('/api/expense-claim/submit', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '등록 실패');
      }

      toast.success('지출청구가 등록되었습니다');

      // 계좌가 변경된 경우 기본계좌 저장 여부 확인
      const accountChanged =
        form.bankName !== defaultAccount.bankName ||
        form.accountNumber !== defaultAccount.accountNumber;
      if (accountChanged && form.bankName && form.accountNumber) {
        if (confirm('이 계좌를 기본계좌로 저장하시겠습니까?')) {
          try {
            await fetch('/api/expense-claim/account-info', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bankName: form.bankName, accountNumber: form.accountNumber }),
            });
            setDefaultAccount({ bankName: form.bankName, accountNumber: form.accountNumber });
            toast.success('기본계좌가 변경되었습니다');
          } catch {
            // 기본계좌 변경 실패해도 청구 자체는 성공
          }
        }
      }

      setForm(prev => ({
        ...prev,
        claimDate: todayKST(),
        categoryCode: '',
        accountCode: '',
        amount: '',
        description: '',
      }));
      setReceiptFile(null);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">지출청구 입력</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 청구자 (read-only) */}
          <div className="space-y-1">
            <Label>청구자</Label>
            <Input value={userName} readOnly className="bg-slate-50 text-slate-500" />
          </div>

          {/* 청구일 */}
          <div className="space-y-1">
            <Label>청구일 <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={form.claimDate}
              onChange={e => setForm(p => ({ ...p, claimDate: e.target.value }))}
              required
            />
          </div>

          {/* 계정과목 (2단계) */}
          <div className="space-y-1">
            <Label>계정과목 <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={form.categoryCode}
                onValueChange={v => setForm(p => ({ ...p, categoryCode: v, accountCode: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(([code, name]) => (
                    <SelectItem key={code} value={String(code)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.accountCode}
                onValueChange={v => setForm(p => ({ ...p, accountCode: v }))}
                disabled={!form.categoryCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="항목 선택" />
                </SelectTrigger>
                <SelectContent>
                  {itemsInCategory.map(c => (
                    <SelectItem key={c.code} value={String(c.code)}>
                      {c.code} {c.item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 금액 */}
          <div className="space-y-1">
            <Label>금액 <span className="text-red-500">*</span></Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.amount}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setForm(p => ({ ...p, amount: v ? Number(v).toLocaleString() : '' }));
              }}
              required
            />
          </div>

          {/* 내역 */}
          <div className="space-y-1">
            <Label>내역 <span className="text-red-500">*</span></Label>
            <Input
              placeholder="지출 내용을 입력하세요"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              required
            />
          </div>

          {/* 은행 / 계좌번호 / 예금주 */}
          <div className="space-y-1">
            <Label>입금 계좌 정보 <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="은행명"
                value={form.bankName}
                onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))}
                required
              />
              <Input
                placeholder="계좌번호"
                value={form.accountNumber}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setForm(p => ({ ...p, accountNumber: v }));
                }}
                required
              />
              <Input
                placeholder="예금주"
                value={form.accountHolder}
                onChange={e => setForm(p => ({ ...p, accountHolder: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* 영수증 첨부 */}
          <div className="space-y-1">
            <Label>영수증 첨부 <span className="text-slate-400 text-xs">(선택, 최대 10MB)</span></Label>
            {receiptFile ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-slate-50">
                <Paperclip className="h-4 w-4 text-slate-400" />
                <span className="text-sm flex-1 truncate">{receiptFile.name}</span>
                <button type="button" onClick={() => setReceiptFile(null)}>
                  <X className="h-4 w-4 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-2 border border-dashed rounded-md cursor-pointer hover:bg-slate-50 transition-colors">
                <Paperclip className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-500">파일 선택 (이미지, PDF)</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />등록 중...</> : '청구 등록'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
