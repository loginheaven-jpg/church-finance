'use client';

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { YearSelector } from '@/components/common/YearSelector';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateBankBudgetExcel, BankBudgetExcelData } from '@/lib/bank-budget-excel';

interface IncomeCode {
  code: number;
  name: string;
  amount: number;
}

interface IncomeCategory {
  categoryCode: number;
  categoryName: string;
  total: number;
  codes: IncomeCode[];
}

interface ExpenseCategory {
  categoryCode: number;
  categoryName: string;
  total: number;
}

interface BankBudgetData {
  year: number;
  carryover: { general: number; construction: number };
  income: {
    categories: IncomeCategory[];
    generalSubtotal: number;
    constructionTotal: number;
    grandTotal: number;
  };
  expense: {
    categories: ExpenseCategory[];
    generalSubtotal: number;
    constructionTotal: number;
    grandTotal: number;
  };
}

// 편집 가능한 상태: 수입은 상세코드만 편집, 지출은 카테고리 편집
interface EditState {
  carryover: number;
  incomeCodes: Record<number, number>;       // offering_code → amount (편집 대상)
  expenseCategories: Record<number, number>; // categoryCode → amount
}

interface BankBudgetReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 코드 → 카테고리 매핑
function codeToCategory(code: number): number {
  if (code >= 500) return 500;
  return Math.floor(code / 10) * 10;
}

