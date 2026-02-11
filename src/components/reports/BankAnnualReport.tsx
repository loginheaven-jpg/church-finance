'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { YearSelector } from '@/components/common/YearSelector';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { generateBankAnnualExcel, BankAnnualExcelData } from '@/lib/bank-annual-excel';

interface MonthlyIncome {
  general: number;
  purpose: number;
  misc: number;
  capital: number;
  generalSubtotal: number;
  construction: number;
  total: number;
}

interface MonthlyExpense {
  personnel: number;
  worship: number;
  mission: number;
  education: number;
  service: number;
  admin: number;
  operation: number;
  assembly: number;
  misc: number;
  reserve: number;
  generalSubtotal: number;
  construction: number;
  total: number;
}

interface MonthData {
  income: MonthlyIncome;
  expense: MonthlyExpense;
  periodBalance: number;
  totalBalance: number;
}

interface AnnualData {
  year: number;
  carryover: { general: number; construction: number; total: number };
  months: MonthData[];
  incomeDetail: {
    offering: Array<{ name: string; amount: number }>;
    purposeOffering: Array<{ name: string; amount: number }>;
    constructionAmount: number;
    miscAmount: number;
    interestAmount: number;
  };
}

interface BankAnnualReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankAnnualReport({ open, onOpenChange }: BankAnnualReportProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnnualData | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/bank-annual?year=${year}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error || '데이터 조회 실패');
      }
    } catch {
      toast.error('데이터 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const excelData: BankAnnualExcelData = {
      year: data.year,
      carryover: data.carryover.total,
      months: data.months,
      incomeDetail: data.incomeDetail,
    };
    generateBankAnnualExcel(excelData);
    toast.success('엑셀 파일이 다운로드되었습니다');
  };

  const fmt = (n: number) => {
    if (n === 0) return '-';
    return n.toLocaleString('ko-KR');
  };

  const M = data?.months || [];

  // 수입 행 정의
  const incomeRows: Array<{ label: string; getter: (m: MonthData) => number; bold?: boolean }> = [
    { label: '금월수입총계', getter: m => m.income.total, bold: true },
    { label: '일반헌금', getter: m => m.income.general },
    { label: '목적헌금', getter: m => m.income.purpose },
    { label: '잡수입', getter: m => m.income.misc },
    { label: '자본수입', getter: m => m.income.capital },
    { label: '일반수입소계', getter: m => m.income.generalSubtotal, bold: true },
    { label: '건축헌금소계', getter: m => m.income.construction },
  ];

  // 지출 행 정의
  const expenseRows: Array<{ label: string; getter: (m: MonthData) => number; bold?: boolean }> = [
    { label: '금월지출총계', getter: m => m.expense.total, bold: true },
    { label: '사례비', getter: m => m.expense.personnel },
    { label: '예배비', getter: m => m.expense.worship },
    { label: '선교비', getter: m => m.expense.mission },
    { label: '교육비', getter: m => m.expense.education },
    { label: '봉사비', getter: m => m.expense.service },
    { label: '관리비', getter: m => m.expense.admin },
    { label: '운영비', getter: m => m.expense.operation },
    { label: '상회비', getter: m => m.expense.assembly },
    { label: '기타비용', getter: m => m.expense.misc },
    { label: '예비비', getter: m => m.expense.reserve },
    { label: '일반지출소계', getter: m => m.expense.generalSubtotal, bold: true },
    { label: '건축비지출소계', getter: m => m.expense.construction },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>은행제출용 연간보고</DialogTitle>
        </DialogHeader>

        {/* 조작부 */}
        <div className="flex items-center gap-4">
          <YearSelector year={year} onYearChange={setYear} variant="compact" />
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            생성
          </Button>
          {data && (
            <Button variant="outline" onClick={handleDownload} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드
            </Button>
          )}
        </div>

        {/* 미리보기 */}
        {data && (
          <div className="mt-4 space-y-6">
            <h2 className="text-center text-lg font-bold">{data.year}년 연간보고</h2>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-max text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300">
                    <th className="py-2 px-3 text-left w-28 sticky left-0 bg-slate-100 z-10">항목</th>
                    {Array.from({ length: 12 }, (_, i) => (
                      <th key={i} className="py-2 px-2 text-right w-24">{i + 1}월계</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 전기이월 */}
                  <tr className="border-b font-semibold bg-yellow-50">
                    <td className="py-1.5 px-3 sticky left-0 bg-yellow-50 z-10">전기이월</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmt(data.carryover.total)}</td>
                    {Array.from({ length: 11 }, (_, i) => (
                      <td key={i} className="py-1.5 px-2" />
                    ))}
                  </tr>

                  {/* 수입부 */}
                  {incomeRows.map(row => (
                    <tr key={row.label} className={`border-b ${row.bold ? 'font-semibold bg-slate-50' : ''}`}>
                      <td className={`py-1.5 px-3 sticky left-0 z-10 ${row.bold ? 'bg-slate-50' : 'bg-white'}`}>
                        {row.label}
                      </td>
                      {M.map((m, i) => (
                        <td key={i} className="py-1.5 px-2 text-right font-mono">{fmt(row.getter(m))}</td>
                      ))}
                    </tr>
                  ))}

                  {/* 빈 행 (수입/지출 구분) */}
                  <tr className="border-b"><td colSpan={13} className="py-2" /></tr>

                  {/* 지출부 */}
                  {expenseRows.map(row => (
                    <tr key={row.label} className={`border-b ${row.bold ? 'font-semibold bg-slate-50' : ''}`}>
                      <td className={`py-1.5 px-3 sticky left-0 z-10 ${row.bold ? 'bg-slate-50' : 'bg-white'}`}>
                        {row.label}
                      </td>
                      {M.map((m, i) => (
                        <td key={i} className="py-1.5 px-2 text-right font-mono">{fmt(row.getter(m))}</td>
                      ))}
                    </tr>
                  ))}

                  {/* 빈 행 */}
                  <tr className="border-b"><td colSpan={13} className="py-2" /></tr>

                  {/* 당기잔고 */}
                  <tr className="border-b font-semibold">
                    <td className="py-1.5 px-3 sticky left-0 bg-white z-10">당기잔고</td>
                    {M.map((m, i) => (
                      <td key={i} className={`py-1.5 px-2 text-right font-mono ${m.periodBalance < 0 ? 'text-red-600' : ''}`}>
                        {fmt(m.periodBalance)}
                      </td>
                    ))}
                  </tr>

                  {/* 총잔고 */}
                  <tr className="border-b-2 border-slate-400 font-bold bg-yellow-50">
                    <td className="py-1.5 px-3 sticky left-0 bg-yellow-50 z-10">총잔고</td>
                    {M.map((m, i) => (
                      <td key={i} className={`py-1.5 px-2 text-right font-mono ${m.totalBalance < 0 ? 'text-red-600' : ''}`}>
                        {fmt(m.totalBalance)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 수입부 상세내역 */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3">수입부 상세내역 <span className="font-normal text-slate-500 ml-2">단위: 원</span></h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                {/* 헌금 상세 */}
                <div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b bg-slate-50">
                        <td className="py-1 px-2 font-medium w-20">헌금</td>
                        <td className="py-1 px-2">주일헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.offering.find(o => o.name === '주일헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">십일조헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.offering.find(o => o.name === '십일조헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">감사헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.offering.find(o => o.name === '감사헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">특별(절기)헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.offering.find(o => o.name === '특별(절기)헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b bg-slate-50">
                        <td className="py-1 px-2 font-medium">건축헌금</td>
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.constructionAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 목적헌금 + 기타 상세 */}
                <div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b bg-slate-50">
                        <td className="py-1 px-2 font-medium w-20">목적헌금</td>
                        <td className="py-1 px-2">선교헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.purposeOffering.find(o => o.name === '선교헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">구제헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.purposeOffering.find(o => o.name === '구제헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">지정헌금</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.purposeOffering.find(o => o.name === '지정헌금')?.amount || 0)}</td>
                      </tr>
                      <tr className="border-b bg-slate-50">
                        <td className="py-1 px-2 font-medium">기타</td>
                        <td className="py-1 px-2">잡수입</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.miscAmount)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1 px-2" />
                        <td className="py-1 px-2">이자수입</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(data.incomeDetail.interestAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
