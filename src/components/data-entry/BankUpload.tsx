'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileText, Loader2, CheckCircle2, FileSpreadsheet, ArrowRight, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BankTransaction, IncomeRecord, ExpenseRecord, MatchingRule } from '@/types';

// 워크플로우 단계 타입
type UploadStep = 'upload' | 'preview' | 'saved' | 'matched' | 'confirmed';

// 매칭 결과 타입
interface MatchedIncomeItem {
  transaction: BankTransaction;
  record: IncomeRecord;
  match: MatchingRule | null;
}

interface MatchedExpenseItem {
  transaction: BankTransaction;
  record: ExpenseRecord;
  match: MatchingRule | null;
}

// 헌금함 매칭 현황 타입
interface CashOfferingMatchStatus {
  date: string;
  incomeTotal: number;
  bankAmount: number;
  matched: boolean;
}

interface MatchPreviewResult {
  income: MatchedIncomeItem[];
  expense: MatchedExpenseItem[];
  suppressed: BankTransaction[];
  needsReview: Array<{
    transaction: BankTransaction;
    suggestions: MatchingRule[];
  }>;
  cashOfferingMatchStatus?: CashOfferingMatchStatus[];
}

// 탭 타입 (2개만: 수입부, 지출부)
type TabType = 'income' | 'expense';

// 통합 아이템 타입 (말소, 검토필요, 정상매칭 통합)
type ItemType = 'suppressed' | 'needsReview' | 'matched';

interface UnifiedIncomeItem {
  type: ItemType;
  transaction: BankTransaction;
  record: IncomeRecord | null;
  match: MatchingRule | null;
}

interface UnifiedExpenseItem {
  type: ItemType;
  transaction: BankTransaction;
  record: ExpenseRecord | null;
  match: MatchingRule | null;
  suggestions?: MatchingRule[];
}

// 중복 체크용 복합키 생성
function getDuplicateKey(
  transactionDate: string,
  deposit: number,
  withdrawal: number,
  balance: number
): string {
  return `${transactionDate}|${deposit}|${withdrawal}|${balance}`;
}