export function BankBudgetReport({ open, onOpenChange }: BankBudgetReportProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BankBudgetData | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setData(null);
    setEdit(null);
    try {
      const res = await fetch(`/api/reports/bank-budget?year=${year}`);
      const json = await res.json();
      if (json.success) {
        const d: BankBudgetData = json.data;
        setData(d);
        // 편집 상태 초기화: 상세코드 금액
        const incCodes: Record<number, number> = {};
        for (const cat of d.income.categories) {
          for (const c of cat.codes) {
            incCodes[c.code] = c.amount;
          }
        }
        const expCats: Record<number, number> = {};
        for (const cat of d.expense.categories) {
          expCats[cat.categoryCode] = cat.total;
        }
        setEdit({
          carryover: d.carryover.general,
          incomeCodes: incCodes,
          expenseCategories: expCats,
        });
      } else {
        toast.error(json.error || '데이터 조회 실패');
      }
    } catch {
      toast.error('데이터 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 수입 카테고리 합계: 상세코드 합산으로 자동 계산
  const incomeComputed = useMemo(() => {
    if (!edit) return null;
    const catTotals: Record<number, number> = {};
    for (const [codeStr, amount] of Object.entries(edit.incomeCodes)) {
      const cat = codeToCategory(Number(codeStr));
      catTotals[cat] = (catTotals[cat] || 0) + amount;
    }
    const general = [10, 20, 30, 40].reduce((sum, c) => sum + (catTotals[c] || 0), 0);
    const construction = catTotals[500] || 0;
    return { catTotals, general, construction, total: general + construction };
  }, [edit]);

  // 지출 합계
  const expenseComputed = useMemo(() => {
    if (!edit) return null;
    const general = Object.entries(edit.expenseCategories)
      .filter(([cat]) => Number(cat) < 500)
      .reduce((sum, [, amt]) => sum + amt, 0);
    const construction = edit.expenseCategories[500] || 0;
    return { general, construction, total: general + construction };
  }, [edit]);

  const updateIncCode = useCallback((code: number, value: number) => {
    setEdit(prev => prev ? { ...prev, incomeCodes: { ...prev.incomeCodes, [code]: value } } : prev);
  }, []);

  const updateExpCat = useCallback((catCode: number, value: number) => {
    setEdit(prev => prev ? { ...prev, expenseCategories: { ...prev.expenseCategories, [catCode]: value } } : prev);
  }, []);

  const handleDownload = () => {
    if (!edit || !data || !incomeComputed || !expenseComputed) return;

    const offeringDetail = [11, 12, 13, 14]
      .map(c => ({ name: getCodeName(c), amount: edit.incomeCodes[c] || 0 }));
    const purposeDetail = [21, 22, 24]
      .map(c => ({ name: getCodeName(c), amount: edit.incomeCodes[c] || 0 }));

    const excelData: BankBudgetExcelData = {
      year,
      carryover: edit.carryover,
      income: {
        categories: [10, 20, 30, 40, 500].map(catCode => ({
          categoryCode: catCode,
          categoryName: { 10: '헌금', 20: '목적헌금', 30: '잡수입', 40: '이자수입', 500: '건축헌금' }[catCode] || '',
          total: incomeComputed.catTotals[catCode] || 0,
          codes: [],
        })),
        generalSubtotal: incomeComputed.general,
        constructionTotal: incomeComputed.construction,
        grandTotal: incomeComputed.total,
      },
      incomeDetail: {
        offering: offeringDetail,
        purposeOffering: purposeDetail,
        constructionAmount: incomeComputed.catTotals[500] || 0,
        miscAmount: (edit.incomeCodes[30] || 0) + (edit.incomeCodes[32] || 0),
        interestAmount: edit.incomeCodes[31] || 0,
      },
      expense: {
        categories: data.expense.categories.map(cat => ({
          ...cat,
          total: edit.expenseCategories[cat.categoryCode] || 0,
        })),
        generalSubtotal: expenseComputed.general,
        constructionTotal: expenseComputed.construction,
        grandTotal: expenseComputed.total,
      },
    };

    generateBankBudgetExcel(excelData);
    toast.success('엑셀 파일이 다운로드되었습니다');
  };

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>은행제출용 예산안</DialogTitle>
        </DialogHeader>

        {/* 조작부 */}
        <div className="flex items-center gap-4">
          <YearSelector year={year} onYearChange={setYear} variant="compact" />
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            생성
          </Button>
          {edit && incomeComputed && expenseComputed && (
            <Button variant="outline" onClick={handleDownload} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드
            </Button>
          )}
        </div>

        {/* 미리보기 */}
        {edit && data && incomeComputed && expenseComputed && (
          <div className="mt-4 space-y-6">
            <h2 className="text-center text-lg font-bold">{year}년도 예산안</h2>

            <div className="flex gap-8">
              {/* 좌측: 수입부 + 지출부 요약 */}
              <div className="flex-1 min-w-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 px-3 w-40">항목</th>
                      <th className="text-right py-2 px-3">합계 (단위:원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 전기이월 */}
                    <tr className="border-b font-semibold">
                      <td className="py-2 px-3">전기이년</td>
                      <td className="py-2 px-3 text-right">
                        <AmountInput value={edit.carryover} onChange={v => setEdit(prev => prev ? { ...prev, carryover: v } : prev)} />
                      </td>
                    </tr>

                    {/* 수입부 헤더 */}
                    <tr className="bg-yellow-50 border-b">
                      <td colSpan={2} className="py-2 px-3 font-bold text-center">수입부</td>
                    </tr>

                    {/* 수입 카테고리 (건축 제외) — READ ONLY */}
                    {([
                      { code: 10, name: '헌금' },
                      { code: 20, name: '목적헌금' },
                      { code: 30, name: '잡수입' },
                      { code: 40, name: '이자수입' },
                    ]).map(cat => (
                      <tr key={cat.code} className="border-b">
                        <td className="py-2 px-3 pl-8">{cat.name}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmt(incomeComputed.catTotals[cat.code] || 0)}</td>
                      </tr>
                    ))}

                    {/* 일반수입소계 */}
                    <tr className="border-b font-semibold bg-slate-50">
                      <td className="py-2 px-3">일반수입소계</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(incomeComputed.general)}</td>
                    </tr>

                    {/* 건축헌금 — READ ONLY */}
                    <tr className="border-b">
                      <td className="py-2 px-3 pl-8">건축헌금</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(incomeComputed.catTotals[500] || 0)}</td>
                    </tr>

                    {/* 금년수입총계 */}
                    <tr className="border-b-2 border-slate-400 font-bold bg-yellow-50">
                      <td className="py-2 px-3">금년수입총계</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(incomeComputed.total)}</td>
                    </tr>

                    {/* 빈 행 */}
                    <tr><td colSpan={2} className="py-3"></td></tr>

                    {/* 지출부 헤더 */}
                    <tr className="bg-yellow-50 border-b">
                      <td colSpan={2} className="py-2 px-3 font-bold text-center">지출부</td>
                    </tr>

                    {/* 지출 카테고리 (건축 제외) */}
                    {data.expense.categories.filter(c => c.categoryCode < 500).map(cat => (
                      <tr key={cat.categoryCode} className="border-b">
                        <td className="py-2 px-3 pl-8">{cat.categoryName}</td>
                        <td className="py-1 px-3 text-right">
                          <AmountInput value={edit.expenseCategories[cat.categoryCode] || 0} onChange={v => updateExpCat(cat.categoryCode, v)} />
                        </td>
                      </tr>
                    ))}

                    {/* 일반지출 소계 */}
                    <tr className="border-b font-semibold bg-slate-50">
                      <td className="py-2 px-3">일반지출 소계</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(expenseComputed.general)}</td>
                    </tr>

                    {/* 건축비 */}
                    <tr className="border-b">
                      <td className="py-2 px-3 pl-8">건축비</td>
                      <td className="py-1 px-3 text-right">
                        <AmountInput value={edit.expenseCategories[500] || 0} onChange={v => updateExpCat(500, v)} />
                      </td>
                    </tr>

                    {/* 빈 행 */}
                    <tr><td colSpan={2} className="py-3"></td></tr>

                    {/* 금년총계 */}
                    <tr className="border-b-2 border-slate-400 font-bold bg-yellow-50">
                      <td className="py-2 px-3">금년총계</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(expenseComputed.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 우측: 수입부 상세내역 (편집 대상) */}
              <div className="flex-1 min-w-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 px-3 w-28">구분</th>
                      <th className="text-left py-2 px-3">항목</th>
                      <th className="text-right py-2 px-3 w-44">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 헌금 상세 */}
                    <DetailSection
                      label="헌금"
                      items={[
                        { code: 11, name: '주일헌금' },
                        { code: 12, name: '십일조헌금' },
                        { code: 13, name: '감사헌금' },
                        { code: 14, name: '특별(절기)헌금' },
                        { code: 21, name: '선교헌금' },
                      ]}
                      values={edit.incomeCodes}
                      onChange={updateIncCode}
                    />

                    {/* 목적헌금 상세 */}
                    <DetailSection
                      label="목적헌금"
                      items={[
                        { code: 22, name: '구제헌금' },
                        { code: 24, name: '지정헌금' },
                      ]}
                      values={edit.incomeCodes}
                      onChange={updateIncCode}
                    />

                    {/* 잡수입 상세 */}
                    <DetailSection
                      label="잡수입"
                      items={[
                        { code: 30, name: '잡수입' },
                        { code: 31, name: '이자수입' },
                        { code: 32, name: '기타잡수입' },
                      ]}
                      values={edit.incomeCodes}
                      onChange={updateIncCode}
                    />

                    {/* 자본수입 상세 */}
                    <DetailSection
                      label="자본수입"
                      items={[
                        { code: 40, name: '자본수입' },
                        { code: 41, name: '일시차입금' },
                        { code: 42, name: '차입금' },
                        { code: 43, name: '적립금인출' },
                        { code: 44, name: '자산처분수입' },
                      ]}
                      values={edit.incomeCodes}
                      onChange={updateIncCode}
                    />

                    {/* 건축헌금 */}
                    <DetailSection
                      label="건축헌금"
                      items={[
                        { code: 500, name: '건축헌금' },
                      ]}
                      values={edit.incomeCodes}
                      onChange={updateIncCode}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 금액 입력 컴포넌트
