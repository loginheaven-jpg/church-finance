'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Check, Save, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface Entry {
  id: string;
  rowIndex: number;
  date: string;
  donor_name: string;
  amount: number;
  code: number;
  item: string;
  category_code: number;
  note: string;
  status: 'pending' | 'synced';
  synced_to_inc_id?: string;
}

interface CodeMap {
  code: number;
  item: string;
  category_code: number;
}

// 한글-영문 키 매핑 (k 와 ㅏ 동일 처리)
const isThousandKey = (key: string) => key === 'k' || key === 'K' || key === 'ㅏ';

// "2026-06-07" → 이번 주 일요일 (KST)
const lastSunday = () => {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const day = now.getUTCDay();
  const diff = day === 0 ? 0 : -day;
  now.setUTCDate(now.getUTCDate() + diff);
  return now.toISOString().slice(0, 10);
};

const formatAmount = (n: number) => n.toLocaleString();

// 새 빈 행
const newBlankRow = (): NewRow => ({
  donor_name: '',
  amount: '',
  code: '11',
  note: '',
});

interface NewRow {
  donor_name: string;
  amount: string;  // 표시용 문자열
  code: string;
  note: string;
}

// localStorage draft (날짜별 미저장 행 보존)
const draftKey = (date: string) => `cash-offering-draft:${date}`;
const saveDraft = (date: string, rows: NewRow[]) => {
  try {
    // 의미있는 행(헌금자 또는 금액 입력됨)만 저장
    const meaningful = rows.filter(r => r.donor_name.trim() || r.amount);
    if (meaningful.length === 0) localStorage.removeItem(draftKey(date));
    else localStorage.setItem(draftKey(date), JSON.stringify(meaningful));
  } catch {
    // 용량 초과/접근불가는 무시
  }
};
const loadDraft = (date: string): NewRow[] | null => {
  try {
    const raw = localStorage.getItem(draftKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as NewRow[]) : null;
  } catch {
    return null;
  }
};
const clearDraft = (date: string) => {
  try { localStorage.removeItem(draftKey(date)); } catch { /* noop */ }
};

