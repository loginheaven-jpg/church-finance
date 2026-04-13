'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Paperclip, X, HelpCircle, Plus, Check, AlertTriangle, ScanSearch, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-compress';

interface ExpenseCode {
  category_code: number;
  category_item: string;
  code: number;
  item: string;
  active: boolean;
}

interface AIReceiptDetail {
  amount: number;
  store: string | null;
}

interface AIVerification {
  status: 'analyzing' | 'match' | 'mismatch' | 'failed';
  aiAmount?: number | null;
  aiStore?: string | null;
  aiDate?: string | null;
  aiItems?: string[];
  confidence?: string;
  mismatchReason?: string;  // 사용자가 입력한 불일치 사유
  details?: AIReceiptDetail[];  // 개별 영수증 상세 (복수일 때)
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
  aiVerification?: AIVerification;
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

      // AI 분석 자동 트리거 — 기존 파일 + 새 파일을 직접 전달 (setState 비동기 대응)
      const currentItem = items.find(i => i.id === itemId);
      const allFiles = [...(currentItem?.receiptFiles || []), ...newFiles];
      analyzeAllReceipts(itemId, allFiles);
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

  // 단일 파일 AI 분석 (내부용)
  const analyzeOneFile = async (file: File): Promise<AIReceiptDetail[]> => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const targetFile = isPdf ? file : await compressImage(file);
    const mediaType = isPdf ? 'application/pdf' : (targetFile.type || 'image/jpeg');

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(targetFile);
    });

    const res = await fetch('/api/expense-claim/verify-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, image_media_type: mediaType }),
    });

    const data = await res.json();
    if (!data.success || !data.parsed || data.parsed.length === 0) return [];
    return (data.parsed as { amount: number | null; store: string | null }[])
      .map(r => ({ amount: r.amount || 0, store: r.store }));
  };

  // 전체 첨부 파일 AI 분석 → 합산 비교
  const analyzeAllReceipts = async (itemId: string, files?: File[]) => {
    // files가 전달되면 사용, 아니면 items에서 가져오기
    const targetFiles = files || items.find(i => i.id === itemId)?.receiptFiles;
    if (!targetFiles || targetFiles.length === 0) return;

    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, aiVerification: { status: 'analyzing' } } : item
    ));

    try {
      // 모든 파일을 각각 분석
      const allDetails: AIReceiptDetail[] = [];
      for (const file of targetFiles) {
        const details = await analyzeOneFile(file);
        allDetails.push(...details);
      }

      if (allDetails.length === 0) {
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, aiVerification: { status: 'failed' } } : item
        ));
        return;
      }

      const aiTotal = allDetails.reduce((s, d) => s + d.amount, 0);
      const stores = allDetails.map(d => d.store).filter(Boolean).join(', ');

      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const userAmt = parseAmount(item.amount);
        const status = userAmt <= 0 ? 'match' as const  // 금액 미입력 → recheckAI에서 재판정
          : (userAmt === aiTotal ? 'match' as const : 'mismatch' as const);
        return {
          ...item,
          aiVerification: {
            status,
            aiAmount: aiTotal,
            aiStore: stores || null,
            aiDate: null,
            aiItems: [],
            confidence: 'medium',
            details: allDetails.length > 1 ? allDetails : undefined,
          },
        };
      }));
    } catch {
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, aiVerification: { status: 'failed' } } : item
      ));
    }
  };

  // 금액 변경 시 AI 검증 결과 재비교
  const recheckAI = (itemId: string, newAmount: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId || !item.aiVerification || item.aiVerification.status === 'analyzing' || item.aiVerification.status === 'failed') return item;
      const userAmt = parseAmount(newAmount);
      const aiAmt = item.aiVerification.aiAmount || 0;
      if (userAmt <= 0 || aiAmt <= 0) return item;
      return {
        ...item,
        aiVerification: {
          ...item.aiVerification,
          status: userAmt === aiAmt ? 'match' : 'mismatch',
          mismatchReason: userAmt === aiAmt ? undefined : item.aiVerification.mismatchReason,
        },
      };
    }));
  };

  // AI 검증 팝업 상태
  const [aiPopup, setAiPopup] = useState<{
    open: boolean;
    itemId: string;
    aiAmount: number;
    aiStore: string;
    userAmount: number;
    details?: AIReceiptDetail[];
    reason: string;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
  } | null>(null);

  // 특정 항목의 AI 검증 수행 (제출/항목추가 시 호출)
  const verifyItemAI = useCallback((item: LineItem): Promise<'pass' | 'cancel'> => {
    return new Promise((resolve) => {
      // 영수증 없음 또는 AI 실패 → 패스
      if (item.receiptFiles.length === 0 || !item.aiVerification || item.aiVerification.status === 'failed') {
        resolve('pass');
        return;
      }
      // AI 분석 중 → 대기 안내
      if (item.aiVerification.status === 'analyzing') {
        toast.error('영수증 AI 확인이 진행 중입니다. 잠시 후 다시 시도해주세요.');
        resolve('cancel');
        return;
      }
      // 이미 사유 입력된 경우 → 패스
      if (item.aiVerification.mismatchReason) {
        resolve('pass');
        return;
      }

      const userAmt = parseAmount(item.amount);
      const aiAmt = item.aiVerification.aiAmount || 0;

      // 금액 미입력 또는 AI 금액 없음 → 패스
      if (userAmt <= 0 || aiAmt <= 0) {
        resolve('pass');
        return;
      }

      // 일치 → 자동 태그 추가 + 패스
      if (userAmt === aiAmt) {
        setItems(prev => prev.map(it =>
          it.id === item.id ? {
            ...it,
            aiVerification: { ...it.aiVerification!, status: 'match' as const, mismatchReason: undefined },
          } : it
        ));
        resolve('pass');
        return;
      }

      // 불일치 → 팝업
      setAiPopup({
        open: true,
        itemId: item.id,
        aiAmount: aiAmt,
        aiStore: item.aiVerification.aiStore || '',
        userAmount: userAmt,
        details: item.aiVerification.details,
        reason: '',
        onConfirm: (reason: string) => {
          setItems(prev => prev.map(it =>
            it.id === item.id ? {
              ...it,
              aiVerification: { ...it.aiVerification!, status: 'mismatch' as const, mismatchReason: reason },
            } : it
          ));
          setAiPopup(null);
          resolve('pass');
        },
        onCancel: () => {
          setAiPopup(null);
          resolve('cancel');
        },
      });
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // 여러 항목 순차 검증
  const verifyAllItems = useCallback(async (targetItems: LineItem[]): Promise<boolean> => {
    for (const item of targetItems) {
      const result = await verifyItemAI(item);
      if (result === 'cancel') return false;
    }
    return true;
  }, [verifyItemAI]);

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

    // AI 검증 팝업 (순차: 불일치 시 팝업 → 사유 입력 → 다음 항목)
    const aiPassed = await verifyAllItems(validItems);
    if (!aiPassed) return;

    setLoading(true);
    try {
      // AI 태그를 내역에 포함하여 그룹 데이터 생성
      // items state가 verifyAllItems에서 업데이트되었으므로 최신 값 사용
      const latestItems = items.filter(item => item.accountCode && parseAmount(item.amount) > 0);
      const itemsWithReason = latestItems.map(item => {
        let desc = item.description;
        if (item.aiVerification?.status === 'match' && item.receiptFiles.length > 0) {
          desc += ` (※AI확인)`;
        } else if (item.aiVerification?.status === 'mismatch' && item.aiVerification.mismatchReason) {
          desc += ` (※AI불일치: 영수증 ${item.aiVerification.aiAmount?.toLocaleString()}원, ${item.aiVerification.mismatchReason})`;
        }
        return { ...item, description: desc };
      });

      // 계정코드별 그룹핑 (사유 포함 description 사용)
      const groupMap = new Map<string, { accountCode: string; amount: number; descriptions: string[]; receiptPaths: string[] }>();
      for (const item of itemsWithReason) {
        const amt = parseAmount(item.amount);
        const existing = groupMap.get(item.accountCode);
        if (existing) {
          existing.amount += amt;
          if (item.description) existing.descriptions.push(item.description);
          existing.receiptPaths.push(...item.receiptPaths);
        } else {
          groupMap.set(item.accountCode, {
            accountCode: item.accountCode,
            amount: amt,
            descriptions: item.description ? [item.description] : [],
            receiptPaths: [...item.receiptPaths],
          });
        }
      }

      const groupsData = Array.from(groupMap.values()).map(g => ({
        accountCode: g.accountCode,
        amount: g.amount,
        description: g.descriptions.join(', '),
        receiptPaths: g.receiptPaths,
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="은행명"
                value={shared.bankName}
                onChange={e => setShared(p => ({ ...p, bankName: e.target.value }))}
                required
              />
              <Input
                placeholder="예금주"
                value={shared.accountHolder}
                onChange={e => setShared(p => ({ ...p, accountHolder: e.target.value }))}
                required
              />
            </div>
            <Input
              placeholder="계좌번호"
              value={shared.accountNumber}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setShared(p => ({ ...p, accountNumber: v }));
              }}
              required
            />
          </div>

          {/* 계정과목 가이드 */}
          <div className="flex items-center gap-1">
            <Label>지출 항목</Label>
            <button type="button" onClick={() => setShowGuide(p => !p)} className="text-slate-400 hover:text-blue-500">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          {showGuide && (
            <>
            <div className="fixed inset-0 z-10" onClick={() => setShowGuide(false)} />
            <div className="relative z-20 inline-block text-xs border border-blue-200 rounded-md overflow-hidden max-w-[280px]">
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
            </>
          )}

          <p className="text-xs text-slate-400 -mt-1">
            계정코드별로 항목을 나눠 입력해주세요. 같은 코드라면 하나의 항목에 영수증을 여러 장 첨부할 수 있습니다. 다만 영수증 3장 이상을 한번에 촬영하면 인식 정확도가 떨어질 수 있습니다.
          </p>

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
                        const formatted = v ? Number(v).toLocaleString() : '';
                        updateItem(item.id, 'amount', formatted);
                        recheckAI(item.id, formatted);
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
                            setItems(prev => prev.map(it => {
                              if (it.id !== item.id) return it;
                              const newFiles = it.receiptFiles.filter((_, i) => i !== fileIdx);
                              const newPaths = it.receiptPaths.filter((_, i) => i !== fileIdx);
                              return {
                                ...it,
                                receiptFiles: newFiles,
                                receiptPaths: newPaths,
                                aiVerification: newFiles.length === 0 ? undefined : it.aiVerification,
                              };
                            }));
                          }}>
                            <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!item.uploading && (
                      <div className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors">
                          <Paperclip className="h-4 w-4" />
                          <span>{item.receiptFiles.length > 0 ? '추가' : '파일 선택'}</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            className="hidden"
                            onChange={e => handleFileChange(item.id, e)}
                          />
                        </label>
                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors">
                          <Camera className="h-4 w-4" />
                          <span>촬영</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handleFileChange(item.id, e)}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* AI 영수증 검증 — 최소 상태 표시만 (상세는 제출 시 팝업) */}
                  {item.aiVerification && (
                    <div className="flex items-center gap-1.5 text-xs mt-0.5">
                      {item.aiVerification.status === 'analyzing' && (
                        <><ScanSearch className="h-3 w-3 animate-pulse text-blue-500" /><span className="text-blue-600">AI 확인 중...</span></>
                      )}
                      {(item.aiVerification.status === 'match' || item.aiVerification.status === 'mismatch') && (
                        <><ScanSearch className="h-3 w-3 text-green-500" /><span className="text-slate-500">AI 확인 완료</span></>
                      )}
                      {item.aiVerification.status === 'failed' && (
                        <><ScanSearch className="h-3 w-3 text-slate-400" /><span className="text-slate-400">AI 확인 실패</span></>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 항목 추가 버튼 — 마지막 항목 AI 검증 후 추가 */}
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              const lastItem = items[items.length - 1];
              if (lastItem && lastItem.receiptFiles.length > 0 && lastItem.accountCode && parseAmount(lastItem.amount) > 0) {
                const result = await verifyItemAI(lastItem);
                if (result === 'cancel') return;
              }
              addItem();
            }} className="w-full border-dashed">
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

      {/* AI 금액 불일치 팝업 */}
      <Dialog open={!!aiPopup?.open} onOpenChange={(open) => { if (!open) aiPopup?.onCancel(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              영수증 금액 확인
            </DialogTitle>
          </DialogHeader>
          {aiPopup && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-sm">
                <div>
                  <span className="text-slate-500">AI 인식: </span>
                  <span className="font-semibold">
                    {aiPopup.details
                      ? aiPopup.details.map(d => `${d.amount.toLocaleString()}${d.store ? `(${d.store})` : ''}`).join(' + ')
                        + ` = 총 ${aiPopup.aiAmount.toLocaleString()}원`
                      : `${aiPopup.aiAmount.toLocaleString()}원${aiPopup.aiStore ? ` (${aiPopup.aiStore})` : ''}`
                    }
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">입력 금액: </span>
                  <span className="font-semibold">{aiPopup.userAmount.toLocaleString()}원</span>
                </div>
                <div className="text-amber-600 font-medium">
                  차이: {Math.abs(aiPopup.aiAmount - aiPopup.userAmount).toLocaleString()}원
                </div>
              </div>

              <div className="space-y-2">
                <Label>사유</Label>
                <Input
                  autoFocus
                  placeholder="예) 개인부담분 제외, 인식 오류 등"
                  className="bg-white"
                  value={aiPopup.reason}
                  onChange={e => setAiPopup(prev => prev ? { ...prev, reason: e.target.value } : null)}
                />
                <p className="text-xs text-slate-400">
                  💡 영수증 인식 오류인 경우 &apos;인식 오류&apos;라고 입력해주세요.
                  개인부담분이 있으면 그 내용을 적어주시면 됩니다.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!aiPopup.reason.trim()}
                  onClick={() => {
                    if (aiPopup.reason.trim()) {
                      aiPopup.onConfirm(aiPopup.reason.trim());
                    }
                  }}
                >
                  사유와 함께 등록
                </Button>
                <Button variant="outline" onClick={() => aiPopup.onCancel()}>
                  취소
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
