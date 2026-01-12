'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Printer, Eye, Search, RefreshCw, Download, Plus, Split, Trash2, History, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DonationReceipt, ManualReceiptHistory } from '@/types';
import { downloadReceiptPdf } from '@/lib/receipt-pdf';

// 탭 타입
type TabType = 'list' | 'history';

// 수작업 발행 폼 타입
interface ManualForm {
  representative: string;
  address: string;
  resident_id: string;
  amount: string;
  issue_number: string;
}

// 분할 발행 수령인 타입
interface SplitRecipient {
  name: string;
  address: string;
  resident_id: string;
  amount: string;
  issue_number: string;
}

export default function DonationReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  // 기부금 영수증은 항상 전년도 실적으로 발행하므로 작년을 기본값으로 설정
  const [year, setYear] = useState((new Date().getFullYear() - 1).toString());
  const [search, setSearch] = useState('');
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [previewReceipt, setPreviewReceipt] = useState<DonationReceipt | null>(null);
  const [summary, setSummary] = useState({ totalRepresentatives: 0, totalAmount: 0 });
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  // 수작업 발행 상태
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>({
    representative: '',
    address: '',
    resident_id: '',
    amount: '',
    issue_number: '',
  });
  const [manualLoading, setManualLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // 분할 발행 상태
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitSource, setSplitSource] = useState<DonationReceipt | null>(null);
  const [splitRecipients, setSplitRecipients] = useState<SplitRecipient[]>([
    { name: '', address: '', resident_id: '', amount: '', issue_number: '' },
    { name: '', address: '', resident_id: '', amount: '', issue_number: '' },
  ]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitPercentage, setSplitPercentage] = useState<string>(''); // 수령인1의 비율 (%)

  // 발급번호 정보
  const [issueNumberInfo, setIssueNumberInfo] = useState<{
    existingNumbers: string[];
    nextIssueNumber: string;
  }>({ existingNumbers: [], nextIssueNumber: '' });

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('list');

  // 발행이력 상태
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<ManualReceiptHistory[]>([]);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // 발행완료 상태
  const [issuedRepresentatives, setIssuedRepresentatives] = useState<Set<string>>(new Set());
  const [hideIssued, setHideIssued] = useState(false);
  const [markingIssued, setMarkingIssued] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (search) params.set('representative', search);

      const res = await fetch(`/api/donors/receipts?${params}`);
      const data = await res.json();

      if (data.success) {
        setReceipts(data.data);
        setSummary(data.summary);
        setSelectedReceipts(new Set());
        if (data.issueNumberInfo) {
          setIssueNumberInfo(data.issueNumberInfo);
        }
        if (data.issuedRepresentatives) {
          setIssuedRepresentatives(new Set(data.issuedRepresentatives));
        }
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [year]);

  // 발행이력 조회
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/donors/receipts/manual?year=${year}&mode=history`);
      const data = await res.json();
      if (data.success) {
        setHistoryData(data.data || []);
      } else {
        toast.error(data.error || '발행이력 조회 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('발행이력을 불러오는 중 오류가 발생했습니다');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 발행이력 삭제
  const handleDeleteHistory = async (issueNumber: string) => {
    if (!confirm(`발급번호 ${issueNumber}을(를) 삭제하시겠습니까?\n삭제 후 같은 번호로 다시 발행할 수 있습니다.`)) {
      return;
    }

    setDeleteLoading(issueNumber);
    try {
      const res = await fetch(`/api/donors/receipts/manual?year=${year}&issue_number=${encodeURIComponent(issueNumber)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('삭제되었습니다');
        fetchHistory();
      } else {
        toast.error(data.error || '삭제 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('삭제 중 오류가 발생했습니다');
    } finally {
      setDeleteLoading(null);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, year]);

  // 발행완료 처리 (선택된 항목을 발행이력에 추가)
  const handleMarkIssued = async () => {
    if (selectedReceipts.size === 0) {
      toast.error('발행완료 처리할 항목을 선택해주세요');
      return;
    }

    setMarkingIssued(true);
    let successCount = 0;
    const failedItems: string[] = [];

    try {
      for (const rep of selectedReceipts) {
        // 이미 발행완료된 항목은 건너뛰기
        if (issuedRepresentatives.has(rep)) {
          continue;
        }

        const receipt = receipts.find(r => r.representative === rep);
        if (!receipt) continue;

        const res = await fetch('/api/donors/receipts/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: parseInt(year),
            representative: receipt.representative,
            address: receipt.address || '',
            resident_id: receipt.resident_id || '',
            amount: receipt.total_amount,
            issue_number: receipt.issue_number,
            note: '일괄',
          }),
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failedItems.push(`${rep}: ${data.error}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}건 발행완료 처리되었습니다`);
        fetchReceipts(); // 새로고침하여 발행완료 상태 갱신
      }
      if (failedItems.length > 0) {
        toast.error(`실패: ${failedItems.join(', ')}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('발행완료 처리 중 오류가 발생했습니다');
    } finally {
      setMarkingIssued(false);
    }
  };

  // 발행완료 필터링된 영수증 목록
  const filteredReceipts = hideIssued
    ? receipts.filter(r => !issuedRepresentatives.has(r.representative))
    : receipts;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReceipts();
  };

  const toggleSelect = (representative: string) => {
    const newSelected = new Set(selectedReceipts);
    if (newSelected.has(representative)) {
      newSelected.delete(representative);
    } else {
      newSelected.add(representative);
    }
    setSelectedReceipts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReceipts.size === receipts.length) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(receipts.map((r) => r.representative)));
    }
  };

  const openPrintPage = (representative: string, issueNumber?: string) => {
    const receipt = receipts.find(r => r.representative === representative);
    const actualIssueNumber = issueNumber || receipt?.issue_number || '';
    const printUrl = `/donors/receipts/print?year=${year}&representative=${encodeURIComponent(representative)}&issue_number=${encodeURIComponent(actualIssueNumber)}`;
    window.open(printUrl, '_blank');
  };

  // 일괄 PDF 다운로드 (+ 발행이력 자동 추가)
  const handleBatchDownload = async () => {
    const selected = Array.from(selectedReceipts);
    if (selected.length === 0) return;

    setDownloading(true);
    setDownloadProgress({ current: 0, total: selected.length });

    let successCount = 0;
    let failCount = 0;
    let historyAddedCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const rep = selected[i];
      const receipt = receipts.find(r => r.representative === rep);

      setDownloadProgress({ current: i + 1, total: selected.length });

      if (receipt) {
        const success = await downloadReceiptPdf(receipt, year);
        if (success) {
          successCount++;

          // 이미 발행완료된 항목이 아닌 경우에만 발행이력 추가
          if (!issuedRepresentatives.has(rep)) {
            try {
              const res = await fetch('/api/donors/receipts/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  year: parseInt(year),
                  representative: receipt.representative,
                  address: receipt.address || '',
                  resident_id: receipt.resident_id || '',
                  amount: receipt.total_amount,
                  issue_number: receipt.issue_number,
                  note: '일괄',
                }),
              });
              const data = await res.json();
              if (data.success) {
                historyAddedCount++;
              }
            } catch (error) {
              console.error('발행이력 추가 실패:', rep, error);
            }
          }
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }

      // 다음 다운로드 전 약간의 딜레이 (브라우저 안정성)
      if (i < selected.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    setDownloading(false);
    setDownloadProgress({ current: 0, total: 0 });

    if (failCount === 0) {
      const historyMsg = historyAddedCount > 0 ? ` (${historyAddedCount}건 이력 추가)` : '';
      toast.success(`${successCount}개의 영수증 PDF가 다운로드되었습니다${historyMsg}`);
    } else {
      toast.warning(`${successCount}개 성공, ${failCount}개 실패`);
    }

    setSelectedReceipts(new Set());

    // 발행이력이 추가되었으면 목록 새로고침
    if (historyAddedCount > 0) {
      fetchReceipts();
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  // 금액 문자열을 숫자로 변환
  const parseAmount = (str: string): number => {
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
  };

  // 금액 입력 포맷팅
  const formatAmountInput = (value: string): string => {
    const num = parseAmount(value);
    return num > 0 ? num.toLocaleString('ko-KR') : '';
  };

  // 비율 기반 금액 계산 (수령인1 비율 입력 시)
  const handlePercentageChange = (percentStr: string) => {
    const percent = parseInt(percentStr.replace(/[^0-9]/g, '')) || 0;
    if (percent < 0 || percent > 100) return;

    setSplitPercentage(percentStr);

    if (splitSource && percent > 0) {
      const total = splitSource.total_amount;
      const amount1 = Math.round(total * percent / 100);
      const amount2 = total - amount1; // 잔액은 수령인2에게

      setSplitRecipients((prev) => [
        { ...prev[0], amount: formatAmountInput(amount1.toString()) },
        { ...prev[1], amount: formatAmountInput(amount2.toString()) },
      ]);
    }
  };

  // 수령인1 금액 변경 시 수령인2 자동 잔액 계산
  const handleSplitAmount1Change = (value: string) => {
    const amount1 = parseAmount(value);

    setSplitRecipients((prev) => {
      const updated = [...prev];
      updated[0] = { ...updated[0], amount: formatAmountInput(value) };

      // 수령인2의 금액을 자동으로 잔액으로 설정
      if (splitSource) {
        const amount2 = Math.max(0, splitSource.total_amount - amount1);
        updated[1] = { ...updated[1], amount: formatAmountInput(amount2.toString()) };
      }

      return updated;
    });

    // 비율도 역계산하여 업데이트
    if (splitSource && amount1 > 0) {
      const percent = Math.round((amount1 / splitSource.total_amount) * 100);
      setSplitPercentage(percent.toString());
    } else {
      setSplitPercentage('');
    }
  };

  // 교인 정보 조회
  const handleLookup = async (name: string, target: 'manual' | 'split', splitIndex?: number) => {
    if (!name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(`/api/donors/lookup?name=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.success && data.data) {
        if (target === 'manual') {
          setManualForm((prev) => ({
            ...prev,
            address: data.data.address || '',
            resident_id: data.data.resident_id || '',
          }));
          if (data.data.source === 'not_found') {
            toast.info('등록된 정보가 없습니다. 직접 입력해주세요.');
          } else {
            toast.success('정보를 불러왔습니다');
          }
        } else if (target === 'split' && splitIndex !== undefined) {
          setSplitRecipients((prev) => {
            const updated = [...prev];
            updated[splitIndex] = {
              ...updated[splitIndex],
              address: data.data.address || '',
              resident_id: data.data.resident_id || '',
            };
            return updated;
          });
          if (data.data.source !== 'not_found') {
            toast.success('정보를 불러왔습니다');
          }
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('조회 중 오류가 발생했습니다');
    } finally {
      setLookupLoading(false);
    }
  };

  // 수작업 발행 다이얼로그 열기
  const openManualDialog = async () => {
    // 다음 발급번호 조회
    try {
      const res = await fetch(`/api/donors/receipts/manual?year=${year}`);
      const data = await res.json();
      if (data.success) {
        setManualForm({
          representative: '',
          address: '',
          resident_id: '',
          amount: '',
          issue_number: data.nextIssueNumber,
        });
      }
    } catch (error) {
      console.error(error);
    }
    setShowManualDialog(true);
  };

  // 수작업 발행 실행
  const handleManualIssue = async () => {
    if (!manualForm.representative.trim()) {
      toast.error('대표자명을 입력해주세요');
      return;
    }
    if (!parseAmount(manualForm.amount)) {
      toast.error('금액을 입력해주세요');
      return;
    }
    if (!manualForm.issue_number.trim()) {
      toast.error('발급번호를 입력해주세요');
      return;
    }

    setManualLoading(true);
    try {
      // 발급 이력 저장
      const saveRes = await fetch('/api/donors/receipts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(year),
          representative: manualForm.representative,
          address: manualForm.address,
          resident_id: manualForm.resident_id,
          amount: parseAmount(manualForm.amount),
          issue_number: manualForm.issue_number,
          original_issue_number: '',
          note: '수작업',
        }),
      });

      const saveData = await saveRes.json();
      if (!saveData.success) {
        toast.error(saveData.error || '저장 중 오류가 발생했습니다');
        setManualLoading(false);
        return;
      }

      // PDF 다운로드
      const receipt: DonationReceipt = {
        year: parseInt(year),
        representative: manualForm.representative,
        address: manualForm.address,
        resident_id: manualForm.resident_id,
        total_amount: parseAmount(manualForm.amount),
        issue_number: saveData.data?.issue_number || manualForm.issue_number,
        donors: [],
        donations: [],
      };

      const success = await downloadReceiptPdf(receipt, year);
      if (success) {
        toast.success('영수증이 발행되었습니다');
        setShowManualDialog(false);
        fetchReceipts();
      } else {
        toast.error('PDF 생성 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error(error);
      toast.error('발행 중 오류가 발생했습니다');
    } finally {
      setManualLoading(false);
    }
  };

  // 분할 발행 다이얼로그 열기
  const openSplitDialog = async (receipt: DonationReceipt) => {
    setSplitSource(receipt);
    setSplitPercentage(''); // 비율 초기화

    // 분할 발급번호 조회
    try {
      const res = await fetch(
        `/api/donors/receipts/manual?year=${year}&base_number=${receipt.issue_number}`
      );
      const data = await res.json();
      if (data.success) {
        setSplitRecipients([
          {
            // 수령인1: 원본 수령인 정보 자동 입력
            name: receipt.representative,
            address: receipt.address || '',
            resident_id: receipt.resident_id || '',
            amount: '',
            issue_number: data.nextIssueNumber,
          },
          {
            name: '',
            address: '',
            resident_id: '',
            amount: '',
            issue_number: data.nextSplitNumber || `${receipt.issue_number}-3`,
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setSplitRecipients([
        {
          // 수령인1: 원본 수령인 정보 자동 입력
          name: receipt.representative,
          address: receipt.address || '',
          resident_id: receipt.resident_id || '',
          amount: '',
          issue_number: `${receipt.issue_number}-2`
        },
        { name: '', address: '', resident_id: '', amount: '', issue_number: `${receipt.issue_number}-3` },
      ]);
    }
    setShowSplitDialog(true);
  };

  // 분할 발행 실행
  const handleSplitIssue = async () => {
    if (!splitSource) return;

    // 검증
    for (let i = 0; i < splitRecipients.length; i++) {
      const r = splitRecipients[i];
      if (!r.name.trim()) {
        toast.error(`수령인 ${i + 1}의 이름을 입력해주세요`);
        return;
      }
      if (!parseAmount(r.amount)) {
        toast.error(`수령인 ${i + 1}의 금액을 입력해주세요`);
        return;
      }
    }

    // 합계 검증
    const totalSplit = splitRecipients.reduce((sum, r) => sum + parseAmount(r.amount), 0);
    if (totalSplit !== splitSource.total_amount) {
      toast.error(`합계가 원본 금액(${formatAmount(splitSource.total_amount)})과 일치해야 합니다`);
      return;
    }

    setSplitLoading(true);
    let hasError = false;
    const failedRecipients: string[] = [];

    try {
      for (const recipient of splitRecipients) {
        // 발급 이력 저장
        const saveRes = await fetch('/api/donors/receipts/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: parseInt(year),
            representative: recipient.name,
            address: recipient.address,
            resident_id: recipient.resident_id,
            amount: parseAmount(recipient.amount),
            issue_number: recipient.issue_number,
            original_issue_number: splitSource.issue_number,
            note: '분할',
          }),
        });

        const saveData = await saveRes.json();
        if (!saveData.success) {
          hasError = true;
          failedRecipients.push(`${recipient.name}: ${saveData.error}`);
          continue;
        }

        // PDF 다운로드 (API 응답 또는 입력값 사용)
        const receipt: DonationReceipt = {
          year: parseInt(year),
          representative: recipient.name,
          address: recipient.address,
          resident_id: recipient.resident_id,
          total_amount: parseAmount(recipient.amount),
          issue_number: saveData.data?.issue_number || recipient.issue_number,
          donors: [],
          donations: [],
        };

        await downloadReceiptPdf(receipt, year);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (hasError) {
        // 에러가 있으면 다이얼로그 유지
        toast.error(`발행 실패: ${failedRecipients.join(', ')}`);
      } else {
        // 모두 성공하면 다이얼로그 닫기
        toast.success('분할 발행이 완료되었습니다');
        setShowSplitDialog(false);
        fetchReceipts();
      }
    } catch (error) {
      console.error(error);
      toast.error('분할 발행 중 오류가 발생했습니다');
    } finally {
      setSplitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">기부금영수증 발급</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openManualDialog}>
            <Plus className="mr-2 h-4 w-4" />
            수작업 발행
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (selectedReceipts.size === 1) {
                const rep = Array.from(selectedReceipts)[0];
                const receipt = receipts.find((r) => r.representative === rep);
                if (receipt) openSplitDialog(receipt);
              }
            }}
            disabled={selectedReceipts.size !== 1}
          >
            <Split className="mr-2 h-4 w-4" />
            분할 발행
          </Button>
          <Button variant="outline" onClick={fetchReceipts}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                연말정산용 기부금영수증
              </CardTitle>
              <CardDescription>
                대표자별 헌금 내역을 확인하고 PDF 영수증을 발급합니다
              </CardDescription>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex gap-1 mt-4 border-b">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
              영수증 목록
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
              발행이력 ({historyData.length})
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 연도 선택 - 공통 */}
          <div className="flex gap-4 mb-6">
            <div className="w-32">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeTab === 'list' && (
              <>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    placeholder="대표자명으로 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button type="submit" variant="outline">
                    <Search className="mr-2 h-4 w-4" />
                    검색
                  </Button>
                </form>
                <Button
                  variant="outline"
                  onClick={handleMarkIssued}
                  disabled={markingIssued || selectedReceipts.size === 0}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  {markingIssued ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  발행완료
                </Button>
                <label className="flex items-center gap-2 ml-auto cursor-pointer text-sm text-slate-600">
                  <Checkbox
                    checked={hideIssued}
                    onCheckedChange={(checked) => setHideIssued(checked === true)}
                  />
                  발행완료 제외
                </label>
              </>
            )}
            {activeTab === 'history' && (
              <Button variant="outline" onClick={fetchHistory} className="ml-auto">
                <RefreshCw className="mr-2 h-4 w-4" />
                새로고침
              </Button>
            )}
          </div>

          {/* 영수증 목록 탭 */}
          {activeTab === 'list' && (
            <>
              {/* 요약 */}
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-sm text-slate-500">총 대표자 수</div>
              <div className="text-2xl font-bold">{summary.totalRepresentatives}명</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">발행완료</div>
              <div className="text-2xl font-bold text-green-600">{issuedRepresentatives.size}명</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">총 헌금액</div>
              <div className="text-2xl font-bold">{formatAmount(summary.totalAmount)}</div>
            </div>
          </div>

          {/* 선택 항목 일괄 다운로드 - 테이블 위에 표시 */}
          {selectedReceipts.size > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-blue-700">
                {downloading
                  ? `다운로드 중... (${downloadProgress.current}/${downloadProgress.total})`
                  : `${selectedReceipts.size}명 선택됨`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    Array.from(selectedReceipts).forEach((rep, idx) => {
                      setTimeout(() => openPrintPage(rep), idx * 300);
                    });
                  }}
                  disabled={downloading}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  화면보기
                </Button>
                <Button
                  onClick={handleBatchDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  PDF 일괄저장
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {year}년 헌금 내역이 없습니다
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedReceipts.size === filteredReceipts.length && filteredReceipts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-24">발급번호</TableHead>
                    <TableHead>대표자명</TableHead>
                    <TableHead className="text-center">헌금 횟수</TableHead>
                    <TableHead className="text-right">총액</TableHead>
                    <TableHead className="w-16 text-center">발행</TableHead>
                    <TableHead className="w-16 text-center">점검</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.representative}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReceipts.has(receipt.representative)}
                          onCheckedChange={() => toggleSelect(receipt.representative)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">
                        {receipt.issue_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {receipt.representative}
                      </TableCell>
                      <TableCell className="text-center">
                        {receipt.donations.length}회
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(receipt.total_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {issuedRepresentatives.has(receipt.representative) && (
                          <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {(!receipt.resident_id || !receipt.address || !receipt.total_amount) && (
                          <CheckCircle className="h-5 w-5 text-orange-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewReceipt(receipt)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPrintPage(receipt.representative)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
            </>
          )}

          {/* 발행이력 탭 */}
          {activeTab === 'history' && (
            <>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {year}년 발행이력이 없습니다
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">발급번호</TableHead>
                      <TableHead>대표자</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="w-40">발급일시</TableHead>
                      <TableHead className="w-20 text-center">구분</TableHead>
                      <TableHead className="w-28">원본번호</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map((item) => (
                      <TableRow key={item.issue_number}>
                        <TableCell className="font-mono text-sm">{item.issue_number}</TableCell>
                        <TableCell className="font-medium">{item.representative}</TableCell>
                        <TableCell className="text-right">{formatAmount(item.amount)}</TableCell>
                        <TableCell className="text-sm text-slate-500">{item.issued_at}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            item.note === '분할' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.note || '수작업'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-500">
                          {item.original_issue_number || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteHistory(item.issue_number)}
                            disabled={deleteLoading === item.issue_number}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {deleteLoading === item.issue_number ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 미리보기 다이얼로그 */}
      <Dialog open={!!previewReceipt} onOpenChange={(open) => !open && setPreviewReceipt(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>기부금영수증 미리보기</DialogTitle>
            <DialogDescription>
              발급번호: {previewReceipt?.issue_number} | {previewReceipt?.representative} - {year}년
            </DialogDescription>
          </DialogHeader>

          {previewReceipt && (
            <div className="space-y-6">
              {/* 기부자 정보 */}
              <div>
                <h3 className="font-semibold mb-2">기부자</h3>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-24 text-slate-500">성명</span>
                      <span className="font-medium">{previewReceipt.representative}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500">주민번호</span>
                      <span className="font-mono">
                        {previewReceipt.resident_id
                          ? `${previewReceipt.resident_id.slice(0, 6)}-${previewReceipt.resident_id.slice(6)}*******`
                          : '(미등록)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-slate-500">주소</span>
                    <span>{previewReceipt.address || '(미등록)'}</span>
                  </div>
                </div>
              </div>

              {/* 기부내역 요약 */}
              <div>
                <h3 className="font-semibold mb-2">기부내역</h3>
                <div className="border rounded-lg p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>유형</TableHead>
                        <TableHead className="text-center">코드</TableHead>
                        <TableHead>구분</TableHead>
                        <TableHead>기부기간</TableHead>
                        <TableHead className="text-right">기부금액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>종교단체</TableCell>
                        <TableCell className="text-center">41</TableCell>
                        <TableCell>헌금</TableCell>
                        <TableCell>{year}년 1월 1일 ~ 12월 31일</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatAmount(previewReceipt.total_amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 기부금 단체 정보 */}
              <div>
                <h3 className="font-semibold mb-2">기부금 수령인</h3>
                <div className="border rounded-lg p-4 space-y-1 text-sm">
                  <div><span className="text-slate-500 w-20 inline-block">단체명:</span> 대한예수교장로회 예봄교회</div>
                  <div><span className="text-slate-500 w-20 inline-block">고유번호:</span> 117-82-60597</div>
                  <div><span className="text-slate-500 w-20 inline-block">소재지:</span> 경기도 성남시 분당구 운중로 285 (판교동)</div>
                  <div><span className="text-slate-500 w-20 inline-block">대표자:</span> 최병희</div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => openPrintPage(previewReceipt.representative)}>
                  <Printer className="mr-2 h-4 w-4" />
                  인쇄 / PDF 저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 수작업 발행 다이얼로그 */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>수작업 기부금영수증 발행</DialogTitle>
            <DialogDescription>
              대표자 목록에 없는 신규 수령인의 영수증을 발행합니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>연도</Label>
              <div className="text-lg font-medium">{year}년</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-name">대표자명</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-name"
                  value={manualForm.representative}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, representative: e.target.value }))
                  }
                  placeholder="이름 입력"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleLookup(manualForm.representative, 'manual')}
                  disabled={lookupLoading}
                >
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-address">주소</Label>
              <Input
                id="manual-address"
                value={manualForm.address}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="주소 입력"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-resident">주민번호 앞자리</Label>
              <Input
                id="manual-resident"
                value={manualForm.resident_id}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, resident_id: e.target.value.slice(0, 7) }))
                }
                placeholder="000000-0"
                maxLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-amount">금액</Label>
              <div className="relative">
                <Input
                  id="manual-amount"
                  value={manualForm.amount}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      amount: formatAmountInput(e.target.value),
                    }))
                  }
                  placeholder="0"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">원</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-issue">발급번호</Label>
              <Input
                id="manual-issue"
                value={manualForm.issue_number}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, issue_number: e.target.value }))
                }
                placeholder="자동 생성"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                취소
              </Button>
              <Button onClick={handleManualIssue} disabled={manualLoading}>
                {manualLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                발행 및 PDF 저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 분할 발행 다이얼로그 */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>기부금영수증 분할 발행</DialogTitle>
            <DialogDescription>
              선택한 영수증의 금액을 분할하여 여러 명에게 발행합니다
            </DialogDescription>
          </DialogHeader>

          {splitSource && (
            <div className="space-y-4">
              {/* 원본 정보 + 버튼 */}
              <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">원본</div>
                  <div className="font-medium">
                    {splitSource.representative} ({splitSource.issue_number}) -{' '}
                    {formatAmount(splitSource.total_amount)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSplitDialog(false)}>
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSplitIssue}
                    disabled={
                      splitLoading ||
                      splitRecipients.reduce((sum, r) => sum + parseAmount(r.amount), 0) !==
                        splitSource.total_amount
                    }
                  >
                    {splitLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '발행'
                    )}
                  </Button>
                </div>
              </div>

              {/* 분할 수령인 */}
              {splitRecipients.map((recipient, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="font-medium text-slate-700">수령인 {index + 1}</div>

                  <div className="space-y-2">
                    <Label>이름</Label>
                    <div className="flex gap-2">
                      <Input
                        value={recipient.name}
                        onChange={(e) => {
                          setSplitRecipients((prev) => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], name: e.target.value };
                            return updated;
                          });
                        }}
                        placeholder="이름 입력"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLookup(recipient.name, 'split', index)}
                        disabled={lookupLoading}
                      >
                        {lookupLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>주소</Label>
                    <Input
                      value={recipient.address}
                      onChange={(e) => {
                        setSplitRecipients((prev) => {
                          const updated = [...prev];
                          updated[index] = { ...updated[index], address: e.target.value };
                          return updated;
                        });
                      }}
                      placeholder="주소 입력"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>주민번호 앞자리</Label>
                    <Input
                      value={recipient.resident_id}
                      onChange={(e) => {
                        setSplitRecipients((prev) => {
                          const updated = [...prev];
                          updated[index] = {
                            ...updated[index],
                            resident_id: e.target.value.slice(0, 7),
                          };
                          return updated;
                        });
                      }}
                      placeholder="000000-0"
                      maxLength={8}
                    />
                  </div>

                  {/* 수령인1: 비율 + 금액 + 발급번호 */}
                  {index === 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>비율</Label>
                          <div className="relative">
                            <Input
                              value={splitPercentage}
                              onChange={(e) => handlePercentageChange(e.target.value)}
                              placeholder="예: 60"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                              %
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>금액</Label>
                          <div className="relative">
                            <Input
                              value={recipient.amount}
                              onChange={(e) => handleSplitAmount1Change(e.target.value)}
                              placeholder="0"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                              원
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>발급번호</Label>
                        <Input
                          value={recipient.issue_number}
                          onChange={(e) => {
                            setSplitRecipients((prev) => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], issue_number: e.target.value };
                              return updated;
                            });
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* 수령인2: 비율(자동) + 금액 + 발급번호 */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>비율</Label>
                          <div className="relative">
                            <Input
                              value={splitPercentage ? `${100 - parseInt(splitPercentage)}` : ''}
                              disabled
                              className="pr-8 bg-slate-50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                              %
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>금액</Label>
                          <div className="relative">
                            <Input
                              value={recipient.amount}
                              onChange={(e) => {
                                setSplitRecipients((prev) => {
                                  const updated = [...prev];
                                  updated[index] = {
                                    ...updated[index],
                                    amount: formatAmountInput(e.target.value),
                                  };
                                  return updated;
                                });
                              }}
                              placeholder="0"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                              원
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>발급번호</Label>
                        <Input
                          value={recipient.issue_number}
                          onChange={(e) => {
                            setSplitRecipients((prev) => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], issue_number: e.target.value };
                              return updated;
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* 합계 표시 */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">분할 합계</span>
                  <span className="font-bold">
                    {formatAmount(
                      splitRecipients.reduce((sum, r) => sum + parseAmount(r.amount), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">원본 금액</span>
                  <span>{formatAmount(splitSource.total_amount)}</span>
                </div>
                {splitRecipients.reduce((sum, r) => sum + parseAmount(r.amount), 0) !==
                  splitSource.total_amount && (
                  <div className="text-red-500 text-sm mt-1">
                    ※ 합계가 원본 금액과 일치해야 합니다
                  </div>
                )}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