export default function CashOfferingEntryPage() {
  const [date, setDate] = useState(lastSunday());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [codes, setCodes] = useState<CodeMap[]>([]);
  const [loading, setLoading] = useState(false);

  // 신규 입력용 행 (저장 전 임시 상태)
  const [newRows, setNewRows] = useState<NewRow[]>([newBlankRow()]);
  // 자동완성 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  // 일괄 저장 상태
  const [batchSaving, setBatchSaving] = useState(false);

  // 입력 ref (포커스 이동)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // draft 복원 직후 auto-save 1회 건너뛰기 (race 방지)
  const skipSaveRef = useRef(true);

  // 코드 매핑
  const codeMap = useMemo(() => {
    const m = new Map<number, CodeMap>();
    codes.forEach(c => m.set(c.code, c));
    return m;
  }, [codes]);

  // 입력 데이터 fetch
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cash-offering/entries?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
      }
    } catch {
      toast.error('조회 실패');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // 코드 fetch
  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/cash-offering/codes');
      const data = await res.json();
      if (data.success) setCodes(data.codes);
    } catch {
      // 무시
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  // 날짜 변경 시 localStorage draft 복원 (없으면 빈 행 1개)
  useEffect(() => {
    const draft = loadDraft(date);
    if (draft && draft.length > 0) {
      setNewRows([...draft, newBlankRow()]);
    } else {
      setNewRows([newBlankRow()]);
    }
    skipSaveRef.current = true; // 복원 직후 auto-save 1회 건너뛰기
  }, [date]);

  // newRows 변경 시 localStorage 자동 저장
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveDraft(date, newRows);
  }, [newRows, date]);

  // 미저장 draft 있을 때 페이지 이탈 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDraft = newRows.some(r => r.donor_name.trim() && r.amount);
      if (hasDraft) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [newRows]);

  // 자동완성 검색 (debounced)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cash-offering/donors-search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.donors || []);
        setHighlightIdx(0);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 새 행 입력 필드 업데이트
  const updateNewRow = (idx: number, field: keyof NewRow, value: string) => {
    setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // 헌금자 자동완성 선택
  const selectDonor = (idx: number, name: string) => {
    updateNewRow(idx, 'donor_name', name);
    setActiveSearchIdx(null);
    setSearchQuery('');
    setSearchResults([]);
    // 다음 셀로 포커스
    setTimeout(() => {
      inputRefs.current.get(`new-code-${idx}`)?.focus();
    }, 0);
  };

  // 금액 키 입력: Shift+숫자 = *10000 (한글 ㅏ는 keydown에서 안 잡혀 onChange로 처리)
  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const el = e.target as HTMLInputElement;
    const currentVal = el.value.replace(/[,\s]/g, '');

    // Shift+숫자 → 누적된 숫자 전체 *10000 (한 자리만 누른 경우 그 숫자만)
    if (e.shiftKey && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const combined = currentVal ? parseInt(currentVal) * 10 + parseInt(e.key) : parseInt(e.key);
      const newAmt = combined * 10000;
      updateNewRow(idx, 'amount', formatAmount(newAmt));
      return;
    }

    // 영문 'k'/'K' 단축키 (한글 IME OFF 시) — Process일 때는 onChange로 처리
    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      if (!currentVal) return;
      const num = parseInt(currentVal);
      if (isNaN(num)) return;
      updateNewRow(idx, 'amount', formatAmount(num * 1000));
      return;
    }

    // Enter: IME 조합 중이 아닐 때만 다음 셀 이동
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      inputRefs.current.get(`new-note-${idx}`)?.focus();
    }
  };

  // 금액 입력값 변경 (콤마 자동 + 한글 ㅏ 단축키 감지)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value;
    // 마지막 글자가 'ㅏ' 또는 'k'/'K'면 *1000 (한글 IME 모드에서 keydown 못 잡는 경우 대응)
    const lastChar = val.slice(-1);
    if (lastChar === 'ㅏ' || lastChar === 'k' || lastChar === 'K') {
      const prefix = val.slice(0, -1).replace(/[^\d]/g, '');
      const num = parseInt(prefix);
      if (!isNaN(num) && num > 0) {
        updateNewRow(idx, 'amount', formatAmount(num * 1000));
        return;
      }
    }
    const raw = val.replace(/[^\d]/g, '');
    if (!raw) {
      updateNewRow(idx, 'amount', '');
      return;
    }
    updateNewRow(idx, 'amount', formatAmount(parseInt(raw)));
  };

  // 코드 입력 → 항목 자동 표시
  const handleCodeChange = (idx: number, val: string) => {
    const num = val.replace(/[^\d]/g, '');
    updateNewRow(idx, 'code', num);
    // 코드 2자리 이상이면 항목 자동 (UI는 codeMap으로 표시)
  };

  // 비고에서 Enter → 새 행 추가 + 다음 행 헌금자로 포커스 (서버 저장 X, localStorage만)
  const addNewRow = (idx: number) => {
    setNewRows(prev => {
      // 현재 행이 마지막이면 새 빈 행 추가, 아니면 그대로 (다음 행으로 이동만)
      const isLast = idx === prev.length - 1;
      return isLast ? [...prev, newBlankRow()] : prev;
    });
    setTimeout(() => {
      inputRefs.current.get(`new-donor-${idx + 1}`)?.focus();
    }, 30);
  };

  // 신규 입력 행 1줄 삭제
  const deleteNewRow = (idx: number) => {
    setNewRows(prev => {
      if (prev.length === 1) return [newBlankRow()];
      return prev.filter((_, i) => i !== idx);
    });
  };

  // 비고에서 Enter → 새 행 추가 + 포커스 이동 (IME 조합 중 무시)
  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addNewRow(idx);
    }
  };

  // 유효 행 필터 (서버 전송 대상): {원본idx, row}
  const validRowsWithIdx = useMemo(() =>
    newRows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (!r.donor_name.trim()) return false;
        const amt = parseInt(r.amount.replace(/[,\s]/g, ''));
        if (!amt || amt <= 0) return false;
        if (!r.code || !parseInt(r.code)) return false;
        return true;
      }),
  [newRows]);

  // 미저장(draft) 합계
  const draftTotal = useMemo(() =>
    validRowsWithIdx.reduce((s, { r }) => s + (parseInt(r.amount.replace(/[,\s]/g, '')) || 0), 0),
  [validRowsWithIdx]);

  // 일괄 서버 저장 (batch POST)
  const saveAllToServer = async () => {
    if (validRowsWithIdx.length === 0) {
      toast.error('저장할 유효 행이 없습니다');
      return;
    }
    setBatchSaving(true);
    try {
      const res = await fetch('/api/cash-offering/entries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          rows: validRowsWithIdx.map(({ r }) => ({
            donor_name: r.donor_name.trim(),
            amount: parseInt(r.amount.replace(/[,\s]/g, '')),
            code: parseInt(r.code),
            note: r.note,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || '저장 실패');
        return;
      }

      const failedSet = new Set<number>((data.failed || []).map((f: { index: number }) => f.index));

      if (failedSet.size === 0) {
        // 전부 성공 → newRows 비우기, draft 비우기
        toast.success(`${data.savedCount}건 저장 완료`);
        setNewRows([newBlankRow()]);
        clearDraft(date);
        await fetchEntries();
        setTimeout(() => {
          inputRefs.current.get('new-donor-0')?.focus();
        }, 50);
      } else {
        // 부분 실패 → 성공한 행만 newRows에서 제거
        const failedOriginalIdx = new Set<number>();
        validRowsWithIdx.forEach(({ i }, k) => {
          if (failedSet.has(k)) failedOriginalIdx.add(i);
        });
        setNewRows(prev => {
          const kept = prev.filter((_, i) => {
            // 전송된 행 중 실패한 것만 유지, 전송 안 된 미완성 행도 유지
            const wasSent = validRowsWithIdx.some(v => v.i === i);
            if (!wasSent) return true;
            return failedOriginalIdx.has(i);
          });
          return kept.length > 0 ? [...kept, newBlankRow()] : [newBlankRow()];
        });
        toast.error(`${data.savedCount}건 저장, ${failedSet.size}건 실패`);
        await fetchEntries();
      }
    } catch {
      toast.error('저장 중 오류');
    } finally {
      setBatchSaving(false);
    }
  };

  // 저장된 entry 삭제
  const deleteEntry = async (rowIndex: number) => {
    if (!confirm('이 헌금 입력을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/cash-offering/entries?rowIndex=${rowIndex}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.syncedIncDeleted ? '헌금함 + 수입부 동시 삭제' : '삭제 완료');
        await fetchEntries();
      } else {
        toast.error(data.error || '삭제 실패');
      }
    } catch {
      toast.error('삭제 중 오류');
    }
  };

  // 저장된 entry 인라인 수정
  const updateEntry = async (rowIndex: number, updates: Partial<Entry>) => {
    try {
      const res = await fetch('/api/cash-offering/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.syncedIncUpdated) toast.success('헌금함 + 수입부 동시 수정');
        await fetchEntries();
      } else {
        toast.error(data.error || '수정 실패');
      }
    } catch {
      toast.error('수정 중 오류');
    }
  };

  // 합계 계산
  const totalAmount = useMemo(() =>
    entries.reduce((s, e) => s + e.amount, 0),
  [entries]);

  const pendingCount = entries.filter(e => e.status === 'pending').length;
  const syncedCount = entries.filter(e => e.status === 'synced').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">헌금함 입력</h1>
      </div>

      {/* 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">주일:</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-44"
              />
              <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm text-slate-600">
                <span>저장됨 <span className="font-bold text-slate-900">{formatAmount(totalAmount)}원</span> ({entries.length}건)</span>
                {validRowsWithIdx.length > 0 && (
                  <>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-amber-700">
                      미저장 <span className="font-bold">{formatAmount(draftTotal)}원</span> ({validRowsWithIdx.length}건)
                    </span>
                  </>
                )}
                <span className="mx-2 text-slate-300">|</span>
                <span>총합 <span className="font-bold text-blue-700">{formatAmount(totalAmount + draftTotal)}원</span></span>
                <span className="ml-2 text-xs text-slate-500">
                  pending {pendingCount} / synced {syncedCount}
                </span>
              </div>
              <Button
                onClick={saveAllToServer}
                disabled={validRowsWithIdx.length === 0 || batchSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {batchSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                서버 저장 ({validRowsWithIdx.length}건)
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 입력 안내 */}
      <Card className="bg-blue-50/40 border-blue-100">
        <CardContent className="py-3 text-xs text-slate-600 space-y-0.5">
          <div className="flex items-center gap-2 font-medium text-blue-700">
            <Wand2 className="h-3.5 w-3.5" />
            빠른 입력 단축키
          </div>
          <div>· 헌금자: 2글자 이상 입력 시 자동완성 (↑↓ 화살표 선택, Enter 확정)</div>
          <div>· 금액: <kbd className="px-1 bg-white border rounded">k</kbd> 또는 <kbd className="px-1 bg-white border rounded">ㅏ</kbd> = ×1,000 (예: 50ㅏ → 50,000) / <kbd className="px-1 bg-white border rounded">Shift+숫자</kbd> = ×10,000</div>
          <div>· 코드: 숫자 입력 즉시 항목 자동 표시 (11=주일헌금, 12=감사헌금, 13=십일조 등)</div>
          <div>· Tab: 다음 셀 / Enter (비고): 새 행 추가 (로컬 임시저장만, 서버 반영 X)</div>
          <div className="text-amber-700">· 입력은 자동으로 브라우저에 임시 저장됩니다. 마무리 후 우상단 <span className="font-medium">[서버 저장]</span> 버튼을 누르세요.</div>
        </CardContent>
      </Card>

      {/* 저장된 entries 테이블 */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">입력 내역 ({entries.length}건)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">헌금자</th>
                  <th className="text-left px-3 py-2 w-16">코드</th>
                  <th className="text-left px-3 py-2 w-24">항목</th>
                  <th className="text-right px-3 py-2 w-32">금액</th>
                  <th className="text-left px-3 py-2">비고</th>
                  <th className="text-center px-3 py-2 w-16">상태</th>
                  <th className="text-center px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <SavedRow
                    key={e.id}
                    entry={e}
                    idx={i + 1}
                    codeMap={codeMap}
                    onUpdate={updateEntry}
                    onDelete={() => deleteEntry(e.rowIndex)}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 신규 입력 행 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">신규 입력</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2">헌금자</th>
                <th className="text-left px-3 py-2 w-16">코드</th>
                <th className="text-left px-3 py-2 w-24">항목</th>
                <th className="text-right px-3 py-2 w-32">금액</th>
                <th className="text-left px-3 py-2">비고</th>
                <th className="text-center px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {newRows.map((row, idx) => {
                const codeNum = parseInt(row.code);
                const itemName = codeNum ? codeMap.get(codeNum)?.item || '?' : '';
                return (
                  <tr key={idx} className="border-b hover:bg-slate-50/40">
                    <td className="px-3 py-1.5 relative">
                      <Input
                        ref={el => { if (el) inputRefs.current.set(`new-donor-${idx}`, el); }}
                        value={row.donor_name}
                        placeholder="이름 2글자 이상"
                        className="h-8 text-sm"
                        onChange={e => {
                          updateNewRow(idx, 'donor_name', e.target.value);
                          setSearchQuery(e.target.value);
                          setActiveSearchIdx(idx);
                        }}
                        onFocus={() => setActiveSearchIdx(idx)}
                        onKeyDown={e => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightIdx(i => Math.min(i + 1, searchResults.length - 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightIdx(i => Math.max(i - 1, 0));
                          } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            if (searchResults.length > 0 && activeSearchIdx === idx) {
                              selectDonor(idx, searchResults[highlightIdx]);
                            } else {
                              inputRefs.current.get(`new-code-${idx}`)?.focus();
                            }
                          } else if (e.key === 'Tab') {
                            if (searchResults.length > 0 && activeSearchIdx === idx) {
                              e.preventDefault();
                              selectDonor(idx, searchResults[highlightIdx]);
                            }
                          }
                        }}
                      />
                      {/* 자동완성 드롭다운 */}
                      {activeSearchIdx === idx && searchResults.length > 0 && (
                        <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded shadow-lg z-20 max-h-60 overflow-y-auto">
                          {searchResults.map((name, ri) => (
                            <button
                              key={name}
                              type="button"
                              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${ri === highlightIdx ? 'bg-blue-50 text-blue-700' : ''}`}
                              onMouseDown={e => { e.preventDefault(); selectDonor(idx, name); }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        ref={el => { if (el) inputRefs.current.set(`new-code-${idx}`, el); }}
                        value={row.code}
                        placeholder="11"
                        className="h-8 text-sm w-14"
                        onChange={e => handleCodeChange(idx, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            inputRefs.current.get(`new-amount-${idx}`)?.focus();
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 text-xs">
                      {itemName}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        ref={el => { if (el) inputRefs.current.set(`new-amount-${idx}`, el); }}
                        value={row.amount}
                        placeholder="50ㅏ → 50,000"
                        className="h-8 text-sm text-right"
                        onChange={e => handleAmountChange(e, idx)}
                        onKeyDown={e => handleAmountKeyDown(e, idx)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        ref={el => { if (el) inputRefs.current.set(`new-note-${idx}`, el); }}
                        value={row.note}
                        className="h-8 text-sm"
                        onChange={e => updateNewRow(idx, 'note', e.target.value)}
                        onKeyDown={e => handleNoteKeyDown(e, idx)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={() => deleteNewRow(idx)}
                        disabled={newRows.length === 1 && !row.donor_name && !row.amount && !row.note}
                        title="이 행 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// 저장된 row (인라인 수정)
function SavedRow({
  entry, idx, codeMap, onUpdate, onDelete,
}: {
  entry: Entry;
  idx: number;
  codeMap: Map<number, CodeMap>;
  onUpdate: (rowIndex: number, updates: Partial<Entry>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    donor_name: entry.donor_name,
    code: String(entry.code),
    amount: formatAmount(entry.amount),
    note: entry.note,
  });

  const codeNum = parseInt(editForm.code);
  const itemName = codeNum ? codeMap.get(codeNum)?.item || '?' : entry.item;

  const handleSave = () => {
    onUpdate(entry.rowIndex, {
      donor_name: editForm.donor_name,
      code: parseInt(editForm.code),
      amount: parseInt(editForm.amount.replace(/[,\s]/g, '')),
      note: editForm.note,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b bg-amber-50/40">
        <td className="text-center px-3 py-1.5">{idx}</td>
        <td className="px-3 py-1.5">
          <Input
            value={editForm.donor_name}
            onChange={e => setEditForm(p => ({ ...p, donor_name: e.target.value }))}
            className="h-8 text-sm"
          />
        </td>
        <td className="px-3 py-1.5">
          <Input
            value={editForm.code}
            onChange={e => setEditForm(p => ({ ...p, code: e.target.value.replace(/[^\d]/g, '') }))}
            className="h-8 text-sm w-14"
          />
        </td>
        <td className="px-3 py-1.5 text-xs text-slate-600">{itemName}</td>
        <td className="px-3 py-1.5">
          <Input
            value={editForm.amount}
            onChange={e => {
              const raw = e.target.value.replace(/[^\d]/g, '');
              setEditForm(p => ({ ...p, amount: raw ? formatAmount(parseInt(raw)) : '' }));
            }}
            className="h-8 text-sm text-right"
          />
        </td>
        <td className="px-3 py-1.5">
          <Input
            value={editForm.note}
            onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
            className="h-8 text-sm"
          />
        </td>
        <td className="text-center px-3 py-1.5">
          <span className={`text-xs px-2 py-0.5 rounded ${entry.status === 'synced' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
            {entry.status === 'synced' ? '반영' : '대기'}
          </span>
        </td>
        <td className="text-center px-3 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave} title="저장">
            <Check className="h-4 w-4 text-green-600" />
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-slate-50/40" onDoubleClick={() => setEditing(true)}>
      <td className="text-center px-3 py-1.5 text-slate-500">{idx}</td>
      <td className="px-3 py-1.5">{entry.donor_name}</td>
      <td className="px-3 py-1.5 font-mono">{entry.code}</td>
      <td className="px-3 py-1.5 text-slate-600 text-xs">{entry.item}</td>
      <td className="px-3 py-1.5 text-right font-medium">{formatAmount(entry.amount)}</td>
      <td className="px-3 py-1.5 text-xs text-slate-500">{entry.note}</td>
      <td className="text-center px-3 py-1.5">
        <span className={`text-xs px-2 py-0.5 rounded ${entry.status === 'synced' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
          {entry.status === 'synced' ? '반영' : '대기'}
        </span>
      </td>
      <td className="text-center px-3 py-1.5">
        <div className="flex items-center justify-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)} title="수정">
            ✏️
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={onDelete} title="삭제">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
