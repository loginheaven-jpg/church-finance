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

// 편집 가능한 상태
interface EditState {
  carryover: number;
  incomeCategories: Record<number, number>; // categoryCode → amount
  incomeCodes: Record<number, number>;      // code → amount
  expenseCategories: Record<number, number>; // categoryCode → amount
}

interface BankBudgetReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
        // 편집 상태 초기화
        const incCats: Record<number, number> = {};
        const incCodes: Record<number, number> = {};
        for (const cat of d.income.categories) {
          incCats[cat.categoryCode] = cat.total;
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
          incomeCategories: incCats,
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

  // 자동 계산
  const computed = useMemo(() => {
    if (!edit) return null;
    const incGeneral = [10, 20, 30, 40].reduce(
      (sum, cat) => sum + (edit.incomeCategories[cat] || 0), 0
    );
    const incConstruction = edit.incomeCategories[500] || 0;
    const incTotal = incGeneral + incConstruction;

    const expGeneral = Object.entries(edit.expenseCategories)
      .filter(([cat]) => Number(cat) < 500)
      .reduce((sum, [, amt]) => sum + amt, 0);
    const expConstruction = edit.expenseCategories[500] || 0;
    const expTotal = expGeneral + expConstruction;

    return { incGeneral, incConstruction, incTotal, expGeneral, expConstruction, expTotal };
  }, [edit]);

  const updateIncCat = useCallback((catCode: number, value: number) => {
    setEdit(prev => prev ? { ...prev, incomeCategories: { ...prev.incomeCategories, [catCode]: value } } : prev);
  }, []);

  const updateIncCode = useCallback((code: number, value: number) => {
    setEdit(prev => prev ? { ...prev, incomeCodes: { ...prev.incomeCodes, [code]: value } } : prev);
  }, []);

  const updateExpCat = useCallback((catCode: number, value: number) => {
    setEdit(prev => prev ? { ...prev, expenseCategories: { ...prev.expenseCategories, [catCode]: value } } : prev);
  }, []);

  const handleDownload = () => {
    if (!edit || !data || !computed) return;

    // 헌금 상세 (code 11~17 + 21=선교헌금)
    const offeringDetail = [11, 12, 13, 14, 21]
      .filter(c => (edit.incomeCodes[c] || 0) > 0)
      .map(c => ({ name: getCodeName(c), amount: edit.incomeCodes[c] || 0 }));

    // 목적헌금 상세 (22, 24)
    const purposeDetail = [22, 24]
      .filter(c => (edit.incomeCodes[c] || 0) > 0)
      .map(c => ({ name: getCodeName(c), amount: edit.incomeCodes[c] || 0 }));

    const excelData: BankBudgetExcelData = {
      year,
      carryover: edit.carryover,
      income: {
        categories: data.income.categories.map(cat => ({
          ...cat,
          total: edit.incomeCategories[cat.categoryCode] || 0,
        })),
        generalSubtotal: computed.incGeneral,
        constructionTotal: computed.incConstruction,
        grandTotal: computed.incTotal,
      },
      incomeDetail: {
        offering: offeringDetail,
        purposeOffering: purposeDetail,
        constructionAmount: edit.incomeCategories[500] || 0,
        miscAmount: (edit.incomeCodes[30] || 0) + (edit.incomeCodes[31] || 0),
      },
      expense: {
        categories: data.expense.categories.map(cat => ({
          ...cat,
          total: edit.expenseCategories[cat.categoryCode] || 0,
        })),
        generalSubtotal: computed.expGeneral,
        constructionTotal: computed.expConstruction,
        grandTotal: computed.expTotal,
      },
    };

    generateBankBudgetExcel(excelData);
    toast.success('엑셀 파일이 다운로드되었습니다');
  };

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          {edit && computed && (
            <Button variant="outline" onClick={handleDownload} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드
            </Button>
          )}
        </div>

        {/* 미리보기 */}
        {edit && data && computed && (
          <div className="mt-4 space-y-6">
            <h2 className="text-center text-lg font-bold">{year}년도 예산안</h2>

            <div className="flex gap-6">
              {/* 좌측: 수입부 + 지출부 요약 */}
              <div className="flex-1 min-w-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 px-2 w-32">항목</th>
                      <th className="text-right py-2 px-2">합계 (단위:원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 전기이월 */}
                    <tr className="border-b font-semibold">
                      <td className="py-2 px-2">전기이년</td>
                      <td className="py-1 px-2 text-right">
                        <AmountInput value={edit.carryover} onChange={v => setEdit(prev => prev ? { ...prev, carryover: v } : prev)} />
                      </td>
                    </tr>

                    {/* 수입부 헤더 */}
                    <tr className="bg-yellow-50 border-b">
                      <td colSpan={2} className="py-2 px-2 font-bold text-center">수입부</td>
                    </tr>

                    {/* 수입 카테고리 (건축 제외) */}
                    {data.income.categories.filter(c => c.categoryCode < 500).map(cat => (
                      <tr key={cat.categoryCode} className="border-b">
                        <td className="py-1 px-2 pl-6">{cat.categoryName}</td>
                        <td className="py-1 px-2 text-right">
                          <AmountInput value={edit.incomeCategories[cat.categoryCode] || 0} onChange={v => updateIncCat(cat.categoryCode, v)} />
                        </td>
                      </tr>
                    ))}

                    {/* 일반수입소계 */}
                    <tr className="border-b font-semibold bg-slate-50">
                      <td className="py-2 px-2">일반수입소계</td>
                      <td className="py-2 px-2 text-right">{fmt(computed.incGeneral)}</td>
                    </tr>

                    {/* 건축헌금 */}
                    <tr className="border-b">
                      <td className="py-1 px-2 pl-6">건축헌금</td>
                      <td className="py-1 px-2 text-right">
                        <AmountInput value={edit.incomeCategories[500] || 0} onChange={v => updateIncCat(500, v)} />
                      </td>
                    </tr>

                    {/* 금년수입총계 */}
                    <tr className="border-b-2 border-slate-400 font-bold bg-yellow-50">
                      <td className="py-2 px-2">금년수입총계</td>
                      <td className="py-2 px-2 text-right">{fmt(computed.incTotal)}</td>
                    </tr>

                    {/* 빈 행 */}
                    <tr><td colSpan={2} className="py-2"></td></tr>

                    {/* 지출부 헤더 */}
                    <tr className="bg-yellow-50 border-b">
                      <td colSpan={2} className="py-2 px-2 font-bold text-center">지출부</td>
                    </tr>

                    {/* 지출 카테고리 (건축 제외) */}
                    {data.expense.categories.filter(c => c.categoryCode < 500).map(cat => (
                      <tr key={cat.categoryCode} className="border-b">
                        <td className="py-1 px-2 pl-6">{cat.categoryName}</td>
                        <td className="py-1 px-2 text-right">
                          <AmountInput value={edit.expenseCategories[cat.categoryCode] || 0} onChange={v => updateExpCat(cat.categoryCode, v)} />
                        </td>
                      </tr>
                    ))}

                    {/* 일반지출 소계 */}
                    <tr className="border-b font-semibold bg-slate-50">
                      <td className="py-2 px-2">일반지출 소계</td>
                      <td className="py-2 px-2 text-right">{fmt(computed.expGeneral)}</td>
                    </tr>

                    {/* 건축비 */}
                    <tr className="border-b">
                      <td className="py-1 px-2 pl-6">건축비</td>
                      <td className="py-1 px-2 text-right">
                        <AmountInput value={edit.expenseCategories[500] || 0} onChange={v => updateExpCat(500, v)} />
                      </td>
                    </tr>

                    {/* 빈 행 */}
                    <tr><td colSpan={2} className="py-2"></td></tr>

                    {/* 금년총계 */}
                    <tr className="border-b-2 border-slate-400 font-bold bg-yellow-50">
                      <td className="py-2 px-2">금년총계</td>
                      <td className="py-2 px-2 text-right">{fmt(computed.expTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 우측: 수입부 상세내역 */}
              <div className="w-72 flex-shrink-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th colSpan={3} className="text-center py-2 px-2 font-bold">수입부 상세내역</th>
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

                    {/* 건축헌금 */}
                    <tr className="border-b">
                      <td colSpan={2} className="py-1 px-2 font-medium">건축헌금</td>
                      <td className="py-1 px-1 text-right">{fmt(edit.incomeCategories[500] || 0)}</td>
                    </tr>

                    {/* 기타 */}
                    <tr className="border-b bg-slate-50">
                      <td colSpan={3} className="py-1 px-2 font-medium">기타</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2" />
                      <td className="py-1 px-1 text-xs">잡수입/이자수입</td>
                      <td className="py-1 px-1 text-right text-xs">
                        {fmt((edit.incomeCodes[30] || 0) + (edit.incomeCodes[31] || 0))}
                      </td>
                    </tr>
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
      onChange={e => setText(e.target.value)}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className="h-7 text-right text-sm w-36 ml-auto"
      autoFocus
    />
  ) : (
    <button
      type="button"
      onClick={handleFocus}
      className="text-right text-sm w-full hover:bg-blue-50 rounded px-1 py-0.5 cursor-text transition-colors"
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
  return (
    <>
      <tr className="border-b bg-slate-50">
        <td colSpan={3} className="py-1 px-2 font-medium">{label}</td>
      </tr>
      {items.map(item => (
        <tr key={item.code} className="border-b">
          <td className="py-1 px-2" />
          <td className="py-1 px-1 text-xs">{item.name}</td>
          <td className="py-1 px-1 text-right">
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
  };
  return names[code] || `코드${code}`;
}
