'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, CreditCard, AlertTriangle, Check, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import type { CardExpenseItem, CardExpenseParseResponse, ExpenseCode } from '@/types';

export default function CardExpenseIntegrationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<CardExpenseItem[]>([]);
  const [matchingRecord, setMatchingRecord] = useState<{ id: string; date: string; amount: number } | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);
  const [applying, setApplying] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // 지출부코드 로드
  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const res = await fetch('/api/codes/expense');
        const data = await res.json();
        if (data.success) {
          setExpenseCodes(data.data);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchCodes();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // 이전 데이터 초기화
      setTransactions([]);
      setMatchingRecord(null);
      setWarning(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setTransactions([]);
      setMatchingRecord(null);
      setWarning(null);
    } else {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleParse = async () => {
    if (!file) {
      toast.error('파일을 선택하세요');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/card-expense/parse', {
        method: 'POST',
        body: formData,
      });

      const data: CardExpenseParseResponse = await res.json();

      if (data.success) {
        setTransactions(data.transactions);
        setMatchingRecord(data.matchingRecord);
        setTotalAmount(data.totalAmount);
        setWarning(data.warning || null);
        toast.success(`${data.transactions.length}건의 거래를 읽었습니다`);
      } else {
        toast.error(data.error || '파일 파싱 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('파일 처리 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = (tempId: string, field: keyof CardExpenseItem, value: string | number | null) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.tempId === tempId ? { ...tx, [field]: value } : tx
      )
    );
  };

  const handleApply = async () => {
    if (!matchingRecord) {
      toast.error('매칭된 NH카드대금 항목이 없습니다');
      return;
    }

    setApplying(true);
    try {
      const res = await fetch('/api/card-expense/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          nhCardRecordId: matchingRecord.id,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // 초기화
        setFile(null);
        setTransactions([]);
        setMatchingRecord(null);
        setWarning(null);
        setConfirmDialogOpen(false);
      } else {
        toast.error(data.error || '반영 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('반영 중 오류가 발생했습니다');
    } finally {
      setApplying(false);
    }
  };

  // 미완료 항목 수
  const incompleteCount = transactions.filter(
    (tx) => !tx.description || tx.account_code === null
  ).length;

  // 코드 그룹화
  const groupedCodes = expenseCodes.reduce((acc, code) => {
    if (!acc[code.category_code]) {
      acc[code.category_code] = { name: code.category_item, codes: [] };
    }
    acc[code.category_code].codes.push(code);
    return acc;
  }, {} as Record<number, { name: string; codes: ExpenseCode[] }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">카드대금 세부반영</h1>
      </div>

      {/* 파일 업로드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            결제내역 파일 업로드
          </CardTitle>
          <CardDescription>
            NH카드에서 다운로드한 결제내역 엑셀 파일을 업로드하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            {file ? (
              <p className="text-slate-700 font-medium">{file.name}</p>
            ) : (
              <p className="text-slate-500">
                클릭하거나 파일을 드래그하여 업로드하세요
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleParse} disabled={!file || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                '자료읽기'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 경고 배너 */}
      {warning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>경고</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      {/* 매칭 정보 */}
      {matchingRecord && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>매칭된 NH카드대금 항목</AlertTitle>
          <AlertDescription>
            기준일: {matchingRecord.date} | 금액: {matchingRecord.amount.toLocaleString()}원
          </AlertDescription>
        </Alert>
      )}

      {/* 거래 테이블 */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              카드 거래 내역
            </CardTitle>
            <CardDescription>
              {transactions.length}건 | 합계: {totalAmount.toLocaleString()}원
              {incompleteCount > 0 && (
                <span className="text-amber-600 ml-2">
                  ({incompleteCount}건 입력 필요)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">거래일</TableHead>
                    <TableHead className="w-[80px]">소유자</TableHead>
                    <TableHead>가맹점</TableHead>
                    <TableHead className="text-right w-[100px]">금액</TableHead>
                    <TableHead className="w-[150px]">내역</TableHead>
                    <TableHead className="w-[150px]">계정과목</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const isIncomplete = !tx.description || tx.account_code === null;
                    return (
                      <TableRow
                        key={tx.tempId}
                        className={isIncomplete ? 'bg-amber-50' : ''}
                      >
                        <TableCell className="text-sm">{tx.transaction_date}</TableCell>
                        <TableCell className="text-sm">{tx.vendor}</TableCell>
                        <TableCell className="text-sm">{tx.note}</TableCell>
                        <TableCell className="text-right font-medium">
                          {tx.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={tx.description}
                            onChange={(e) =>
                              updateTransaction(tx.tempId, 'description', e.target.value)
                            }
                            placeholder="내역 입력"
                            className={`h-8 text-sm ${!tx.description ? 'border-amber-400' : ''}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={tx.account_code?.toString() || ''}
                            onValueChange={(val) =>
                              updateTransaction(tx.tempId, 'account_code', val ? Number(val) : null)
                            }
                          >
                            <SelectTrigger
                              className={`h-8 text-sm ${tx.account_code === null ? 'border-amber-400' : ''}`}
                            >
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(groupedCodes).map(([catCode, group]) => (
                                <div key={catCode}>
                                  <div className="px-2 py-1 text-xs text-slate-500 font-medium bg-slate-100">
                                    {group.name}
                                  </div>
                                  {group.codes.map((code) => (
                                    <SelectItem key={code.code} value={code.code.toString()}>
                                      {code.code} {code.item}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => setConfirmDialogOpen(true)}
                disabled={incompleteCount > 0 || !matchingRecord || applying}
              >
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    반영 중...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    지출부에 반영
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 확인 다이얼로그 */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지출부에 반영하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {transactions.length}건의 카드 거래가 지출부에 추가되고,
              기존 NH카드대금 항목({matchingRecord?.amount.toLocaleString()}원)은 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply}>반영</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
