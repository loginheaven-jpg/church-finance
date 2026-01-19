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

interface MatchPreviewResult {
  income: MatchedIncomeItem[];
  expense: MatchedExpenseItem[];
  suppressed: BankTransaction[];
  needsReview: Array<{
    transaction: BankTransaction;
    suggestions: MatchingRule[];
  }>;
}

// 탭 타입
type TabType = 'income' | 'expense' | 'suppressed';

export function BankUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [data, setData] = useState<BankTransaction[]>([]);
  const [result, setResult] = useState<{ uploaded: number; message: string } | null>(null);
  const [step, setStep] = useState<UploadStep>('upload');
  const [matchResult, setMatchResult] = useState<MatchPreviewResult | null>(null);
  const [savedTransactionIds, setSavedTransactionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('income');

  // 전체 상태 초기화
  const resetAll = useCallback(() => {
    setFile(null);
    setData([]);
    setResult(null);
    setStep('upload');
    setMatchResult(null);
    setSavedTransactionIds([]);
    setActiveTab('income');
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
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/bank/preview', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success) {
        setData(result.data);
        setStep('preview');
        toast.success(`${result.data.length}건의 거래 데이터를 불러왔습니다`);
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
    if (data.length === 0) {
      toast.error('저장할 데이터가 없습니다');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/upload/bank/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: data }),
      });

      const result = await res.json();

      if (result.success) {
        setResult(result);
        setSavedTransactionIds(data.map(tx => tx.id));
        setStep('saved');
        toast.success(result.message);
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

  // 수입 레코드 수정
  const handleIncomeChange = (index: number, field: keyof IncomeRecord, value: string | number) => {
    if (!matchResult) return;
    setMatchResult(prev => {
      if (!prev) return prev;
      const newIncome = [...prev.income];
      newIncome[index] = {
        ...newIncome[index],
        record: { ...newIncome[index].record, [field]: value },
      };
      return { ...prev, income: newIncome };
    });
  };

  // 지출 레코드 수정
  const handleExpenseChange = (index: number, field: keyof ExpenseRecord, value: string | number) => {
    if (!matchResult) return;
    setMatchResult(prev => {
      if (!prev) return prev;
      const newExpense = [...prev.expense];
      newExpense[index] = {
        ...newExpense[index],
        record: { ...newExpense[index].record, [field]: value },
      };
      return { ...prev, expense: newExpense };
    });
  };

  // 수입 항목 삭제
  const handleRemoveIncome = (index: number) => {
    if (!matchResult) return;
    setMatchResult(prev => {
      if (!prev) return prev;
      return { ...prev, income: prev.income.filter((_, i) => i !== index) };
    });
  };

  // 지출 항목 삭제
  const handleRemoveExpense = (index: number) => {
    if (!matchResult) return;
    setMatchResult(prev => {
      if (!prev) return prev;
      return { ...prev, expense: prev.expense.filter((_, i) => i !== index) };
    });
  };

  // 정식 반영 (3단계)
  const handleConfirm = async () => {
    if (!matchResult) {
      toast.error('매칭 결과가 없습니다');
      return;
    }

    setConfirming(true);

    try {
      const res = await fetch('/api/match/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: matchResult.income,
          expense: matchResult.expense,
          suppressed: matchResult.suppressed,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setStep('confirmed');
        toast.success(result.message);
        setTimeout(() => {
          resetAll();
        }, 3000);
      } else {
        toast.error(result.error || '반영 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('반영 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setConfirming(false);
    }
  };

  // 기준일별 합계 계산
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

  const totalWithdrawal = data.reduce((sum, item) => sum + item.withdrawal, 0);
  const totalDeposit = data.reduce((sum, item) => sum + item.deposit, 0);
  const dateSummary = getDateSummary();

  // 수입/지출 합계 계산
  const incomeTotalAmount = matchResult?.income.reduce((sum, item) => sum + item.record.amount, 0) || 0;
  const expenseTotalAmount = matchResult?.expense.reduce((sum, item) => sum + item.record.amount, 0) || 0;

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
                  {/* 탭 헤더 */}
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
                      수입부 ({matchResult.income.length}건)
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
                      지출부 ({matchResult.expense.length}건)
                      <span className="ml-2 text-red-600 font-semibold">
                        {expenseTotalAmount.toLocaleString()}원
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('suppressed')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        activeTab === 'suppressed'
                          ? 'border-slate-600 text-slate-700 bg-slate-50'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      )}
                    >
                      말소 ({matchResult.suppressed.length}건)
                    </button>
                  </div>

                  {/* 수입부 탭 내용 */}
                  {activeTab === 'income' && (
                    <div className="rounded-md border max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white">
                          <TableRow>
                            <TableHead className="w-[50px]">No</TableHead>
                            <TableHead className="min-w-[100px]">기준일</TableHead>
                            <TableHead className="min-w-[120px]">헌금자</TableHead>
                            <TableHead className="min-w-[100px]">분류</TableHead>
                            <TableHead className="min-w-[100px] text-right">금액</TableHead>
                            <TableHead className="min-w-[150px]">비고</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchResult.income.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{index + 1}</TableCell>
                              <TableCell className="text-sm text-blue-600">{item.record.date}</TableCell>
                              <TableCell>
                                <Input
                                  value={item.record.donor_name}
                                  onChange={(e) => handleIncomeChange(index, 'donor_name', e.target.value)}
                                  className="h-7 text-sm w-28"
                                />
                              </TableCell>
                              <TableCell className="text-sm">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  {item.match?.target_name || '기본분류'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={item.record.amount}
                                  onChange={(e) => handleIncomeChange(index, 'amount', parseInt(e.target.value) || 0)}
                                  className="h-7 text-sm text-right w-24 text-green-600"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.record.note}
                                  onChange={(e) => handleIncomeChange(index, 'note', e.target.value)}
                                  className="h-7 text-sm w-36"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveIncome(index)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {matchResult.income.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">수입 항목이 없습니다</div>
                      )}
                    </div>
                  )}

                  {/* 지출부 탭 내용 */}
                  {activeTab === 'expense' && (
                    <div className="rounded-md border max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white">
                          <TableRow>
                            <TableHead className="w-[50px]">No</TableHead>
                            <TableHead className="min-w-[100px]">기준일</TableHead>
                            <TableHead className="min-w-[120px]">거래처</TableHead>
                            <TableHead className="min-w-[100px]">분류</TableHead>
                            <TableHead className="min-w-[100px] text-right">금액</TableHead>
                            <TableHead className="min-w-[150px]">비고</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchResult.expense.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{index + 1}</TableCell>
                              <TableCell className="text-sm text-blue-600">{item.record.date}</TableCell>
                              <TableCell>
                                <Input
                                  value={item.record.vendor}
                                  onChange={(e) => handleExpenseChange(index, 'vendor', e.target.value)}
                                  className="h-7 text-sm w-28"
                                />
                              </TableCell>
                              <TableCell className="text-sm">
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                  {item.match?.target_name || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={item.record.amount}
                                  onChange={(e) => handleExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                                  className="h-7 text-sm text-right w-24 text-red-600"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.record.note}
                                  onChange={(e) => handleExpenseChange(index, 'note', e.target.value)}
                                  className="h-7 text-sm w-36"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveExpense(index)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {matchResult.expense.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">지출 항목이 없습니다</div>
                      )}
                    </div>
                  )}

                  {/* 말소 탭 내용 */}
                  {activeTab === 'suppressed' && (
                    <div className="rounded-md border max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white">
                          <TableRow>
                            <TableHead className="w-[50px]">No</TableHead>
                            <TableHead className="min-w-[100px]">거래일</TableHead>
                            <TableHead className="min-w-[150px]">내용</TableHead>
                            <TableHead className="min-w-[100px] text-right">금액</TableHead>
                            <TableHead className="min-w-[150px]">사유</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchResult.suppressed.map((tx, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-sm">{index + 1}</TableCell>
                              <TableCell className="text-sm">{tx.transaction_date}</TableCell>
                              <TableCell className="text-sm text-slate-600">{tx.description}</TableCell>
                              <TableCell className="text-right text-sm">
                                {tx.deposit > 0 && <span className="text-green-600">+{tx.deposit.toLocaleString()}</span>}
                                {tx.withdrawal > 0 && <span className="text-red-600">-{tx.withdrawal.toLocaleString()}</span>}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">{tx.suppressed_reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {matchResult.suppressed.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">말소 항목이 없습니다</div>
                      )}
                    </div>
                  )}

                  {/* 검토 필요 항목 알림 */}
                  {matchResult.needsReview.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        수동 검토 필요 ({matchResult.needsReview.length}건) - 별도 처리 필요
                      </div>
                      <div className="text-xs text-amber-600">
                        매칭 규칙이 없는 지출 거래입니다. 매칭 페이지에서 수동 분류하세요.
                      </div>
                    </div>
                  )}

                  {/* 3단계: 정식 반영 버튼 */}
                  <Button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    3단계: 정식 반영 (수입부 {matchResult.income.length}건, 지출부 {matchResult.expense.length}건)
                  </Button>
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
                      {data.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{index + 1}</TableCell>
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
                      ))}
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
