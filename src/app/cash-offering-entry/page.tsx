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
  // 저장 상태
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set());

  // 입력 ref (포커스 이동)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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

  // 금액 키 입력: 'k'/'ㅏ' = *1000, Shift+숫자 = *10000
  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const el = e.target as HTMLInputElement;
    const currentVal = el.value.replace(/[,\s]/g, '');

    // Shift+숫자 → *10000
    if (e.shiftKey && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const num = parseInt(e.key) * 10000;
      const combined = currentVal ? parseInt(currentVal) * 10 + parseInt(e.key) : parseInt(e.key);
      // 단순 정책: 현재 입력값에 자릿수 추가 후 *10000 (Shift+숫자는 무조건 만원 단위 추가)
      const newAmt = combined * 10000;
      updateNewRow(idx, 'amount', formatAmount(newAmt));
      return;
    }

    // 'k' 또는 'ㅏ' → *1000
    if (isThousandKey(e.key)) {
      e.preventDefault();
      if (!currentVal) return;
      const num = parseInt(currentVal);
      if (isNaN(num)) return;
      const newAmt = num * 1000;
      updateNewRow(idx, 'amount', formatAmount(newAmt));
      return;
    }

    // Enter: 다음 셀(비고) 또는 행 저장
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRefs.current.get(`new-note-${idx}`)?.focus();
    }

    // Tab은 기본 동작 (다음 input으로 이동)
  };

  // 금액 입력값 변경 (콤마 자동)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
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

  // 행 저장
  const saveRow = async (idx: number) => {
    const row = newRows[idx];
    if (!row.donor_name.trim() || !row.amount || !row.code) return;
    const amountNum = parseInt(row.amount.replace(/[,\s]/g, ''));
    if (!amountNum || amountNum <= 0) return;
    const codeNum = parseInt(row.code);
    if (!codeNum) return;

    setSavingRows(prev => new Set(prev).add(idx));
    try {
      const res = await fetch('/api/cash-offering/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          donor_name: row.donor_name.trim(),
          amount: amountNum,
          code: codeNum,
          note: row.note,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // 새 빈 행 추가 + 현재 행 제거
        setNewRows(prev => {
          const next = prev.filter((_, i) => i !== idx);
          return [...next, newBlankRow()];
        });
        await fetchEntries();
        // 다음 행으로 포커스
        setTimeout(() => {
          const lastIdx = newRows.length - 1;
          inputRefs.current.get(`new-donor-${lastIdx}`)?.focus();
        }, 50);
      } else {
        toast.error(data.error || '저장 실패');
      }
    } catch {
      toast.error('저장 중 오류');
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  // 비고에서 Enter → 저장 + 새 행 추가
  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      saveRow(idx);
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
            <div className="text-sm text-slate-600">
              {entries.length}건 · 합계 <span className="font-bold text-slate-900">{formatAmount(totalAmount)}원</span>
              <span className="ml-2 text-xs">
                pending {pendingCount} / synced {syncedCount}
              </span>
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
          <div>· Tab: 다음 셀 / Enter (비고): 행 저장 + 새 행 추가</div>
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
                const isLast = idx === newRows.length - 1;
                const saving = savingRows.has(idx);
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
                          } else if (e.key === 'Enter') {
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
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500 inline" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => saveRow(idx)}
                          disabled={!row.donor_name || !row.amount || !row.code}
                          title="저장"
                        >
                          <Save className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
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