export function BankUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [confirmingIncome, setConfirmingIncome] = useState(false);
  const [confirmingExpense, setConfirmingExpense] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [data, setData] = useState<BankTransaction[]>([]);
  const [result, setResult] = useState<{ uploaded: number; message: string } | null>(null);
  const [step, setStep] = useState<UploadStep>('upload');
  const [matchResult, setMatchResult] = useState<MatchPreviewResult | null>(null);
  const [savedTransactionIds, setSavedTransactionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('income');
  const [unifiedIncome, setUnifiedIncome] = useState<UnifiedIncomeItem[]>([]);
  const [unifiedExpense, setUnifiedExpense] = useState<UnifiedExpenseItem[]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());

  // matchResult가 변경되면 통합 리스트 생성
  const buildUnifiedLists = useCallback((result: MatchPreviewResult) => {
    // 수입부: 말소된 수입 거래 + 정상 매칭 수입
    const incomeItems: UnifiedIncomeItem[] = [
      ...result.suppressed
        .filter(tx => tx.deposit > 0)
        .map(tx => ({ type: 'suppressed' as ItemType, transaction: tx, record: null, match: null })),
      ...result.income
        .map(item => ({ type: 'matched' as ItemType, transaction: item.transaction, record: item.record, match: item.match })),
    ];

    // 지출부: 말소된 지출 거래 + 수동검토 지출 + 정상 매칭 지출
    const expenseItems: UnifiedExpenseItem[] = [
      ...result.suppressed
        .filter(tx => tx.withdrawal > 0)
        .map(tx => ({ type: 'suppressed' as ItemType, transaction: tx, record: null, match: null })),
      ...result.needsReview
        .map(item => ({ type: 'needsReview' as ItemType, transaction: item.transaction, record: null, match: null, suggestions: item.suggestions })),
      ...result.expense
        .map(item => ({ type: 'matched' as ItemType, transaction: item.transaction, record: item.record, match: item.match })),
    ];

    setUnifiedIncome(incomeItems);
    setUnifiedExpense(expenseItems);
  }, []);

  // 전체 상태 초기화
  const resetAll = useCallback(() => {
    setFile(null);
    setData([]);
    setResult(null);
    setStep('upload');
    setMatchResult(null);
    setSavedTransactionIds([]);
    setActiveTab('income');
    setUnifiedIncome([]);
    setUnifiedExpense([]);
    setConfirmingIncome(false);
    setConfirmingExpense(false);
    setExistingKeys(new Set());
    setDuplicateIndices(new Set());
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.xlsx'))) {
      setFile(droppedFile);
      setData([]);
      setResult(null);
      setStep('upload');
      setMatchResult(null);
      setSavedTransactionIds([]);
    } else {
      toast.error('XLS 또는 XLSX 파일만 업로드 가능합니다');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setData([]);
      setResult(null);
      setStep('upload');
      setMatchResult(null);
      setSavedTransactionIds([]);
    }
  };

  // 파일 파싱 (미리보기)
  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      // 1. 먼저 기존 은행원장의 중복 체크 키 조회
      const dupRes = await fetch('/api/bank/check-duplicates');
      const dupResult = await dupRes.json();
      let existingKeySet = new Set<string>();
      if (dupResult.success && dupResult.existingKeys) {
        existingKeySet = new Set(dupResult.existingKeys);
        setExistingKeys(existingKeySet);
      }

      // 2. 파일 파싱
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/bank/preview', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success) {
        const parsedData = result.data as BankTransaction[];

        // 3. 중복 체크: 각 항목의 복합키가 기존 데이터에 있는지 확인
        const dupIndices = new Set<number>();
        parsedData.forEach((tx, index) => {
          const key = getDuplicateKey(
            tx.transaction_date,
            Number(tx.deposit) || 0,
            Number(tx.withdrawal) || 0,
            Number(tx.balance) || 0
          );
          if (existingKeySet.has(key)) {
            dupIndices.add(index);
          }
        });
        setDuplicateIndices(dupIndices);

        setData(parsedData);
        setStep('preview');

        const dupCount = dupIndices.size;
        const newCount = parsedData.length - dupCount;
        if (dupCount > 0) {
          toast.success(`${parsedData.length}건 중 ${newCount}건 신규, ${dupCount}건 중복(회색)`);
        } else {
          toast.success(`${parsedData.length}건의 거래 데이터를 불러왔습니다`);
        }
      } else {
        toast.error(result.error || '파일 파싱 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('파일 파싱 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 셀 값 수정
  const handleCellChange = (index: number, field: keyof BankTransaction, value: string | number) => {
    setData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  // 행 삭제
  const handleRemoveRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  // 은행원장에 반영 (1단계)
  const handleSave = async () => {
    // 중복 클릭 방지
    if (saving || step !== 'preview') {
      return;
    }

    // 중복 제외한 신규 데이터만 필터링
    const newData = data.filter((_, index) => !duplicateIndices.has(index));

    if (newData.length === 0) {
      toast.error('저장할 신규 데이터가 없습니다 (모두 중복)');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/upload/bank/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: newData }),
      });

      const result = await res.json();

      if (result.success) {
        setResult(result);
        setSavedTransactionIds(newData.map(tx => tx.id));
        setStep('saved');
        const dupCount = duplicateIndices.size;
        if (dupCount > 0) {
          toast.success(`${result.message} (${dupCount}건 중복 제외)`);
        } else {
          toast.success(result.message);
        }
      } else {
        toast.error(result.error || '저장 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('저장 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // 원장 매칭 (2단계)
  const handleMatch = async () => {
    // 중복 클릭 방지
    if (matching || step !== 'saved') {
      return;
    }

    if (savedTransactionIds.length === 0) {
      toast.error('매칭할 거래가 없습니다');
      return;
    }

    setMatching(true);

    try {
      const res = await fetch('/api/match/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: savedTransactionIds }),
      });

      const result = await res.json();

      if (result.success) {
        setMatchResult(result.data);
        buildUnifiedLists(result.data);
        setStep('matched');
        setActiveTab('income');
        toast.success(result.message);
      } else {
        toast.error(result.error || '매칭 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('매칭 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setMatching(false);
    }
  };

  // 수입 레코드 수정 (통합 리스트 기준)
  const handleUnifiedIncomeChange = (index: number, field: keyof IncomeRecord, value: string | number) => {
    setUnifiedIncome(prev => {
      const newItems = [...prev];
      const item = newItems[index];
      if (item.type === 'matched' && item.record) {
        newItems[index] = {
          ...item,
          record: { ...item.record, [field]: value },
        };
      }
      return newItems;
    });
  };

  // 지출 레코드 수정 (통합 리스트 기준)
  const handleUnifiedExpenseChange = (index: number, field: keyof ExpenseRecord, value: string | number) => {
    setUnifiedExpense(prev => {
      const newItems = [...prev];
      const item = newItems[index];

      if (item.type === 'matched' && item.record) {
        newItems[index] = {
          ...item,
          record: { ...item.record, [field]: value },
        };
      } else if (item.type === 'needsReview') {
        // needsReview 항목 편집 시 matched로 전환하고 record 생성
        const now = new Date().toISOString();
        const newRecord: ExpenseRecord = {
          id: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: item.transaction.date,
          payment_method: '계좌이체',
          vendor: item.transaction.memo || item.transaction.detail || '기타',
          description: item.transaction.description || '',
          amount: item.transaction.withdrawal,
          account_code: item.suggestions?.[0]?.target_code || 0,
          category_code: Math.floor((item.suggestions?.[0]?.target_code || 0) / 10) * 10,
          note: item.transaction.detail || '',
          created_at: now,
          created_by: 'manual_edit',
          transaction_date: item.transaction.transaction_date,
          [field]: value,
        };
        newItems[index] = {
          ...item,
          type: 'matched',
          record: newRecord,
          match: item.suggestions?.[0] || null,
        };
      }
      return newItems;
    });
  };

  // 수입 항목 삭제 (통합 리스트 기준)
  const handleRemoveUnifiedIncome = (index: number) => {
    setUnifiedIncome(prev => prev.filter((_, i) => i !== index));
  };

  // 지출 항목 삭제 (통합 리스트 기준)
  const handleRemoveUnifiedExpense = (index: number) => {
    setUnifiedExpense(prev => prev.filter((_, i) => i !== index));
  };

  // 수입부 반영 (3단계 - 수입)
  const handleConfirmIncome = async () => {
    // 중복 클릭 방지
    if (confirmingIncome || step !== 'matched') {
      return;
    }

    // 반영할 수입 항목 확인
    const incomeToSave = unifiedIncome
      .filter(item => item.type === 'matched' && item.record)
      .map(item => ({ transaction: item.transaction, record: item.record!, match: item.match }));

    // 수입 관련 말소 항목
    const suppressedIncomeToSave = unifiedIncome
      .filter(item => item.type === 'suppressed')
      .map(item => item.transaction);

    if (incomeToSave.length === 0 && suppressedIncomeToSave.length === 0) {
      toast.error('반영할 수입 데이터가 없습니다');
      return;
    }

    setConfirmingIncome(true);

    try {
      console.log('[handleConfirmIncome] 전송 데이터:', {
        income: incomeToSave.length,
        suppressed: suppressedIncomeToSave.length,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: incomeToSave,
          expense: [],
          suppressed: suppressedIncomeToSave,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await res.json();
      console.log('[handleConfirmIncome] API 응답:', result);

      if (result.incomeSuccess) {
        // 수입 항목 리스트에서 제거
        setUnifiedIncome(prev => prev.filter(item => item.type === 'suppressed'));
        toast.success(`수입 ${result.incomeCount}건 반영 완료`);
      }
      if (result.suppressedSuccess && result.suppressedCount > 0) {
        // 말소 항목도 제거
        setUnifiedIncome(prev => prev.filter(item => item.type !== 'suppressed'));
        toast.success(`말소 ${result.suppressedCount}건 처리 완료`);
      }

      // 수입, 지출 모두 비어있으면 완료
      const remainingIncome = unifiedIncome.filter(item => item.type === 'matched').length - incomeToSave.length;
      const remainingExpense = unifiedExpense.filter(item => item.type === 'matched' || item.type === 'needsReview').length;
      if (remainingIncome === 0 && remainingExpense === 0) {
        setStep('confirmed');
        setTimeout(() => {
          resetAll();
        }, 3000);
      }

      if (!result.incomeSuccess) {
        toast.error(result.error || '수입 반영 중 오류가 발생했습니다');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        toast.error('수입 반영 중 오류가 발생했습니다');
      }
      console.error('[handleConfirmIncome] 에러:', error);
    } finally {
      setConfirmingIncome(false);
    }
  };

  // 지출부 반영 (3단계 - 지출)
  const handleConfirmExpense = async () => {
    // 중복 클릭 방지
    if (confirmingExpense || step !== 'matched') {
      return;
    }

    // 지출: matched + needsReview 모두 반영
    const expenseToSave = unifiedExpense
      .filter(item => item.type === 'matched' || item.type === 'needsReview')
      .map(item => {
        if (item.type === 'matched' && item.record) {
          return { transaction: item.transaction, record: item.record, match: item.match };
        }
        // needsReview → record 자동 생성
        const now = new Date().toISOString();
        const newRecord: ExpenseRecord = {
          id: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          date: item.transaction.date,
          payment_method: '계좌이체',
          vendor: item.transaction.memo || item.transaction.detail || '기타',
          description: item.transaction.description || '',
          amount: item.transaction.withdrawal,
          account_code: item.suggestions?.[0]?.target_code || 0,
          category_code: Math.floor((item.suggestions?.[0]?.target_code || 0) / 10) * 10,
          note: item.transaction.detail || '',
          created_at: now,
          created_by: 'auto_review',
          transaction_date: item.transaction.transaction_date,
        };
        return { transaction: item.transaction, record: newRecord, match: item.suggestions?.[0] || null };
      });

    // 지출 관련 말소 항목
    const suppressedExpenseToSave = unifiedExpense
      .filter(item => item.type === 'suppressed')
      .map(item => item.transaction);

    if (expenseToSave.length === 0 && suppressedExpenseToSave.length === 0) {
      toast.error('반영할 지출 데이터가 없습니다');
      return;
    }

    setConfirmingExpense(true);

    try {
      console.log('[handleConfirmExpense] 전송 데이터:', {
        expense: expenseToSave.length,
        suppressed: suppressedExpenseToSave.length,
        expenseDetails: expenseToSave.map(e => ({ vendor: e.record.vendor, amount: e.record.amount, account_code: e.record.account_code }))
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: [],
          expense: expenseToSave,
          suppressed: suppressedExpenseToSave,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await res.json();
      console.log('[handleConfirmExpense] API 응답:', result);

      if (result.expenseSuccess) {
        // 지출 항목 리스트에서 제거
        setUnifiedExpense(prev => prev.filter(item => item.type === 'suppressed'));
        toast.success(`지출 ${result.expenseCount}건 반영 완료`);
      }
      if (result.suppressedSuccess && result.suppressedCount > 0) {
        // 말소 항목도 제거
        setUnifiedExpense(prev => prev.filter(item => item.type !== 'suppressed'));
        toast.success(`말소 ${result.suppressedCount}건 처리 완료`);
      }

      // 수입, 지출 모두 비어있으면 완료
      const remainingIncome = unifiedIncome.filter(item => item.type === 'matched').length;
      const remainingExpense = unifiedExpense.filter(item => item.type === 'matched' || item.type === 'needsReview').length - expenseToSave.length;
      if (remainingIncome === 0 && remainingExpense === 0) {
        setStep('confirmed');
        setTimeout(() => {
          resetAll();
        }, 3000);
      }

      if (!result.expenseSuccess) {
        toast.error(result.error || '지출 반영 중 오류가 발생했습니다');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        toast.error('지출 반영 중 오류가 발생했습니다');
      }
      console.error('[handleConfirmExpense] 에러:', error);
    } finally {
      setConfirmingExpense(false);
    }
  };

  // 기준일별 합계 계산 (원본 데이터 기반)
  const getDateSummary = () => {
    const dateMap = new Map<string, { withdrawal: number; deposit: number }>();

    data.forEach(item => {
      const dateKey = item.date;
      const existing = dateMap.get(dateKey) || { withdrawal: 0, deposit: 0 };
      dateMap.set(dateKey, {
        withdrawal: existing.withdrawal + item.withdrawal,
        deposit: existing.deposit + item.deposit,
      });
    });

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amounts]) => ({ date, ...amounts }));
  };

  // 매칭 결과 기준일별 합계 계산 (반영 대상만)
  const getMatchedDateSummary = () => {
    const dateMap = new Map<string, { income: number; expense: number }>();

    // 수입 (매칭된 항목만)
    unifiedIncome
      .filter(item => item.type === 'matched' && item.record)
      .forEach(item => {
        const dateKey = item.record!.date;
        const existing = dateMap.get(dateKey) || { income: 0, expense: 0 };
        dateMap.set(dateKey, {
          ...existing,
          income: existing.income + item.record!.amount,
        });
      });

    // 지출 (매칭된 항목만)
    unifiedExpense
      .filter(item => item.type === 'matched' && item.record)
      .forEach(item => {
        const dateKey = item.record!.date;
        const existing = dateMap.get(dateKey) || { income: 0, expense: 0 };
        dateMap.set(dateKey, {
          ...existing,
          expense: existing.expense + item.record!.amount,
        });
      });

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amounts]) => ({ date, ...amounts }));
  };

  const totalWithdrawal = data.reduce((sum, item) => sum + item.withdrawal, 0);
  const totalDeposit = data.reduce((sum, item) => sum + item.deposit, 0);
  const dateSummary = getDateSummary();
  const matchedDateSummary = getMatchedDateSummary();

  // 수입/지출 합계 계산 (말소 항목 제외, 매칭된 항목만)
  const incomeTotalAmount = unifiedIncome
    .filter(item => item.type === 'matched' && item.record)
    .reduce((sum, item) => sum + (item.record?.amount || 0), 0);
  const expenseTotalAmount = unifiedExpense
    .filter(item => item.type === 'matched' && item.record)
    .reduce((sum, item) => sum + (item.record?.amount || 0), 0);

  // 말소 항목 수
  const suppressedIncomeCount = unifiedIncome.filter(item => item.type === 'suppressed').length;
  const suppressedExpenseCount = unifiedExpense.filter(item => item.type === 'suppressed').length;
  const needsReviewCount = unifiedExpense.filter(item => item.type === 'needsReview').length;
  const matchedIncomeCount = unifiedIncome.filter(item => item.type === 'matched').length;
  const matchedExpenseCount = unifiedExpense.filter(item => item.type === 'matched').length;

  // 검증용 합계 계산 (수입)
  const suppressedIncomeItems = unifiedIncome.filter(item => item.type === 'suppressed');
  const suppressedIncomeTotal = suppressedIncomeItems.reduce((sum, item) => sum + item.transaction.deposit, 0);
  const bankIncomeTotal = incomeTotalAmount + suppressedIncomeTotal;

  // 검증용 합계 계산 (지출)
  const suppressedExpenseItems = unifiedExpense.filter(item => item.type === 'suppressed');
  const suppressedExpenseTotal = suppressedExpenseItems.reduce((sum, item) => sum + item.transaction.withdrawal, 0);
  const bankExpenseTotal = expenseTotalAmount + suppressedExpenseTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle>은행원장 업로드</CardTitle>
        <CardDescription>
          농협에서 다운로드한 입출금내역 XLS 파일을 업로드하세요.
          자동으로 파싱되어 은행원장 시트에 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400',
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => document.getElementById('bank-file-input')?.click()}
        >
          <input
            id="bank-file-input"
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-10 w-10 text-blue-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">{file.name}</div>
                <div className="text-sm text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <div className="mt-4 font-medium text-slate-700">
                파일을 드래그하거나 클릭하여 선택
              </div>
              <div className="text-sm text-slate-500 mt-1">
                XLS, XLSX 파일
              </div>
            </div>
          )}
        </div>

        {file && data.length === 0 && step === 'upload' && (
          <Button onClick={handlePreview} disabled={loading} className="w-full" variant="outline">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                파일 분석 중...
              </>
            ) : (
              '파일 분석하기'
            )}
          </Button>
        )}

        {/* 미리보기 데이터 */}
        {data.length > 0 && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="h-5 w-5" />
                  은행거래 목록 ({data.length}건)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 워크플로우 단계 표시 */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-sm',
                  step === 'preview' ? 'bg-blue-100 text-blue-700' :
                  ['saved', 'matched', 'confirmed'].includes(step) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                )}>
                  <span className="font-medium">1</span>
                  <span>은행원장</span>
                  {['saved', 'matched', 'confirmed'].includes(step) && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <div className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-sm',
                  step === 'saved' ? 'bg-blue-100 text-blue-700' :
                  ['matched', 'confirmed'].includes(step) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                )}>
                  <span className="font-medium">2</span>
                  <span>원장 매칭</span>
                  {['matched', 'confirmed'].includes(step) && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <div className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-sm',
                  step === 'matched' ? 'bg-blue-100 text-blue-700' :
                  step === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                )}>
                  <span className="font-medium">3</span>
                  <span>정식 반영</span>
                  {step === 'confirmed' && <CheckCircle2 className="h-4 w-4" />}
                </div>
              </div>

              {/* 1단계: 은행원장에 반영 버튼 */}
              {step === 'preview' && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  1단계: 은행원장에 반영
                </Button>
              )}

              {/* 2단계: 원장 매칭 버튼 */}
              {step === 'saved' && (
                <Button
                  onClick={handleMatch}
                  disabled={matching}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  {matching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  2단계: 원장 매칭
                </Button>
              )}

              {/* 매칭 결과 - 탭 UI */}
              {matchResult && step === 'matched' && (
                <div className="space-y-4">
                  {/* 헌금함 매칭 현황 */}
                  {matchResult.cashOfferingMatchStatus && matchResult.cashOfferingMatchStatus.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-amber-700 mb-2">헌금함 매칭 현황</div>
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-amber-200">
                              <th className="text-left py-1 px-2">기준일</th>
                              <th className="text-right py-1 px-2">수입부 합계</th>
                              <th className="text-right py-1 px-2">은행원장 금액</th>
                              <th className="text-center py-1 px-2">상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchResult.cashOfferingMatchStatus.map((status) => (
                              <tr key={status.date} className={cn(
                                'border-b border-amber-100',
                                !status.matched && 'bg-red-50'
                              )}>
                                <td className="py-1 px-2 text-amber-800">{status.date}</td>
                                <td className="py-1 px-2 text-right text-green-600">{status.incomeTotal.toLocaleString()}</td>
                                <td className="py-1 px-2 text-right text-blue-600">{status.bankAmount.toLocaleString()}</td>
                                <td className="py-1 px-2 text-center">
                                  {status.matched ? (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-sm">일치</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm">불일치</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 기준일별 합계 (매칭 결과 기반) */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-green-700 mb-2">기준일별 합계 (반영 대상)</div>
                    <div className="flex flex-wrap gap-3">
                      {matchedDateSummary.map(({ date, income, expense }) => (
                        <div key={date} className="bg-white px-3 py-1.5 rounded border border-green-200">
                          <span className="text-sm text-green-700 mr-2">{date}</span>
                          {income > 0 && (
                            <span className="text-green-600 font-semibold mr-2">+{income.toLocaleString()}</span>
                          )}
                          {expense > 0 && (
                            <span className="text-red-600 font-semibold">-{expense.toLocaleString()}</span>
                          )}
                        </div>
                      ))}
                      <div className="bg-green-100 px-3 py-1.5 rounded border border-green-300">
                        <span className="text-sm text-green-800 mr-2">반영 총합계</span>
                        <span className="text-green-700 font-bold mr-2">+{incomeTotalAmount.toLocaleString()}</span>
                        <span className="text-red-700 font-bold">-{expenseTotalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 검증 라인 (수입) */}
                  {suppressedIncomeCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                      <span className="text-blue-800">
                        <span className="font-medium">은행원장 수입합계</span>{' '}
                        <span className="text-blue-600 font-bold">{bankIncomeTotal.toLocaleString()}원</span>
                        {' - '}
                        <span className="font-medium">말소금액</span>{' '}
                        <span className="text-red-600">
                          ({suppressedIncomeCount}건 {suppressedIncomeTotal.toLocaleString()}원
                          {suppressedIncomeCount <= 5 && (
                            <span className="text-red-500">
                              {' = '}
                              {suppressedIncomeItems.map((item, i) => (
                                <span key={i}>
                                  {i > 0 && ' + '}
                                  {item.transaction.deposit.toLocaleString()}
                                </span>
                              ))}
                            </span>
                          )}
                          )
                        </span>
                        {' = '}
                        <span className="font-medium">반영 총합계</span>{' '}
                        <span className="text-green-600 font-bold">{incomeTotalAmount.toLocaleString()}원</span>
                      </span>
                    </div>
                  )}

                  {/* 검증 라인 (지출) */}
                  {suppressedExpenseCount > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                      <span className="text-orange-800">
                        <span className="font-medium">은행원장 지출합계</span>{' '}
                        <span className="text-orange-600 font-bold">{bankExpenseTotal.toLocaleString()}원</span>
                        {' - '}
                        <span className="font-medium">말소금액</span>{' '}
                        <span className="text-red-600">
                          ({suppressedExpenseCount}건 {suppressedExpenseTotal.toLocaleString()}원)
                        </span>
                        {' = '}
                        <span className="font-medium">반영 총합계</span>{' '}
                        <span className="text-red-600 font-bold">{expenseTotalAmount.toLocaleString()}원</span>
                      </span>
                    </div>
                  )}

                  {/* 탭 헤더 (2개: 수입부, 지출부) */}
                  <div className="flex border-b">
                    <button
                      onClick={() => setActiveTab('income')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        activeTab === 'income'
                          ? 'border-green-600 text-green-700 bg-green-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      )}
                    >
                      수입부 ({unifiedIncome.length}건)
                      {suppressedIncomeCount > 0 && (
                        <span className="ml-1 text-sm text-red-500">말소 {suppressedIncomeCount}</span>
                      )}
                      <span className="ml-2 text-green-600 font-semibold">
                        {incomeTotalAmount.toLocaleString()}원
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('expense')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        activeTab === 'expense'
                          ? 'border-red-600 text-red-700 bg-red-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      )}
                    >
                      지출부 ({unifiedExpense.length}건)
                      {(suppressedExpenseCount > 0 || needsReviewCount > 0) && (
                        <span className="ml-1 text-sm">
                          {suppressedExpenseCount > 0 && <span className="text-red-500">말소 {suppressedExpenseCount}</span>}
                          {needsReviewCount > 0 && <span className="text-amber-500 ml-1">검토 {needsReviewCount}</span>}
                        </span>
                      )}
                      <span className="ml-2 text-red-600 font-semibold">
                        {expenseTotalAmount.toLocaleString()}원
                      </span>
                    </button>
                  </div>

                  {/* 수입부 탭 내용 (통합: 말소 + 정상매칭) */}
                  {activeTab === 'income' && (
                    <div className="rounded-md border max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">No</TableHead>
                            <TableHead className="w-[50px]">상태</TableHead>
                            <TableHead className="w-[90px]">기준일</TableHead>
                            <TableHead className="w-[80px]">입금일</TableHead>
                            <TableHead className="w-[80px]">입금방법</TableHead>
                            <TableHead className="w-[50px]">코드</TableHead>
                            <TableHead className="w-[80px]">헌금자</TableHead>
                            <TableHead className="w-[120px]">대표자</TableHead>
                            <TableHead className="w-[70px] text-right">금액</TableHead>
                            <TableHead className="w-[208px]">비고</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unifiedIncome.map((item, index) => (
                            <TableRow
                              key={index}
                              className={cn(
                                item.type === 'suppressed' && 'bg-red-50'
                              )}
                            >
                              <TableCell className="text-sm">{index + 1}</TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm font-medium">말소</span>
                                ) : (
                                  <span className="text-slate-300 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className={cn('text-sm', item.type === 'suppressed' ? 'text-red-600' : 'text-blue-600')}>
                                {item.type === 'suppressed' ? item.transaction.date : item.record?.date}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {item.type === 'suppressed' ? item.transaction.transaction_date : item.record?.transaction_date}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.type === 'suppressed' ? (
                                  <span className="text-red-500">-</span>
                                ) : (
                                  <Input
                                    value={item.record?.source || '계좌이체'}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'source', e.target.value)}
                                    className="h-6 text-sm w-20"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.type === 'suppressed' ? (
                                  <span className="text-red-500">-</span>
                                ) : (
                                  <Input
                                    type="number"
                                    value={item.record?.offering_code || 0}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'offering_code', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm w-16 text-center"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-600">{item.transaction.memo || item.transaction.detail || '-'}</span>
                                ) : (
                                  <Input
                                    value={item.record?.donor_name || ''}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'donor_name', e.target.value)}
                                    className="h-6 text-sm w-20"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-500">-</span>
                                ) : (
                                  <Input
                                    value={item.record?.representative || ''}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'representative', e.target.value)}
                                    className="h-6 text-sm w-32"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-600 font-medium">+{item.transaction.deposit.toLocaleString()}</span>
                                ) : (
                                  <Input
                                    type="number"
                                    value={item.record?.amount || 0}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'amount', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm text-right w-28 text-green-600"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-500">{item.transaction.suppressed_reason}</span>
                                ) : (
                                  <Input
                                    value={item.record?.note || ''}
                                    onChange={(e) => handleUnifiedIncomeChange(index, 'note', e.target.value)}
                                    className="h-6 text-sm w-80"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type !== 'suppressed' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveUnifiedIncome(index)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {unifiedIncome.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">수입 항목이 없습니다</div>
                      )}
                    </div>
                  )}

                  {/* 지출부 탭 내용 (통합: 말소 + 검토필요 + 정상매칭) */}
                  {activeTab === 'expense' && (
                    <div className="rounded-md border max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">No</TableHead>
                            <TableHead className="w-[50px]">상태</TableHead>
                            <TableHead className="w-[90px]">기준일</TableHead>
                            <TableHead className="w-[80px]">이체일</TableHead>
                            <TableHead className="w-[70px]">결제방법</TableHead>
                            <TableHead className="w-[100px]">거래처</TableHead>
                            <TableHead className="w-[120px]">적요</TableHead>
                            <TableHead className="w-[90px] text-right">금액</TableHead>
                            <TableHead className="w-[60px]">계정</TableHead>
                            <TableHead className="w-[120px]">비고</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unifiedExpense.map((item, index) => (
                            <TableRow
                              key={index}
                              className={cn(
                                item.type === 'suppressed' && 'bg-red-50',
                                item.type === 'needsReview' && 'bg-amber-50'
                              )}
                            >
                              <TableCell className="text-sm">{index + 1}</TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm font-medium">말소</span>
                                ) : item.type === 'needsReview' ? (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-sm font-medium">검토</span>
                                ) : (
                                  <span className="text-slate-300 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className={cn(
                                'text-sm',
                                item.type === 'suppressed' ? 'text-red-600' :
                                item.type === 'needsReview' ? 'text-amber-600' : 'text-blue-600'
                              )}>
                                {item.type === 'matched' ? item.record?.date : item.transaction.date}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {item.type === 'matched' ? item.record?.transaction_date : item.transaction.transaction_date}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.type === 'suppressed' ? (
                                  <span className="text-red-500">-</span>
                                ) : item.type === 'needsReview' ? (
                                  <span className="text-amber-600">계좌이체</span>
                                ) : (
                                  <Input
                                    value={item.record?.payment_method || '계좌이체'}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'payment_method', e.target.value)}
                                    className="h-6 text-sm w-20"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-600">{item.transaction.memo || item.transaction.detail || '-'}</span>
                                ) : item.type === 'needsReview' ? (
                                  <Input
                                    value={item.record?.vendor || item.transaction.memo || item.transaction.detail || ''}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'vendor', e.target.value)}
                                    className="h-6 text-sm w-24 bg-amber-50"
                                  />
                                ) : (
                                  <Input
                                    value={item.record?.vendor || ''}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'vendor', e.target.value)}
                                    className="h-6 text-sm w-24"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-500">{item.transaction.suppressed_reason}</span>
                                ) : item.type === 'needsReview' ? (
                                  <Input
                                    value={item.record?.description || item.transaction.description || ''}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'description', e.target.value)}
                                    className="h-6 text-sm w-28 bg-amber-50"
                                  />
                                ) : (
                                  <Input
                                    value={item.record?.description || ''}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'description', e.target.value)}
                                    className="h-6 text-sm w-28"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-600 font-medium">{item.transaction.withdrawal.toLocaleString()}</span>
                                ) : item.type === 'needsReview' ? (
                                  <Input
                                    type="number"
                                    value={item.record?.amount || item.transaction.withdrawal}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm text-right w-36 text-amber-700 bg-amber-50"
                                  />
                                ) : (
                                  <Input
                                    type="number"
                                    value={item.record?.amount || 0}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm text-right w-36 text-red-600"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.type === 'suppressed' ? (
                                  <span className="text-red-500">-</span>
                                ) : item.type === 'needsReview' ? (
                                  <Input
                                    type="number"
                                    value={item.record?.account_code || item.suggestions?.[0]?.target_code || 0}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'account_code', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm w-16 text-center bg-amber-50"
                                  />
                                ) : (
                                  <Input
                                    type="number"
                                    value={item.record?.account_code || 0}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'account_code', parseInt(e.target.value) || 0)}
                                    className="h-6 text-sm w-16 text-center"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'suppressed' ? (
                                  <span className="text-sm text-red-500">{item.transaction.description}</span>
                                ) : item.type === 'needsReview' ? (
                                  <span className="text-sm text-amber-600">{item.transaction.detail || '-'}</span>
                                ) : (
                                  <Input
                                    value={item.record?.note || ''}
                                    onChange={(e) => handleUnifiedExpenseChange(index, 'note', e.target.value)}
                                    className="h-6 text-sm w-28"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {item.type === 'matched' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveUnifiedExpense(index)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {unifiedExpense.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">지출 항목이 없습니다</div>
                      )}
                    </div>
                  )}

                  {/* 3단계: 정식 반영 버튼 (수입부/지출부 분리) */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfirmIncome}
                      disabled={confirmingIncome || matchedIncomeCount === 0}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {confirmingIncome ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      수입부 반영 ({matchedIncomeCount}건{suppressedIncomeCount > 0 ? `, 말소 ${suppressedIncomeCount}` : ''})
                    </Button>
                    <Button
                      onClick={handleConfirmExpense}
                      disabled={confirmingExpense || (matchedExpenseCount + needsReviewCount) === 0}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {confirmingExpense ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      지출부 반영 ({matchedExpenseCount + needsReviewCount}건{suppressedExpenseCount > 0 ? `, 말소 ${suppressedExpenseCount}` : ''})
                    </Button>
                  </div>
                </div>
              )}

              {/* 완료 상태 */}
              {step === 'confirmed' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-green-700 font-medium">모든 작업이 완료되었습니다</div>
                  <p className="text-sm text-green-600 mt-1">잠시 후 초기화됩니다...</p>
                </div>
              )}

              {/* 중복 경고 메시지 */}
              {step !== 'matched' && step !== 'confirmed' && duplicateIndices.size > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    <span className="font-medium">{duplicateIndices.size}건</span>의 중복 데이터가 감지되었습니다.
                    중복 항목은 <span className="text-slate-500">회색</span>으로 표시되며 저장에서 제외됩니다.
                    (신규: <span className="font-medium text-green-600">{data.length - duplicateIndices.size}건</span>)
                  </span>
                </div>
              )}

              {/* 기준일별 합계 (step이 matched 이전일 때만 표시) */}
              {step !== 'matched' && step !== 'confirmed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-700 mb-2">기준일별 합계 (주일)</div>
                  <div className="flex flex-wrap gap-3">
                    {dateSummary.map(({ date, withdrawal, deposit }) => (
                      <div key={date} className="bg-white px-3 py-1.5 rounded border border-blue-200">
                        <span className="text-sm text-blue-600 mr-2">{date}</span>
                        {deposit > 0 && (
                          <span className="text-green-600 font-semibold mr-2">+{deposit.toLocaleString()}</span>
                        )}
                        {withdrawal > 0 && (
                          <span className="text-red-600 font-semibold">-{withdrawal.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                    <div className="bg-blue-100 px-3 py-1.5 rounded border border-blue-300">
                      <span className="text-sm text-blue-700 mr-2">총합계</span>
                      <span className="text-green-700 font-bold mr-2">+{totalDeposit.toLocaleString()}</span>
                      <span className="text-red-700 font-bold">-{totalWithdrawal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 테이블 (step이 matched 이전일 때만 표시) */}
              {step !== 'matched' && step !== 'confirmed' && (
                <div className="rounded-md border max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead className="w-[50px]">상태</TableHead>
                        <TableHead className="min-w-[100px]">거래일</TableHead>
                        <TableHead className="min-w-[100px]">기준일</TableHead>
                        <TableHead className="min-w-[100px] text-right">출금</TableHead>
                        <TableHead className="min-w-[100px] text-right">입금</TableHead>
                        <TableHead className="min-w-[100px] text-right">잔액</TableHead>
                        <TableHead className="min-w-[120px]">거래내용</TableHead>
                        <TableHead className="min-w-[120px]">기록사항</TableHead>
                        <TableHead className="min-w-[80px]">메모</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((item, index) => {
                        const isDuplicate = duplicateIndices.has(index);
                        return (
                        <TableRow key={item.id} className={cn(isDuplicate && 'bg-slate-100 opacity-60')}>
                          <TableCell className="font-medium text-sm">{index + 1}</TableCell>
                          <TableCell>
                            {isDuplicate ? (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-medium">중복</span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.transaction_date}</TableCell>
                          <TableCell className="text-sm text-blue-600">{item.date}</TableCell>
                          <TableCell className="text-right">
                            {item.withdrawal > 0 ? (
                              <Input
                                type="number"
                                value={item.withdrawal}
                                onChange={(e) => handleCellChange(index, 'withdrawal', parseInt(e.target.value) || 0)}
                                className="h-7 text-sm text-right w-24 text-red-600"
                                disabled={step !== 'preview'}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.deposit > 0 ? (
                              <Input
                                type="number"
                                value={item.deposit}
                                onChange={(e) => handleCellChange(index, 'deposit', parseInt(e.target.value) || 0)}
                                className="h-7 text-sm text-right w-24 text-green-600"
                                disabled={step !== 'preview'}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.balance.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => handleCellChange(index, 'description', e.target.value)}
                              className="h-7 text-sm w-28"
                              disabled={step !== 'preview'}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.detail}
                              onChange={(e) => handleCellChange(index, 'detail', e.target.value)}
                              className="h-7 text-sm w-28"
                              disabled={step !== 'preview'}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.memo}
                              onChange={(e) => handleCellChange(index, 'memo', e.target.value)}
                              className="h-7 text-sm w-20"
                              disabled={step !== 'preview'}
                            />
                          </TableCell>
                          <TableCell>
                            {step === 'preview' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRow(index)}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                              >
                                &times;
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 빈 상태 */}
        {!file && data.length === 0 && !result && (
          <div className="text-center py-4 text-slate-500 text-sm">
            파일을 선택하면 미리보기 후 은행원장에 반영할 수 있습니다
          </div>
        )}
      </CardContent>
    </Card>
  );
}
