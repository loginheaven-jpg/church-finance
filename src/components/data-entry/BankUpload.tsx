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
import { Upload, FileText, Loader2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BankTransaction } from '@/types';

export function BankUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [data, setData] = useState<BankTransaction[]>([]);
  const [result, setResult] = useState<{ uploaded: number; message: string } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.xlsx'))) {
      setFile(droppedFile);
      setData([]);
      setResult(null);
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

  // 은행원장에 반영
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
        setData([]);
        setFile(null);
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

  // 기준일별 합계 계산 (date = 주일)
  const getDateSummary = () => {
    const dateMap = new Map<string, { withdrawal: number; deposit: number }>();

    data.forEach(item => {
      const dateKey = item.date; // 기준일 (주일) 기준으로 합산
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

  // 총액 계산
  const totalWithdrawal = data.reduce((sum, item) => sum + item.withdrawal, 0);
  const totalDeposit = data.reduce((sum, item) => sum + item.deposit, 0);
  const dateSummary = getDateSummary();

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

        {file && data.length === 0 && (
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

        {/* 완료 결과 */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <CheckCircle2 className="h-5 w-5" />
              업로드 완료
            </div>
            <p className="text-sm text-green-600">{result.message}</p>
          </div>
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
              {/* 은행원장에 반영 버튼 */}
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
                은행원장에 반영
              </Button>

              {/* 기준일별 합계 (주일) */}
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

              {/* 테이블 */}
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
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.detail}
                            onChange={(e) => handleCellChange(index, 'detail', e.target.value)}
                            className="h-7 text-sm w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.memo}
                            onChange={(e) => handleCellChange(index, 'memo', e.target.value)}
                            className="h-7 text-sm w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRow(index)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          >
                            &times;
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
