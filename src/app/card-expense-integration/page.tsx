'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, Upload, CreditCard, AlertTriangle, Check, FileSpreadsheet, Filter, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import type { CardExpenseParseResponse, CardExpenseTempRecord, ExpenseCode } from '@/types';

export default function CardExpenseIntegrationPage() {
  const session = useFinanceSession();
  const isSuperAdmin = session?.finance_role === 'super_admin';
  const isAdmin = session?.finance_role ? hasRole(session.finance_role, 'admin') : false;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [transactions, setTransactions] = useState<CardExpenseTempRecord[]>([]);
  const [matchingRecord, setMatchingRecord] = useState<{ id: string | null; date: string | null; amount: number | null } | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);
  const [applying, setApplying] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [vendorStats, setVendorStats] = useState<Record<string, { total: number; completed: number }>>({});
  const savingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [saving, setSaving] = useState(false);

  // 전체 저장 (디바운스 무시하고 즉시 저장)
  const handleSaveAll = useCallback(async () => {
    // 대기 중인 타이머 모두 취소
    Object.values(savingRef.current).forEach(timer => clearTimeout(timer));
    savingRef.current = {};

    setSaving(true);
    try {
      // 현재 transactions의 모든 항목을 저장
      const savePromises = transactions.map(tx =>
        fetch('/api/card-expense/temp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempId: tx.tempId,
            description: tx.description,
            account_code: tx.account_code,
          }),
        })
      );
      await Promise.all(savePromises);
      toast.success('저장되었습니다');
    } catch (error) {
      console.error('Save all failed:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  }, [transactions]);

  // 서버에서 임시 데이터 조회
  const fetchTempData = useCallback(async () => {
    try {
      const res = await fetch('/api/card-expense/temp?status=pending');
      const data = await res.json();
      if (data.success) {
        // 초기 정렬: 내역 빈값 먼저 → 보유자 → 거래일
        const sortedRecords = [...data.records].sort((a: CardExpenseTempRecord, b: CardExpenseTempRecord) => {
          const aIncomplete = !a.description || a.account_code === null;
          const bIncomplete = !b.description || b.account_code === null;
          if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
          const vendorCompare = (a.vendor || '').localeCompare(b.vendor || '', 'ko');
          if (vendorCompare !== 0) return vendorCompare;
          return (a.transaction_date || '').localeCompare(b.transaction_date || '');
        });
        setTransactions(sortedRecords);
        setMatchingRecord(data.matchingRecord);
        setTotalAmount(data.totalAmount);
        if (data.vendorStats) {
          setVendorStats(data.vendorStats);
        }
        // 매칭 정보가 없으면 경고
        if (!data.matchingRecord && sortedRecords.length > 0) {
          setWarning(`지출부에서 금액과 일치하는 'NH카드대금' 항목을 찾을 수 없습니다.`);
        } else {
          setWarning(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch temp data:', error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // 지출부코드 로드 및 서버 데이터 조회
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

  // 세션 로드 후 서버 데이터 조회
  useEffect(() => {
    if (session) {
      fetchTempData();
    }
  }, [session, fetchTempData]);

  // 서버에 항목 저장 (디바운스)
  const saveToServer = useCallback(async (tempId: string, updates: { description?: string; account_code?: number | null }) => {
    // 기존 타이머가 있으면 취소
    if (savingRef.current[tempId]) {
      clearTimeout(savingRef.current[tempId]);
    }

    // 500ms 후에 저장
    savingRef.current[tempId] = setTimeout(async () => {
      try {
        await fetch('/api/card-expense/temp', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempId, ...updates }),
        });
      } catch (error) {
        console.error('Failed to save:', error);
      }
      delete savingRef.current[tempId];
    }, 500);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
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
        toast.success(`${data.transactions.length}건의 거래를 읽었습니다`);
        // 서버에서 데이터 다시 조회 (Parse API가 시트에 저장했으므로)
        await fetchTempData();
        setFile(null);
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

  const updateTransaction = (tempId: string, field: 'description' | 'account_code', value: string | number | null) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.tempId === tempId ? { ...tx, [field]: value } : tx
      )
    );
    // 서버에 저장 (디바운스)
    if (field === 'description') {
      saveToServer(tempId, { description: value as string });
    } else if (field === 'account_code') {
      saveToServer(tempId, { account_code: value as number | null });
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch('/api/card-expense/apply', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // 서버에서 데이터 다시 조회 (status가 applied로 변경됨)
        await fetchTempData();
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

  // 고유 보유자 목록 (super_admin 필터용)
  const uniqueOwners = [...new Set(transactions.map(tx => tx.vendor).filter(Boolean))].sort();

  // 보유자별 필터링 (서버에서 권한 기반 필터링은 이미 수행됨, 여기서는 UI 필터만)
  const filteredTransactions = (() => {
    if (isSuperAdmin && selectedOwner !== 'all') {
      return transactions.filter(tx => tx.vendor === selectedOwner);
    }
    return transactions;
  })();

  // 필터된 거래의 합계
  const filteredTotalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // 미완료 항목 수 (필터된 데이터 기준)
  const incompleteCount = filteredTransactions.filter(
    (tx) => !tx.description || tx.account_code === null
  ).length;

  // 보유자별 입력현황 (서버 데이터 사용, 없으면 로컬 계산)
  const ownerStats = Object.keys(vendorStats).length > 0
    ? Object.entries(vendorStats).map(([owner, stat]) => ({ owner, ...stat }))
    : uniqueOwners.map(owner => {
        const ownerTxs = transactions.filter(tx => tx.vendor === owner);
        const completedCount = ownerTxs.filter(tx => tx.description && tx.account_code !== null).length;
        return { owner, completed: completedCount, total: ownerTxs.length };
      });

  // 코드 그룹화
  const groupedCodes = expenseCodes.reduce((acc, code) => {
    if (!acc[code.category_code]) {
      acc[code.category_code] = { name: code.category_item, codes: [] };
    }
    acc[code.category_code].codes.push(code);
    return acc;
  }, {} as Record<number, { name: string; codes: ExpenseCode[] }>);

  // 로딩 중 표시
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">카드내역 입력</h1>
        {transactions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={fetchTempData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
        )}
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
            {!isAdmin && <span className="text-amber-600 ml-2">(관리자만 업로드 가능)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isAdmin
                ? 'border-slate-300 hover:border-slate-400 cursor-pointer'
                : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
            }`}
            onDrop={isAdmin ? handleDrop : undefined}
            onDragOver={isAdmin ? handleDragOver : undefined}
            onClick={isAdmin ? () => document.getElementById('file-input')?.click() : undefined}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={!isAdmin}
            />
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            {file ? (
              <p className="text-slate-700 font-medium">{file.name}</p>
            ) : (
              <p className="text-slate-500">
                {isAdmin ? '클릭하거나 파일을 드래그하여 업로드하세요' : '파일 업로드는 관리자만 가능합니다'}
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleParse} disabled={!isAdmin || !file || loading}>
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
      {matchingRecord && matchingRecord.id && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>매칭된 NH카드대금 항목</AlertTitle>
          <AlertDescription>
            기준일: {matchingRecord.date} | 금액: {matchingRecord.amount?.toLocaleString()}원
          </AlertDescription>
        </Alert>
      )}

      {/* 거래 테이블 */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                카드 거래 내역
              </CardTitle>
              {/* super_admin만 보유자 필터 표시 */}
              {isSuperAdmin && uniqueOwners.length > 1 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="보유자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 ({transactions.length}건)</SelectItem>
                      {uniqueOwners.map(owner => (
                        <SelectItem key={owner} value={owner}>
                          {owner} ({transactions.filter(tx => tx.vendor === owner).length}건)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {filteredTransactions.length}건 | 합계: {filteredTotalAmount.toLocaleString()}원
              </span>
              {/* 보유자별 입력현황 */}
              {ownerStats.length > 0 && (
                <span className="text-slate-600">
                  {ownerStats.map((stat, idx) => (
                    <span key={stat.owner} className={stat.completed === stat.total ? 'text-green-600' : ''}>
                      {idx > 0 && ' '}
                      {stat.owner} {stat.completed === stat.total ? '완료' : `${stat.completed}/${stat.total}`}
                    </span>
                  ))}
                </span>
              )}
              {incompleteCount > 0 && (
                <span className="text-amber-600">
                  ({incompleteCount}건 입력 필요)
                </span>
              )}
              {!isSuperAdmin && session?.name && (
                <span className="text-slate-500">
                  ({session.name}님의 카드)
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
                    <TableHead className="w-[80px]">보유자</TableHead>
                    <TableHead>가맹점</TableHead>
                    <TableHead className="text-right w-[100px]">금액</TableHead>
                    <TableHead className="w-[150px]">내역</TableHead>
                    <TableHead className="w-[150px]">계정과목</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const isIncomplete = !tx.description || tx.account_code === null;
                    return (
                      <TableRow
                        key={tx.tempId}
                        className={isIncomplete ? 'bg-amber-50' : ''}
                      >
                        <TableCell className="text-sm">{tx.transaction_date || '-'}</TableCell>
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
                variant="outline"
                onClick={handleSaveAll}
                disabled={saving || filteredTransactions.length === 0}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </>
                )}
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={incompleteCount > 0 || applying || filteredTransactions.length === 0}
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
              )}
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
              {transactions.length}건의 카드 거래({totalAmount.toLocaleString()}원)가 지출부에 추가됩니다.
              {matchingRecord?.id && (
                <><br />기존 NH카드대금 항목({matchingRecord.amount?.toLocaleString()}원)은 삭제됩니다.</>
              )}
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