function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  const handleFocus = () => {
    setFocused(true);
    setText(String(value || ''));
  };

  const handleBlur = () => {
    setFocused(false);
    const num = parseInt(text.replace(/[^0-9-]/g, ''), 10);
    onChange(isNaN(num) ? 0 : num);
  };

  return focused ? (
    <Input
      type="text"
      value={text}
      onChange={e => {
            const v = e.target.value;
            setText(v);
            const num = parseInt(v.replace(/[^0-9-]/g, ''), 10);
            if (!isNaN(num)) onChange(num);
          }}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className="h-7 text-right text-sm w-40 ml-auto"
      autoFocus
    />
  ) : (
    <button
      type="button"
      onClick={handleFocus}
      className="text-right text-sm w-full hover:bg-blue-50 rounded px-1 py-0.5 cursor-text transition-colors font-mono"
    >
      {value ? value.toLocaleString('ko-KR') : '0'}
    </button>
  );
}

// 상세 섹션 컴포넌트
function DetailSection({
  label,
  items,
  values,
  onChange,
}: {
  label: string;
  items: Array<{ code: number; name: string }>;
  values: Record<number, number>;
  onChange: (code: number, value: number) => void;
}) {
  const sectionTotal = items.reduce((sum, item) => sum + (values[item.code] || 0), 0);

  return (
    <>
      <tr className="border-b bg-slate-50">
        <td className="py-1.5 px-3 font-medium">{label}</td>
        <td className="py-1.5 px-3"></td>
        <td className="py-1.5 px-3 text-right font-mono font-medium text-slate-500">
          {sectionTotal.toLocaleString('ko-KR')}
        </td>
      </tr>
      {items.map(item => (
        <tr key={item.code} className="border-b">
          <td className="py-1 px-3" />
          <td className="py-1 px-3">{item.name}</td>
          <td className="py-1 px-3 text-right">
            <AmountInput value={values[item.code] || 0} onChange={v => onChange(item.code, v)} />
          </td>
        </tr>
      ))}
    </>
  );
}

// 코드명 매핑
function getCodeName(code: number): string {
  const names: Record<number, string> = {
    11: '주일헌금',
    12: '십일조헌금',
    13: '감사헌금',
    14: '특별(절기)헌금',
    21: '선교헌금',
    22: '구제헌금',
    24: '지정헌금',
    30: '잡수입',
    31: '이자수입',
    32: '기타잡수입',
    40: '자본수입',
    500: '건축헌금',
  };
  return names[code] || `코드${code}`;
}
