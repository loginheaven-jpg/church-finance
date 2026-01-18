'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Save, Loader2, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExpenseClaimData {
  rowIndex: number;
  bankName: string;       // 구글시트 A: 은행명 -> 엑셀 J
  accountNumber: string;  // 구글시트 B: 입금계좌 -> 엑셀 H
  amount: number;         // 구글시트 C: 이체금액 -> 엑셀 F
  claimant: string;       // 구글시트 D: 청구자 -> 엑셀 이체메모
  accountCode: string;    // 구글시트 E: 계정
  description: string;    // 구글시트 G: 내역
  // 변환된 값
  depositAccount: string; // 입금통장 (항상 '예봄교회')
  withdrawNote: string;   // 출금통장 (계정 앞2자리 + 내역)
}

export default function ExpenseClaimPage() {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<ExpenseClaimData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 지출파일 생성 (데이터 조회)
  const handleLoadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/expense-claim');
      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || '데이터 조회 실패');
        return;
      }

      if (result.data.length === 0) {
        toast.info('처리할 지출청구 데이터가 없습니다');
        setData([]);
        return;
      }

      // 데이터 변환
      const transformedData: ExpenseClaimData[] = result.data.map((item: {
        rowIndex: number;
        bankName: string;
        accountNumber: string;
        amount: number;
        claimant: string;
        accountCode: string;
        description: string;
      }) => {
        // 계정의 앞 2자리 추출
        const accountPrefix = item.accountCode ? item.accountCode.substring(0, 2) : '';
        const withdrawNote = accountPrefix && item.description
          ? `${accountPrefix}${item.description}`
          : item.description || accountPrefix;

        return {
          ...item,
          depositAccount: '예봄교회',
          withdrawNote,
        };
      });

      setData(transformedData);
      setHasChanges(false);
      toast.success(`${transformedData.length}건의 데이터를 불러왔습니다`);
    } catch (error) {
      console.error('데이터 조회 오류:', error);
      toast.error('데이터 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 셀 값 수정
  const handleCellChange = (index: number, field: keyof ExpenseClaimData, value: string | number) => {
    setData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
    setHasChanges(true);
  };

  // 데이터 저장 (현재는 로컬 상태만 유지)
  const handleSave = () => {
    setHasChanges(false);
    toast.success('데이터가 저장되었습니다');
  };

  // 엑셀 다운로드 및 K컬럼 업데이트
  const handleDownload = async () => {
    if (data.length === 0) {
      toast.error('다운로드할 데이터가 없습니다');
      return;
    }

    setDownloading(true);
    try {
      // 엑셀 데이터 구성 (은행 업로드 포맷)
      // 컬럼: A~J (빈 컬럼 포함)
      // D: 입금통장, E: 출금통장, F: 금액/이체메모, H: 계좌번호, J: 은행명
      const excelData = data.map(item => ({
        'A': '',
        'B': '',
        'C': '',
        '입금통장': item.depositAccount,
        '출금통장': item.withdrawNote,
        '금액': item.amount,
        'G': '',
        '계좌번호': item.accountNumber,
        'I': '',
        '은행명': item.bankName,
      }));

      // 워크북 생성
      const ws = XLSX.utils.json_to_sheet(excelData, {
        header: ['A', 'B', 'C', '입금통장', '출금통장', '금액', 'G', '계좌번호', 'I', '은행명'],
      });

      // 헤더 제거 (실제 업로드 파일은 헤더 없음)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      range.s.r = 1; // 첫 행 스킵
      ws['!ref'] = XLSX.utils.encode_range(range);

      // 데이터만 다시 작성 (헤더 없이)
      const wsNoHeader = XLSX.utils.aoa_to_sheet(
        data.map(item => [
          '', '', '',
          item.depositAccount,
          item.withdrawNote,
          item.amount,
          '',
          item.accountNumber,
          '',
          item.bankName,
        ])
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsNoHeader, 'Sheet1');

      // 파일명 생성 (오늘 날짜)
      const today = new Date();
      const kstDate = new Date(today.getTime() + 9 * 60 * 60 * 1000);
      const dateStr = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `지출청구_${dateStr}.xlsx`;

      // 다운로드
      XLSX.writeFile(wb, fileName);

      // K컬럼 업데이트 (처리일자 기입)
      const rowIndices = data.map(item => item.rowIndex);
      const updateResponse = await fetch('/api/expense-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices }),
      });

      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        toast.success(`${data.length}건 다운로드 완료, 처리일자 기입됨`);
        setData([]); // 데이터 초기화
        setHasChanges(false);
      } else {
        toast.warning('다운로드는 완료했으나 처리일자 기입 실패');
      }
    } catch (error) {
      console.error('다운로드 오류:', error);
      toast.error('다운로드 중 오류가 발생했습니다');
    } finally {
      setDownloading(false);
    }
  };

  // 행 삭제
  const handleRemoveRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // 총액 계산
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">지출청구</h1>
        <div className="flex gap-2">
          <Button
            onClick={handleLoadData}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            지출파일 생성
          </Button>
        </div>
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                지출청구 목록 ({data.length}건)
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  variant="outline"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={downloading}
                  size="sm"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  다운로드
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="min-w-[100px]">은행명</TableHead>
                    <TableHead className="min-w-[150px]">계좌번호</TableHead>
                    <TableHead className="min-w-[120px] text-right">금액</TableHead>
                    <TableHead className="min-w-[100px]">입금통장</TableHead>
                    <TableHead className="min-w-[150px]">출금통장</TableHead>
                    <TableHead className="min-w-[80px]">이체메모</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item, index) => (
                    <TableRow key={item.rowIndex}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={item.bankName}
                          onChange={(e) => handleCellChange(index, 'bankName', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.accountNumber}
                          onChange={(e) => handleCellChange(index, 'accountNumber', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleCellChange(index, 'amount', parseInt(e.target.value) || 0)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.depositAccount}
                          onChange={(e) => handleCellChange(index, 'depositAccount', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.withdrawNote}
                          onChange={(e) => handleCellChange(index, 'withdrawNote', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{item.claimant}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRow(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          &times;
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-slate-100 px-4 py-2 rounded-lg">
                <span className="text-sm text-slate-600 mr-2">총액:</span>
                <span className="text-lg font-bold text-slate-900">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 text-center">
              &apos;지출파일 생성&apos; 버튼을 클릭하여<br />
              미처리 지출청구 데이터를 불러오세요
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
