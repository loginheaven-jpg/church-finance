'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Paperclip, X, HelpCircle, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-compress';

interface ExpenseCode {
  category_code: number;
  category_item: string;
  code: number;
  item: string;
  active: boolean;
}

interface LineItem {
  id: string;
  categoryCode: string;
  accountCode: string;
  amount: string;
  description: string;
  receiptFiles: File[];
  receiptPaths: string[];   // Supabase 업로드 완료 후 경로들
  uploading: boolean;       // 업로드 중 여부
}

interface GroupedClaim {
  accountCode: string;
  accountCodeName: string;
  totalAmount: number;
  descriptions: string[];
  receiptPaths: string[];   // Supabase에 업로드된 파일 경로들
  itemCount: number;
}

interface ClaimSubmitFormProps {
  userName: string;
  onSuccess?: () => void;
}

const todayKST = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const makeId = () => Math.random().toString(36).slice(2, 8);

const parseAmount = (s: string) => Number(s.replace(/,/g, '')) || 0;

export function ClaimSubmitForm({ userName, onSuccess }: ClaimSubmitFormProps) {
  const [loading, setLoading] = useState(false);
  const [codes, setCodes] = useState<ExpenseCode[]>([]);
  const [defaultAccount, setDefaultAccount] = useState({ bankName: '', accountNumber: '' });
  const [showGuide, setShowGuide] = useState(false);

  // 공통 정보
  const [shared, setShared] = useState({
    claimDate: todayKST(),
    bankName: '',
    accountNumber: '',
    accountHolder: userName,
  });

  // 라인 아이템 배열
  const [items, setItems] = useState<LineItem[]>([
    { id: makeId(), categoryCode: '', accountCode: '', amount: '', description: '', receiptFiles: [], receiptPaths: [], uploading: false },
  ]);

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
          setShared(prev => ({ ...prev, bankName: bk, accountNumber: ac }));
          setDefaultAccount({ bankName: bk, accountNumber: ac });
        }
      })
      .catch(() => {});
  }, []);

  // 카테고리별 그룹핑
  const categories = Array.from(
    new Map(codes.map(c => [c.category_code, c.category_item])).entries()
  ).sort((a, b) => a[0] - b[0]);

  const getItemsInCategory = (catCode: string) =>
    codes.filter(c => String(c.category_code) === catCode);

  const getCodeName = (code: string) => {
    const found = codes.find(c => String(c.code) === code);
    return found ? `${found.code} ${found.item}` : code;
  };

  // 라인 아이템 조작
  const updateItem = (id: string, field: keyof LineItem, value: string | File | null) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    const lastItem = items[items.length - 1];
    setItems(prev => [...prev, {
      id: makeId(),
      categoryCode: lastItem?.categoryCode || '',
      accountCode: '',
      amount: '',
      description: '',
      receiptFiles: [],
      receiptPaths: [],
      uploading: false,
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // 계정코드별 자동 그룹핑
  const grouped = useMemo((): GroupedClaim[] => {
    const map = new Map<string, GroupedClaim>();
    for (const item of items) {
      if (!item.accountCode || !item.amount) continue;
      const amt = parseAmount(item.amount);
      if (amt <= 0) continue;
      const existing = map.get(item.accountCode);
      if (existing) {
        existing.totalAmount += amt;
        if (item.description) existing.descriptions.push(item.description);
        existing.receiptPaths.push(...item.receiptPaths);
        existing.itemCount++;
      } else {
        map.set(item.accountCode, {
          accountCode: item.accountCode,
          accountCodeName: getCodeName(item.accountCode),
          totalAmount: amt,
          descriptions: item.description ? [item.description] : [],
          receiptPaths: [...item.receiptPaths],
          itemCount: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [items, codes]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = grouped.reduce((s, g) => s + g.totalAmount, 0);

  // 파일 선택 → 압축 → Supabase 직접 업로드 (복수 파일 지원)
  const handleFileChange = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      if (fileList[i].size > 20 * 1024 * 1024) {
        toast.error(`${fileList[i].name}: 파일 크기는 20MB 이하여야 합니다`);
        return;
      }
      newFiles.push(fileList[i]);
    }

    // 기존 파일에 추가
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, uploading: true, receiptFiles: [...item.receiptFiles, ...newFiles] } : item
    ));

    try {
      const uploadedPaths: string[] = [];
      for (const rawFile of newFiles) {
        // 이미지 압축 (800px, JPEG 80%)
        const compressed = await compressImage(rawFile);

        // signed upload URL 요청
        const urlRes = await fetch('/api/expense-claim/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: compressed.name, contentType: compressed.type }),
        });
        const urlData = await urlRes.json();
        if (!urlData.success) throw new Error(urlData.error || 'URL 발급 실패');

        // Supabase에 직접 업로드
        const uploadRes = await fetch(urlData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': compressed.type },
          body: compressed,
        });
        if (!uploadRes.ok) throw new Error(`${rawFile.name} 업로드 실패`);

        uploadedPaths.push(urlData.filePath);
      }

      // 경로 추가 저장
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, receiptPaths: [...item.receiptPaths, ...uploadedPaths] } : item
      ));
      toast.success(`영수증 ${newFiles.length}장 업로드 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '영수증 업로드 실패');
      // 실패 시 추가했던 파일 제거
      setItems(prev => prev.map(item =>
        item.id === itemId ? {
          ...item,
          receiptFiles: item.receiptFiles.filter(f => !newFiles.includes(f)),
        } : item
      ));
    } finally {
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, uploading: false } : item
      ));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검증
    const validItems = items.filter(item => item.accountCode && parseAmount(item.amount) > 0);
    if (validItems.length === 0) {
      toast.error('최소 1개 이상의 항목을 입력해주세요');
      return;
    }
    for (const item of validItems) {
      if (!item.description) {
        toast.error(`내역을 입력해주세요 (${getCodeName(item.accountCode)})`);
        return;
      }
    }
    if (!shared.bankName || !shared.accountNumber) {
      toast.error('입금 은행과 계좌번호를 입력해주세요');
      return;
    }

    // 업로드 중인 파일이 있는지 확인
    if (items.some(item => item.uploading)) {
      toast.error('영수증 업로드가 진행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 파일은 이미 Supabase에 업로드됨 → 경로만 JSON으로 전송
      const groupsData = grouped.map(g => ({
        accountCode: g.accountCode,
        amount: g.totalAmount,
        description: g.descriptions.join(', '),
        receiptPaths: g.receiptPaths,  // 이미 업로드된 경로 배열
      }));

      const res = await fetch('/api/expense-claim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimDate: shared.claimDate,
          bankName: shared.bankName,
          accountNumber: shared.accountNumber,
          accountHolder: shared.accountHolder,
          groups: groupsData,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '등록 실패');
      }

      const claimCount = grouped.length;
      toast.success(`${claimCount}건의 지출청구가 등록되었습니다`);

      // 계좌 변경 시 기본계좌 저장 확인
      const accountChanged =
        shared.bankName !== defaultAccount.bankName ||
        shared.accountNumber !== defaultAccount.accountNumber;
      if (accountChanged && shared.bankName && shared.accountNumber) {
        if (confirm('이 계좌를 기본계좌로 저장하시겠습니까?')) {
          try {
            await fetch('/api/expense-claim/account-info', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bankName: shared.bankName, accountNumber: shared.accountNumber }),
            });
            setDefaultAccount({ bankName: shared.bankName, accountNumber: shared.accountNumber });
            toast.success('기본계좌가 변경되었습니다');
          } catch { /* 실패해도 청구 자체는 성공 */ }
        }
      }

      // 초기화
      setShared(prev => ({ ...prev, claimDate: todayKST() }));
      setItems([{ id: makeId(), categoryCode: '', accountCode: '', amount: '', description: '', receiptFiles: [], receiptPaths: [], uploading: false }]);
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
          {/* 공통: 청구자 + 청구일 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>청구자</Label>
              <Input value={userName} readOnly className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-1">
              <Label>청구일 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={shared.claimDate}
                onChange={e => setShared(p => ({ ...p, claimDate: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* 공통: 입금 계좌 정보 */}
          <div className="space-y-1">
            <Label>입금 계좌 정보 <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="은행명"
                value={shared.bankName}
                onChange={e => setShared(p => ({ ...p, bankName: e.target.value }))}
                required
              />
              <Input
                placeholder="계좌번호"
                value={shared.accountNumber}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setShared(p => ({ ...p, accountNumber: v }));
                }}
                required
              />
              <Input
                placeholder="예금주"
                value={shared.accountHolder}
                onChange={e => setShared(p => ({ ...p, accountHolder: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* 계정과목 가이드 */}
          <div className="flex items-center gap-1">
            <Label>지출 항목</Label>
            <button type="button" onClick={() => setShowGuide(p => !p)} className="text-slate-400 hover:text-blue-500">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          {showGuide && (
            <div className="inline-block text-xs border border-blue-200 rounded-md overflow-hidden max-w-[280px]">
              <div className="bg-blue-100 px-3 py-1.5 font-semibold text-blue-700">어떤 코드를 선택해야 하나요?</div>
              {[
                ['교역자 식대', '14'],
                ['선교사/강사비, 접대비', '32'],
                ['큐티책, 강사료, 수련회', '41'],
                ['가정교회 세미나', '45'],
                ['목자목녀 행사', '45'],
                ['생일, 세례 축하', '46'],
                ['예봄성도 심방', '46'],
                ['만나실 식재료', '47'],
                ['행복쉼터 (카페)', '47'],
                ['내부성도 구호', '52'],
                ['외부/지역 구호', '53'],
                ['주유, 차수리', '65'],
                ['시설 수리비', '66'],
                ['사무용품', '74'],
              ].map(([desc, code], i) => (
                <div key={`${desc}-${code}`} className={`flex justify-between px-3 py-0.5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <span className="text-slate-600">{desc}</span>
                  <span className="font-mono text-blue-600 ml-4">{code}</span>
                </div>
              ))}
              <div className="px-3 py-1.5 text-slate-400 bg-slate-50 border-t">카테고리 코드 앞 2자리로 선택</div>
            </div>
          )}

          {/* 라인 아이템 목록 */}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const catItems = getItemsInCategory(item.categoryCode);
              return (
                <div key={item.id} className="relative border rounded-lg p-3 space-y-2 bg-slate-50/50">
                  {/* 항목 번호 + 삭제 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">항목 {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* 계정코드 (2단계) */}
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={item.categoryCode}
                      onValueChange={v => {
                        updateItem(item.id, 'categoryCode', v);
                        updateItem(item.id, 'accountCode', '');
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="카테고리" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(([code, name]) => (
                          <SelectItem key={code} value={String(code)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.accountCode}
                      onValueChange={v => updateItem(item.id, 'accountCode', v)}
                      disabled={!item.categoryCode}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="항목" />
                      </SelectTrigger>
                      <SelectContent>
                        {catItems.map(c => (
                          <SelectItem key={c.code} value={String(c.code)}>
                            {c.code} {c.item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 금액 + 내역 */}
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="금액"
                      className="h-9 text-sm"
                      value={item.amount}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9]/g, '');
                        updateItem(item.id, 'amount', v ? Number(v).toLocaleString() : '');
                      }}
                    />
                    <Input
                      placeholder="내역"
                      className="h-9 text-sm"
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                    />
                  </div>

                  {/* 영수증 (복수) */}
                  <div className="space-y-1">
                    {item.receiptFiles.map((file, fileIdx) => (
                      <div key={fileIdx} className="flex items-center gap-2 text-xs text-slate-500">
                        {item.uploading && fileIdx >= item.receiptPaths.length
                          ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          : <Check className="h-3 w-3 text-green-500" />}
                        <span className="truncate flex-1">{file.name}</span>
                        {!item.uploading && (
                          <button type="button" onClick={() => {
                            setItems(prev => prev.map(it =>
                              it.id === item.id ? {
                                ...it,
                                receiptFiles: it.receiptFiles.filter((_, i) => i !== fileIdx),
                                receiptPaths: it.receiptPaths.filter((_, i) => i !== fileIdx),
                              } : it
                            ));
                          }}>
                            <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!item.uploading && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-blue-500">
                        <Paperclip className="h-3 w-3" />
                        <span>{item.receiptFiles.length > 0 ? '영수증 추가' : '영수증 첨부'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          onChange={e => handleFileChange(item.id, e)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 항목 추가 버튼 */}
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-1" />
              항목 추가
            </Button>
          </div>

          {/* 그룹핑 요약 (2건 이상일 때만) */}
          {grouped.length > 1 && (
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 space-y-1.5">
              <div className="text-xs font-semibold text-blue-700">
                📋 청구 요약 ({grouped.length}건으로 그룹화)
              </div>
              {grouped.map(g => (
                <div key={g.accountCode} className="text-xs text-slate-700">
                  <span className="font-mono text-blue-600">[{g.accountCode}]</span>{' '}
                  {g.accountCodeName.replace(/^\d+\s*/, '')}: {g.totalAmount.toLocaleString()}원
                  <span className="text-slate-400 ml-1">
                    — {g.descriptions.join(', ')}
                    {g.receiptPaths.length > 0 && ` | 영수증 ${g.receiptPaths.length}장`}
                  </span>
                </div>
              ))}
              <div className="pt-1 border-t border-blue-200 text-xs font-semibold text-slate-700">
                총 합계: {totalAmount.toLocaleString()}원
              </div>
            </div>
          )}

          {/* 단건일 때 합계 표시 */}
          {grouped.length === 1 && totalAmount > 0 && (
            <div className="text-right text-sm text-slate-500">
              합계: <span className="font-semibold text-slate-700">{totalAmount.toLocaleString()}원</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />등록 중...</>
              : grouped.length > 1
                ? `청구 등록 (${grouped.length}건)`
                : '청구 등록'
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
