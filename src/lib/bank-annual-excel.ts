import * as XLSX from 'xlsx';

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

export interface BankAnnualExcelData {
  year: number;
  carryover: number;
  months: MonthData[];
  incomeDetail: {
    offering: Array<{ name: string; amount: number }>;
    purposeOffering: Array<{ name: string; amount: number }>;
    constructionAmount: number;
    miscAmount: number;
    interestAmount: number;
  };
}

// 0원이면 " - " 표시, 아니면 숫자 반환
function val(n: number): string | number {
  return n === 0 ? ' - ' : n;
}

// 월별 값 배열 생성 (12개월)
function monthValues(months: MonthData[], getter: (m: MonthData) => number): (string | number)[] {
  return months.map(m => val(getter(m)));
}

export function createBankAnnualSheet(data: BankAnnualExcelData): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [];
  const M = data.months;

  // Helper
  const emptyRow = () => new Array(14).fill(null);
  const mv = (getter: (m: MonthData) => number) => monthValues(M, getter);

  // Row 1: 제목
  rows.push(['연간보고', ...new Array(13).fill(null)]);
  // Row 2: 빈
  rows.push(emptyRow());
  // Row 3: 헤더
  rows.push(['항목', '1월계', '2월계', '3월계', '4월계', '5월계', '6월계',
    '7월계', '8월계', '9월계', '10월계', '11월계', '12월계', null]);

  // Row 4: 전기이월 (1월만)
  const carryoverRow = new Array(14).fill(null);
  carryoverRow[0] = '전기이월';
  carryoverRow[1] = val(data.carryover);
  rows.push(carryoverRow);

  // Row 5: 금월수입총계
  rows.push(['금월수입총계', ...mv(m => m.income.total), null]);
  // Row 6: 일반헌금
  rows.push(['일반헌금', ...mv(m => m.income.general), null]);
  // Row 7: 목적헌금
  rows.push(['목적헌금', ...mv(m => m.income.purpose), null]);
  // Row 8: 잡수입
  rows.push(['잡수입', ...mv(m => m.income.misc), null]);
  // Row 9: 자본수입
  rows.push(['자본수입', ...mv(m => m.income.capital), null]);
  // Row 10: 일반수입소계
  rows.push(['일반수입소계', ...mv(m => m.income.generalSubtotal), null]);
  // Row 11: 건축헌금소계
  rows.push(['건축헌금소계', ...mv(m => m.income.construction), null]);

  // Row 12: 빈
  rows.push(emptyRow());

  // Row 13: 금월지출총계
  rows.push(['금월지출총계', ...mv(m => m.expense.total), null]);
  // Row 14: 사례비
  rows.push(['사례비', ...mv(m => m.expense.personnel), null]);
  // Row 15: 예배비
  rows.push(['예배비', ...mv(m => m.expense.worship), null]);
  // Row 16: 선교비
  rows.push(['선교비', ...mv(m => m.expense.mission), null]);
  // Row 17: 교육비
  rows.push(['교육비', ...mv(m => m.expense.education), null]);
  // Row 18: 봉사비
  rows.push(['봉사비', ...mv(m => m.expense.service), null]);
  // Row 19: 관리비
  rows.push(['관리비', ...mv(m => m.expense.admin), null]);
  // Row 20: 운영비
  rows.push(['운영비', ...mv(m => m.expense.operation), null]);
  // Row 21: 상회비
  rows.push(['상회비', ...mv(m => m.expense.assembly), null]);
  // Row 22: 기타비용
  rows.push(['기타비용', ...mv(m => m.expense.misc), null]);
  // Row 23: 예비비
  rows.push(['예비비', ...mv(m => m.expense.reserve), null]);
  // Row 24: 일반지출소계
  rows.push(['일반지출소계', ...mv(m => m.expense.generalSubtotal), null]);
  // Row 25: 건축비지출소계
  rows.push(['건축비지출소계', ...mv(m => m.expense.construction), null]);

  // Row 26: 빈
  rows.push(emptyRow());

  // Row 27: 당기잔고
  rows.push(['당기잔고', ...mv(m => m.periodBalance), null]);
  // Row 28: 총잔고
  rows.push(['총잔고', ...mv(m => m.totalBalance), null]);

  // Row 29: 빈
  rows.push(emptyRow());

  // Row 30: 수입부 상세내역 헤더
  const detailHeader = emptyRow();
  detailHeader[1] = '수입부 상세내역';
  detailHeader[3] = '단위 :원';
  rows.push(detailHeader);

  // Row 31~35: 상세내역
  const d = data.incomeDetail;
  // Row 31: 헌금 / 주일헌금 | 금액 | | 목적헌금 / 선교헌금 | 금액
  rows.push([null, '헌금', '주일헌금',
    d.offering.find(o => o.name === '주일헌금')?.amount || 0,
    null, '목적헌금', '선교헌금',
    d.purposeOffering.find(o => o.name === '선교헌금')?.amount || 0,
    ...new Array(6).fill(null)]);
  // Row 32
  rows.push([null, null, '십일조헌금',
    d.offering.find(o => o.name === '십일조헌금')?.amount || 0,
    null, null, '구제헌금',
    d.purposeOffering.find(o => o.name === '구제헌금')?.amount || 0,
    ...new Array(6).fill(null)]);
  // Row 33
  rows.push([null, null, '감사헌금',
    d.offering.find(o => o.name === '감사헌금')?.amount || 0,
    null, null, '지정헌금',
    d.purposeOffering.find(o => o.name === '지정헌금')?.amount || 0,
    ...new Array(6).fill(null)]);
  // Row 34
  rows.push([null, null, '특별(절기)헌금',
    d.offering.find(o => o.name === '특별(절기)헌금')?.amount || 0,
    null, '건축헌금', null, d.constructionAmount,
    ...new Array(6).fill(null)]);
  // Row 35
  rows.push([null, null, null, null,
    null, '기타', '잡수입', d.miscAmount,
    null, null, '이자수입', d.interestAmount,
    null, null]);

  // 시트 생성
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 16 },  // A: 항목
    ...Array.from({ length: 12 }, () => ({ wch: 14 })),  // B~M: 월별
    { wch: 2 },   // N: 여분
  ];

  // 숫자 포맷 적용 (B~M열, 숫자인 셀만)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = 1; c <= 12; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = '#,##0';
      }
    }
  }
  // 상세내역 금액 포맷 (D, H열 등)
  for (let r = 29; r <= 34; r++) {
    for (const c of [3, 7, 11]) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = '#,##0';
      }
    }
  }

  return ws;
}

export function generateBankAnnualExcel(data: BankAnnualExcelData): void {
  const ws = createBankAnnualSheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '연간보고');
  XLSX.writeFile(wb, `연간보고_${data.year}년.xlsx`);
}
