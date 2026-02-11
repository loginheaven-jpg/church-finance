import * as XLSX from 'xlsx';

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

export interface BankBudgetExcelData {
  year: number;
  carryover: number;
  income: {
    categories: IncomeCategory[];
    generalSubtotal: number;
    constructionTotal: number;
    grandTotal: number;
  };
  incomeDetail: {
    offering: Array<{ name: string; amount: number }>;     // 헌금 상세
    purposeOffering: Array<{ name: string; amount: number }>; // 목적헌금 상세
    constructionAmount: number;
    miscAmount: number; // 잡수입
    interestAmount: number; // 이자수입
  };
  expense: {
    categories: ExpenseCategory[];
    generalSubtotal: number;
    constructionTotal: number;
    grandTotal: number;
  };
}

export function createBankBudgetSheet(data: BankBudgetExcelData): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [];

  // Helper: 빈 행
  const emptyRow = () => [null, null, null, null, null, null, null];

  // Row 1: 제목
  rows.push(['예산안', null, null, null, null, null, null]);
  rows.push(emptyRow()); // Row 2
  rows.push(emptyRow()); // Row 3

  // Row 4: 헤더
  rows.push(['항목', null, null, null, null, null, '합계 (단위:원)']);
  const headerRowIdx = 3; // 0-indexed

  // Row 5: 전기이년
  rows.push(['전기이년', null, data.carryover, null, null, null, null]);

  // Row 6: 수입부 헤더
  rows.push([null, '수입부', null, null, '수입부 상세내역', null, null]);
  const incomeHeaderRowIdx = rows.length - 1;

  // 수입부 카테고리 (건축 제외)
  const generalCats = data.income.categories.filter(c => c.categoryCode < 500);

  // 수입부 상세내역 행 수집 (우측에 배치)
  const detailRows: Array<{ e: string | null; f: string | null; g: number | null }> = [];

  // 헌금 상세 (첫 항목에 '헌금' 라벨)
  for (let i = 0; i < data.incomeDetail.offering.length; i++) {
    const item = data.incomeDetail.offering[i];
    detailRows.push({ e: i === 0 ? '헌금' : null, f: item.name, g: item.amount });
  }

  // 목적헌금 상세 (첫 항목에 '목적헌금' 라벨)
  for (let i = 0; i < data.incomeDetail.purposeOffering.length; i++) {
    const item = data.incomeDetail.purposeOffering[i];
    detailRows.push({ e: i === 0 ? '목적헌금' : null, f: item.name, g: item.amount });
  }

  // 건축헌금
  detailRows.push({ e: '건축헌금', f: null, g: data.incomeDetail.constructionAmount });

  // 기타 (잡수입/이자수입 분리)
  detailRows.push({ e: '기타', f: '잡수입', g: data.incomeDetail.miscAmount });
  detailRows.push({ e: null, f: '이자수입', g: data.incomeDetail.interestAmount });

  // 수입부 좌측 행 생성 + 우측 상세 병합
  let detailIdx = 0;
  for (const cat of generalCats) {
    const detail = detailRows[detailIdx] || { e: null, f: null, g: null };
    rows.push([null, cat.categoryName, cat.total, null, detail.e, detail.f, detail.g]);
    detailIdx++;
  }

  // 일반수입소계
  const detail1 = detailRows[detailIdx] || { e: null, f: null, g: null };
  rows.push([null, '일반수입소계', data.income.generalSubtotal, null, detail1.e, detail1.f, detail1.g]);
  detailIdx++;

  // 건축헌금
  const detail2 = detailRows[detailIdx] || { e: null, f: null, g: null };
  const constructionCat = data.income.categories.find(c => c.categoryCode === 500);
  rows.push([null, '건축헌금', constructionCat?.total || 0, null, detail2.e, detail2.f, detail2.g]);
  detailIdx++;

  // 금년수입총계
  const detail3 = detailRows[detailIdx] || { e: null, f: null, g: null };
  rows.push(['금년수입총계', null, data.income.grandTotal, null, detail3.e, detail3.f, detail3.g]);
  detailIdx++;

  // 나머지 상세 행 (마지막 1개는 지출부 헤더와 같은 행에 배치)
  const remainingDetails: typeof detailRows = [];
  while (detailIdx < detailRows.length) {
    remainingDetails.push(detailRows[detailIdx]);
    detailIdx++;
  }
  for (let i = 0; i < remainingDetails.length - 1; i++) {
    const detail = remainingDetails[i];
    rows.push([null, null, null, null, detail.e, detail.f, detail.g]);
  }

  // 지출부 헤더 (마지막 상세와 같은 행)
  const lastDetail = remainingDetails.length > 0
    ? remainingDetails[remainingDetails.length - 1]
    : { e: null, f: null, g: null };
  rows.push([null, '지출부', null, null, lastDetail.e, lastDetail.f, lastDetail.g]);

  // 지출부 카테고리 (건축 제외)
  const generalExpCats = data.expense.categories.filter(c => c.categoryCode < 500);
  for (const cat of generalExpCats) {
    rows.push([null, cat.categoryName, cat.total, null, null, null, null]);
  }

  // 일반지출 소계
  rows.push([null, '일반지출 소계', data.expense.generalSubtotal, null, null, null, null]);

  // 건축비
  const constructionExp = data.expense.categories.find(c => c.categoryCode === 500);
  rows.push([null, '건축비', constructionExp?.total || 0, null, null, null, null]);

  // 금년지출총계
  rows.push(['금년지출총계', null, data.expense.grandTotal, null, null, null, null]);

  // 시트 생성
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 16 },  // A: 항목/소계 레이블
    { wch: 14 },  // B: 카테고리명
    { wch: 18 },  // C: 금액
    { wch: 3 },   // D: 구분자
    { wch: 12 },  // E: 상세 카테고리
    { wch: 16 },  // F: 상세 항목명
    { wch: 18 },  // G: 상세 금액
  ];

  // 숫자 포맷 적용
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (const col of [2, 6]) { // C열, G열
      const cellRef = XLSX.utils.encode_cell({ r, c: col });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = '#,##0';
      }
    }
  }

  return ws;
}

export function generateBankBudgetExcel(data: BankBudgetExcelData): void {
  const ws = createBankBudgetSheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '예산안');
  XLSX.writeFile(wb, `예산안_${data.year}년.xlsx`);
}
