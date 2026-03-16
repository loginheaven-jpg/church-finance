'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useFinanceSession } from '@/lib/auth/use-finance-session';

interface MatchedExpense {
  id: string;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  account_code: number;
  score: number;
}

type VerificationStatus = 'matched' | 'pending' | 'missing';

interface VerificationItem {
  claim: {
    rowIndex: number;
    claimDate: string;
    claimant: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountCode: string;
    description: string;
    processedDate: string;
  };
  status: VerificationStatus;
  matchedExpenses: MatchedExpense[];
  matchScore: number;
}

interface VerificationData {
  items: VerificationItem[];
  summary: {
    total: number;
    matched: number;
    pending: number;
    missing: number;
    totalAmount: number;
    unmatchedAmount: number;
  };
}

const formatAmount = (amount: number) =>
  amount.toLocaleString('ko-KR') + '원';

const getDefaultDates = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getFullYear();
  // 기본 범위: 올해 1월 1일 ~ 오늘
  const startDate = `${year}-01-01`;
  const endDate = `${year}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
  return { startDate, endDate };
};

export default function ExpenseClaimVerification() {
  const session = useFinanceSession();
  const isAdmin = session?.finance_role === 'admin' || session?.finance_role === 'super_admin';
  const userName = session?.name || '';

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [claimant, setClaimant] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VerificationData | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'pending' | 'missing'>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // 일반 사용자는 본인명으로 고정
  useEffect(() => {
    if (!isAdmin && userName) {
      setClaimant(userName);
    }
  }, [isAdmin, userName]);

  const fetchData = async () => {
    const searchName = isAdmin ? claimant.trim() : userName;
    if (!searchName && !isAdmin) {
      toast.error('사용자 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (searchName) params.set('claimant', searchName);

      const res = await fetch(`/api/expense-claim/verification?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
      setExpandedRow(null);
      setStatusFilter('all');
    } catch (err) {
      toast.error('조회 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = data?.items.filter(
    item => statusFilter === 'all' || item.status === statusFilter
  ) || [];

  const statusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3" />처리완료
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3" />미처리 추정
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="h-3 w-3" />누락의심
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 영역 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">처리일 시작</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">처리일 끝</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">청구자명</label>
              {isAdmin ? (
                <Input
                  type="text"
                  placeholder="전체"
                  value={claimant}
                  onChange={e => setClaimant(e.target.value)}
                  className="w-32"
                />
              ) : (
                <div className="h-9 px-3 py-2 bg-slate-100 rounded-md text-sm text-slate-700 w-32 flex items-center">
                  {userName || '로딩중...'}
                </div>
              )}
            </div>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-sm text-slate-500">전체</div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.total}건</div>
              <div className="text-xs text-slate-400">{formatAmount(data.summary.totalAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-sm text-green-600">처리 완료</div>
              <div className="text-2xl font-bold text-green-600">{data.summary.matched}건</div>
              <div className="text-xs text-slate-400">지출원장 확인됨</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-sm text-red-600">미확인</div>
              <div className="text-2xl font-bold text-red-600">{data.summary.pending + data.summary.missing}건</div>
              <div className="text-xs text-slate-400">
                미처리 추정 {data.summary.pending} / 누락의심 {data.summary.missing}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 상태 필터 */}
      {data && data.items.length > 0 && (
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: '전체', count: data.summary.total },
            { key: 'matched' as const, label: '처리완료', count: data.summary.matched },
            { key: 'pending' as const, label: '미처리 추정', count: data.summary.pending },
            { key: 'missing' as const, label: '누락의심', count: data.summary.missing },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                statusFilter === f.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {/* 결과 테이블 */}
      {data && (
        <Card>
          <CardContent className="pt-6">
            {filteredItems.length === 0 ? (
              <div className="text-center text-slate-400 py-8">해당 조건의 처리내역이 없습니다</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">상태</TableHead>
                    <TableHead>청구자</TableHead>
                    <TableHead>청구일</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>은행</TableHead>
                    <TableHead>계좌번호</TableHead>
                    <TableHead>내역</TableHead>
                    <TableHead>지출확인</TableHead>
                    <TableHead className="text-center w-16">점수</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, idx) => (
                    <>
                      <TableRow
                        key={`row-${item.claim.rowIndex}`}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                      >
                        <TableCell>{statusBadge(item.status)}</TableCell>
                        <TableCell className="font-medium">{item.claim.claimant}</TableCell>
                        <TableCell className="text-sm text-slate-500">{item.claim.claimDate}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(item.claim.amount)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{item.claim.bankName}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">{item.claim.accountNumber}</TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-48 truncate">{item.claim.description}</TableCell>
                        <TableCell className="text-sm">
                          {item.status === 'matched'
                            ? item.matchedExpenses[0]?.date || '-'
                            : item.status === 'pending'
                              ? <span className="text-yellow-600">미처리 추정</span>
                              : <span className="text-red-500">누락의심</span>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          {item.matchScore > 0 && (
                            <Badge variant={item.matchScore >= 65 ? 'default' : 'secondary'}>
                              {item.matchScore}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.matchedExpenses.length > 0 && (
                            expandedRow === idx
                              ? <ChevronUp className="h-4 w-4 text-slate-400" />
                              : <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedRow === idx && item.matchedExpenses.length > 0 && (
                        <TableRow key={`detail-${item.claim.rowIndex}`}>
                          <TableCell colSpan={10} className="bg-slate-50 p-0">
                            <div className="px-6 py-3">
                              <div className="text-xs font-medium text-slate-500 mb-2">매칭 후보 (지출원장)</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-400">
                                    <th className="text-left py-1">날짜</th>
                                    <th className="text-left py-1">거래처</th>
                                    <th className="text-left py-1">내역</th>
                                    <th className="text-right py-1">금액</th>
                                    <th className="text-center py-1">점수</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.matchedExpenses.map(e => (
                                    <tr key={e.id} className="border-t border-slate-200">
                                      <td className="py-1">{e.date}</td>
                                      <td className="py-1">{e.vendor}</td>
                                      <td className="py-1 max-w-48 truncate">{e.description}</td>
                                      <td className="py-1 text-right font-mono">{formatAmount(e.amount)}</td>
                                      <td className="py-1 text-center">
                                        <span className={`px-1.5 py-0.5 rounded ${
                                          e.score >= 65 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {e.score}점
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
