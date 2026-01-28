'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, CheckCircle2, RefreshCw, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { CashOffering, SyncResult } from '@/types';

interface PreviewData extends CashOffering {
  representative: string;
}

export function CashOfferingSync() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<PreviewData[]>([]);
  const [donorMap, setDonorMap] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // 헌금함 데이터 갱신 (Apps Script 호출)
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/sync/cash-offering/refresh', {
        method: 'POST',
      });
      const result = await res.json();

      if (result.success) {
        toast.success('헌금함 데이터가 갱신되었습니다');
      } else {
        toast.error(result.error || '헌금함 갱신 실패');
      }
    } catch (error) {
      console.error('헌금함 갱신 오류:', error);
      toast.error('헌금함 갱신 중 오류가 발생했습니다');
    } finally {
      setRefreshing(false);
    }
  };

  // 데이터 불러오기 (미리보기)
  const handleLoadData = async () => {
    if (!startDate || !endDate) {
      toast.error('시작일과 종료일을 선택하세요');
      return;
    }

    setLoading(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/sync/cash-offering/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || '데이터 조회 실패');
        return;
      }

      if (result.data.length === 0) {
        toast.info('해당 기간에 현금헌금이 없습니다');
        setData([]);
        return;
      }

      // 데이터에 representative 추가
      const previewData: PreviewData[] = result.data.map((item: CashOffering) => ({
        ...item,
        representative: result.donorMap[item.donor_name] || item.donor_name,
      }));

      setData(previewData);
      setDonorMap(result.donorMap);
      setHasChanges(false);
      toast.success(`${previewData.length}건의 현금헌금을 불러왔습니다`);
    } catch (error) {
      console.error('데이터 조회 오류:', error);
      toast.error('데이터 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 셀 값 수정
  const handleCellChange = (index: number, field: keyof PreviewData, value: string | number) => {
    setData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
    setHasChanges(true);
  };

  // 행 삭제
  const handleRemoveRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // 수입부에 반영
  const handleSync = async () => {
    if (data.length === 0) {
      toast.error('반영할 데이터가 없습니다');
      return;
    }

    setSyncing(true);

    try {
      // 수정된 데이터와 donorMap을 함께 전송
      const res = await fetch('/api/sync/cash-offering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          previewData: data, // 수정된 데이터 전송
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSyncResult(result);
        setData([]); // 데이터 초기화
        setHasChanges(false);
        toast.success(`${result.processed}건의 현금헌금을 수입부에 반영했습니다`);
      } else {
        toast.error(result.error || '동기화 중 오류가 발생했습니다');
      }
    } catch (error) {
      toast.error('동기화 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  // 주일별 합계 계산
  const getSundaySummary = () => {
    const sundayMap = new Map<string, number>();

    data.forEach(item => {
      const dateKey = item.date;
      sundayMap.set(dateKey, (sundayMap.get(dateKey) || 0) + item.amount);
    });

    return Array.from(sundayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));
  };

  // 총액 계산
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const sundaySummary = getSundaySummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle>현금헌금 동기화</CardTitle>
        <CardDescription>
          Google Sheets 헌금함 데이터를 수입부로 가져옵니다.
          동일 금액의 은행 입금은 자동으로 말소됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">시작일</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">종료일</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing || loading} variant="outline" className="flex-1">
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                갱신 중...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                헌금함 갱신
              </>
            )}
          </Button>
          <Button onClick={handleLoadData} disabled={loading || refreshing} className="flex-1" variant="outline">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                불러오는 중...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                구글시트에서 가져오기
              </>
            )}
          </Button>
        </div>

        {/* 동기화 완료 결과 */}
        {syncResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <CheckCircle2 className="h-5 w-5" />
              동기화 완료
            </div>
            <ul className="list-disc list-inside text-base text-green-600 space-y-1">
              <li>처리된 헌금: {syncResult.processed}건</li>
              <li>총 금액: {syncResult.totalAmount?.toLocaleString()}원</li>
              {syncResult.suppressedBankTransactions > 0 && (
                <li>말소된 은행 입금: {syncResult.suppressedBankTransactions}건</li>
              )}
            </ul>
            {syncResult.warnings?.map((warning, idx) => (
              <p key={idx} className="text-amber-600 mt-2 text-base">⚠️ {warning}</p>
            ))}
          </div>
        )}

        {/* 미리보기 데이터 */}
        {data.length > 0 && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="h-5 w-5" />
                  현금헌금 목록 ({data.length}건)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 수입부에 반영 버튼 */}
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="w-full"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                수입부에 반영
              </Button>
              {/* 주일별 합계 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-base font-medium text-blue-700 mb-2">주일별 합계</div>
                <div className="flex flex-wrap gap-3">
                  {sundaySummary.map(({ date, amount }) => (
                    <div key={date} className="bg-white px-3 py-1.5 rounded border border-blue-200">
                      <span className="text-base text-blue-600 mr-2">{date}</span>
                      <span className="font-semibold text-blue-800">{amount.toLocaleString()}원</span>
                    </div>
                  ))}
                  <div className="bg-blue-100 px-3 py-1.5 rounded border border-blue-300">
                    <span className="text-base text-blue-700 mr-2">총합계</span>
                    <span className="font-bold text-blue-900">{totalAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 테이블 */}
              <div className="rounded-md border max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead className="w-[50px]">No</TableHead>
                      <TableHead className="min-w-[100px]">날짜</TableHead>
                      <TableHead className="min-w-[80px]">경로</TableHead>
                      <TableHead className="min-w-[80px]">헌금자</TableHead>
                      <TableHead className="min-w-[80px]">대표자</TableHead>
                      <TableHead className="min-w-[100px] text-right">금액</TableHead>
                      <TableHead className="min-w-[80px]">코드</TableHead>
                      <TableHead className="min-w-[100px]">비고</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, index) => (
                      <TableRow key={`${item.date}-${index}`}>
                        <TableCell className="font-medium text-base">{index + 1}</TableCell>
                        <TableCell className="text-base">{item.date}</TableCell>
                        <TableCell className="text-base">{item.source}</TableCell>
                        <TableCell>
                          <Input
                            value={item.donor_name}
                            onChange={(e) => handleCellChange(index, 'donor_name', e.target.value)}
                            className="h-7 text-base w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.representative}
                            onChange={(e) => handleCellChange(index, 'representative', e.target.value)}
                            className="h-7 text-base w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleCellChange(index, 'amount', parseInt(e.target.value) || 0)}
                            className="h-7 text-base text-right w-24"
                          />
                        </TableCell>
                        <TableCell className="text-base">{item.code}</TableCell>
                        <TableCell>
                          <Input
                            value={item.note}
                            onChange={(e) => handleCellChange(index, 'note', e.target.value)}
                            className="h-7 text-base w-24"
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
        {data.length === 0 && !loading && !syncResult && (
          <div className="text-center py-8 text-slate-500">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>&apos;구글시트에서 가져오기&apos; 버튼을 클릭하여<br />현금헌금 데이터를 불러오세요</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
