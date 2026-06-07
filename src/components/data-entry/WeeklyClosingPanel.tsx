'use client';

/**
 * 주간 마감 패널 — Phase 2 UI
 *
 * 위치: /data-entry → '은행원장 입력' 탭 하단 (BankUpload 아래)
 *
 * 기능:
 * - 마감 이력 표시 (활성 + 취소 분리)
 * - 미리보기 (분류 결과 + 샘플 거래)
 * - 마감 확정 (super_admin)
 * - 직전 마감 취소 (super_admin)
 * - 이력 0건 시 초기 시작점 설정 가이드
 *
 * Phase 2는 백엔드 API만 호출 — 거래 시트 변경 없음 (Phase 3에서 보정).
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, Lock, Calendar, CheckCircle2, XCircle, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { useFinanceSession } from '@/lib/auth/use-finance-session';

interface ClosingHistoryEntry {
  rowIndex: number;
  closing_week: string;
  closed_at: string;
  closed_by: string;
  note?: string;
  cancelled_at?: string;
  cancelled_by?: string;
}

interface PreviewSummary {
  count: number;
  deposit: number;
  withdrawal: number;
}

interface PreviewSampleRow {
  id: string;
  transaction_date: string;
  time: string;
  deposit: number;
  withdrawal: number;
  description: string;
  detail: string;
}

interface PreviewResponse {
  success: boolean;
  error?: string;
  prevClosedAt: string | null;
  currClosingAt: string;
  candidateRecordedSunday: string;
  summary: {
    alreadyProcessed: PreviewSummary;
    inThisCycle: PreviewSummary;
    futureCycle: PreviewSummary;
    noTime: PreviewSummary;
  };
  sample: {
    inThisCycle: PreviewSampleRow[];
    futureCycle: PreviewSampleRow[];
    noTime: PreviewSampleRow[];
  };
}

const fmt = (n: number) => n.toLocaleString();

export function WeeklyClosingPanel() {
  const session = useFinanceSession();
  const isSuperAdmin = session?.finance_role === 'super_admin';

  const [closings, setClosings] = useState<ClosingHistoryEntry[]>([]);
  const [lastActive, setLastActive] = useState<ClosingHistoryEntry | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [initWeek, setInitWeek] = useState('');
  const [initClosedAt, setInitClosedAt] = useState('');

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await fetch('/api/weekly-closing');
      const data = await r.json();
      if (data.success) {
        setClosings(data.closings || []);
        setLastActive(data.lastActive || null);
      } else {
        toast.error(data.error || '이력 조회 실패');
      }
    } catch {
      toast.error('이력 조회 중 오류');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const r = await fetch('/api/weekly-closing/preview');
      const data = await r.json();
      if (data.success) {
        setPreview(data);
      } else {
        setPreview(null);
        setPreviewError(data.error || '미리보기 실패');
      }
    } catch {
      setPreview(null);
      setPreviewError('미리보기 중 오류');
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 마감 확정
  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const r = await fetch('/api/weekly-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closing_week: preview.candidateRecordedSunday,
          closed_at: preview.currClosingAt,
          note: '',
        }),
      });
      const data = await r.json();
      if (data.success) {
        toast.success(`마감 확정: ${preview.candidateRecordedSunday}`);
        setShowConfirmDialog(false);
        await loadHistory();
        await loadPreview();
      } else {
        toast.error(data.error || '확정 실패');
      }
    } catch {
      toast.error('확정 중 오류');
    } finally {
      setConfirming(false);
    }
  };

  // 직전 마감 취소
  const handleCancel = async () => {
    setCancelling(true);
    try {
      const r = await fetch('/api/weekly-closing/last', { method: 'DELETE' });
      const data = await r.json();
      if (data.success) {
        toast.success(`마감 ${data.cancelled.closing_week} 취소됨`);
        setShowCancelDialog(false);
        await loadHistory();
        await loadPreview();
      } else {
        toast.error(data.error || '취소 실패');
      }
    } catch {
      toast.error('취소 중 오류');
    } finally {
      setCancelling(false);
    }
  };

  // 초기 시작점 설정
  const handleInit = async () => {
    if (!initWeek || !initClosedAt) {
      toast.error('두 항목 모두 입력');
      return;
    }
    try {
      const r = await fetch('/api/weekly-closing/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_week: initWeek, closed_at: initClosedAt }),
      });
      const data = await r.json();
      if (data.success) {
        toast.success('초기 시작점 설정 완료');
        setShowInitDialog(false);
        await loadHistory();
      } else {
        toast.error(data.error || '설정 실패');
      }
    } catch {
      toast.error('설정 중 오류');
    }
  };

  const activeHistory = closings.filter(c => !c.cancelled_at);
  const cancelledHistory = closings.filter(c => c.cancelled_at);

  // 권한 없음
  if (session && session.finance_role !== 'super_admin' && session.finance_role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            주간 마감
          </CardTitle>
          <CardDescription>
            은행원장 업로드 직후 [미리보기]로 분류 확인 → super_admin이 [확정].
            확정된 마감 시각 이후 거래는 다음 사이클로 보정됩니다.
            <span className="block mt-1 text-amber-700 text-xs">
              ⚠️ Phase 2: 이 패널은 마감 이력만 관리합니다. 수입부/지출부 실제 보정은 Phase 3에서 적용 예정.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* 현재 상태 요약 */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">현재 활성 마감 이력:</span>
              <span className="font-medium">{activeHistory.length}건</span>
            </div>
            {lastActive ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">가장 최근 마감:</span>
                <span className="font-mono text-slate-900">
                  {lastActive.closing_week}
                  <span className="text-xs text-slate-500 ml-2">{lastActive.closed_at}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-amber-700">
                <span>활성 마감 이력 없음</span>
                {isSuperAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setShowInitDialog(true)}>
                    초기 시작점 설정
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 미리보기 영역 */}
          <div className="flex items-center gap-2">
            <Button onClick={loadPreview} disabled={loadingPreview} variant="default">
              {loadingPreview ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              미리보기 (분류 확인)
            </Button>
            {lastActive && isSuperAdmin && (
              <Button onClick={() => setShowCancelDialog(true)} variant="outline" disabled={cancelling}>
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
                직전 마감 취소
              </Button>
            )}
          </div>

          {previewError && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {previewError}
            </div>
          )}

          {preview && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded p-3">
                  <div className="text-xs text-slate-500 mb-1">직전 마감 시점</div>
                  <div className="font-mono text-slate-900">
                    {preview.prevClosedAt || '(없음 — 초기 시작점 필요)'}
                  </div>
                </div>
                <div className="bg-blue-50 rounded p-3">
                  <div className="text-xs text-blue-600 mb-1">이번 마감 후보 시점 (자동 인식)</div>
                  <div className="font-mono text-blue-900">{preview.currClosingAt}</div>
                  <div className="text-xs text-blue-700 mt-1">
                    회계 인식 주일: <span className="font-medium">{preview.candidateRecordedSunday}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm">
                <SummaryCard label="이미 처리됨" data={preview.summary.alreadyProcessed} color="slate" />
                <SummaryCard label="이번 사이클" data={preview.summary.inThisCycle} color="blue" highlight />
                <SummaryCard label="다음 사이클" data={preview.summary.futureCycle} color="amber" />
                <SummaryCard label="시각 없음" data={preview.summary.noTime} color="red" />
              </div>

              {preview.sample.inThisCycle.length > 0 && (
                <div>
                  <div className="text-xs text-slate-600 mb-1 font-medium">이번 사이클 샘플 (상위 5건)</div>
                  <div className="border rounded text-xs overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-2 py-1">거래일자</th>
                          <th className="text-left px-2 py-1">시각</th>
                          <th className="text-right px-2 py-1">입금</th>
                          <th className="text-right px-2 py-1">출금</th>
                          <th className="text-left px-2 py-1">내역</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.inThisCycle.map(tx => (
                          <tr key={tx.id} className="border-t">
                            <td className="px-2 py-1 font-mono">{tx.transaction_date}</td>
                            <td className="px-2 py-1 font-mono">{tx.time}</td>
                            <td className="px-2 py-1 text-right text-blue-700">{tx.deposit ? fmt(tx.deposit) : '-'}</td>
                            <td className="px-2 py-1 text-right text-red-600">{tx.withdrawal ? fmt(tx.withdrawal) : '-'}</td>
                            <td className="px-2 py-1 truncate max-w-xs">{tx.description} {tx.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 확정 버튼 */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {isSuperAdmin ? (
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={confirming || preview.summary.inThisCycle.count === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    이번 사이클 마감 확정 ({preview.summary.inThisCycle.count}건)
                  </Button>
                ) : (
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    확정은 super_admin 권한 필요
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 이력 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            마감 이력
            <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loadingHistory}>
              <RefreshCw className={`h-3 w-3 ${loadingHistory ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {closings.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500 text-center">
              마감 이력 없음
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">주일</th>
                  <th className="text-left px-3 py-2">마감 시각</th>
                  <th className="text-left px-3 py-2">실행자</th>
                  <th className="text-left px-3 py-2">비고</th>
                  <th className="text-center px-3 py-2 w-24">상태</th>
                </tr>
              </thead>
              <tbody>
                {[...closings].reverse().map(c => (
                  <tr key={c.rowIndex} className={`border-b ${c.cancelled_at ? 'bg-slate-50/40 text-slate-400' : ''}`}>
                    <td className="px-3 py-2 font-mono">{c.closing_week}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.closed_at}</td>
                    <td className="px-3 py-2">{c.closed_by}</td>
                    <td className="px-3 py-2 text-xs">{c.note || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {c.cancelled_at ? (
                        <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
                          취소됨
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
                          활성
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cancelledHistory.length > 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 border-t">
              취소된 마감 {cancelledHistory.length}건 포함 (감사 추적용 보존)
            </div>
          )}
        </CardContent>
      </Card>

      {/* 확정 확인 다이얼로그 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마감 확정</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                회계 인식 주일: <span className="font-mono font-medium">{preview?.candidateRecordedSunday}</span>
              </div>
              <div>
                마감 시각: <span className="font-mono">{preview?.currClosingAt}</span>
              </div>
              <div>
                이번 사이클 거래: <span className="font-medium">{preview?.summary.inThisCycle.count}건</span>
                {' '}(입금 {fmt(preview?.summary.inThisCycle.deposit || 0)}원 / 출금 {fmt(preview?.summary.inThisCycle.withdrawal || 0)}원)
              </div>
              <div className="text-xs text-amber-700 pt-2">
                Phase 2: 이력 행만 추가됩니다. 거래 시트 보정은 Phase 3에서 적용 예정.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={confirming}>
              {confirming && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 취소 확인 다이얼로그 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>직전 마감 취소</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                대상: <span className="font-mono font-medium">{lastActive?.closing_week}</span>
              </div>
              <div>
                마감 시각: <span className="font-mono">{lastActive?.closed_at}</span>
              </div>
              <div className="text-xs text-slate-600 pt-2">
                soft cancel — 시트 행은 보존되며 cancelled_at/by가 기록됩니다.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니오</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-red-600 hover:bg-red-700">
              {cancelling && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              취소 확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 초기 시작점 설정 다이얼로그 */}
      <AlertDialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>초기 시작점 설정 (1회만)</AlertDialogTitle>
            <AlertDialogDescription>
              마감 룰 도입 직전까지 모든 데이터가 정리되었음을 의미하는 컷오프 시각을 설정합니다.
              이 시각 이전 거래는 향후 미리보기에서 &quot;이미 처리됨&quot;으로 분류됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">시작점 직전 주일 (YYYY-MM-DD)</Label>
              <Input
                value={initWeek}
                onChange={e => setInitWeek(e.target.value)}
                placeholder="2026-05-31"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">컷오프 시각 (YYYY-MM-DD HH:mm:ss)</Label>
              <Input
                value={initClosedAt}
                onChange={e => setInitClosedAt(e.target.value)}
                placeholder="2026-06-01 00:00:00"
                className="font-mono"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleInit}>설정</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, data, color, highlight = false }: {
  label: string;
  data: PreviewSummary;
  color: 'slate' | 'blue' | 'amber' | 'red';
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded border p-2 ${colorMap[color]} ${highlight ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-bold">{fmt(data.count)}건</div>
      <div className="text-xs space-y-0.5">
        {data.deposit > 0 && <div>+{fmt(data.deposit)}</div>}
        {data.withdrawal > 0 && <div>-{fmt(data.withdrawal)}</div>}
      </div>
    </div>
  );
}
