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
    miscAmount: number; // 잡수입/이자수입
  };
  expense: {
    categories: ExpenseCategory[];
    generalSubtotal: number;
    constructionTotal: number;
    grandTotal: number;
  };
}

export function generateBankBudgetExcel(data: BankBudgetExcelData): void {
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

  // 헌금 상세
  if (data.incomeDetail.offering.length > 0) {
    detailRows.push({ e: null, f: '주일헌금', g: data.incomeDetail.offering.find(o => o.name === '주일헌금')?.amount || 0 });
    detailRows.push({ e: null, f: '십일조헌금', g: data.incomeDetail.offering.find(o => o.name === '십일조헌금')?.amount || 0 });
    detailRows.push({ e: '헌금', f: '감사헌금', g: data.incomeDetail.offering.find(o => o.name === '감사헌금')?.amount || 0 });
    detailRows.push({ e: null, f: '특별(절기)헌금', g: data.incomeDetail.offering.find(o => o.name === '특별(절기)헌금')?.amount || 0 });
    detailRows.push({ e: null, f: '선교헌금', g: data.incomeDetail.offering.find(o => o.name === '선교헌금')?.amount || 0 });
  }

  // 목적헌금 상세
  if (data.incomeDetail.purposeOffering.length > 0) {
    detailRows.push({ e: '목적헌금', f: '구제헌금', g: data.incomeDetail.purposeOffering.find(o => o.name === '구제헌금')?.amount || 0 });
    detailRows.push({ e: null, f: '지정헌금', g: data.incomeDetail.purposeOffering.find(o => o.name === '지정헌금')?.amount || 0 });
  }

  // 건축헌금
  detailRows.push({ e: null, f: null, g: null }); // 빈행
  detailRows.push({ e: '건축헌금', f: null, g: data.incomeDetail.constructionAmount });

  // 기타
  detailRows.push({ e: null, f: null, g: null }); // 빈행
  detailRows.push({ e: '기타', f: '잡수입/이자수입', g: data.incomeDetail.miscAmount });

  // 수입부 좌측 행 생성 + 우측 상세 병합
  let detailIdx = 0;
  for (const cat of generalCats) {
    const detail = detailRows[detailIdx] || { e: null, f: null, g: null };
    rows.push([null, cat.categoryName, cat.total, null, detail.e, detail.f, detail.g]);
    detailIdx++;
  }

  // 일반수입소계
  const detail1 = detailRows[detailIdx] || { e: null, f: null, g: null };
  rows.push(['일반수입소계', null, data.income.generalSubtotal, null, detail1.e, detail1.f, detail1.g]);
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

  // 나머지 상세 행 추가
  while (detailIdx < detailRows.length) {
    const detail = detailRows[detailIdx];
    rows.push([null, null, null, null, detail.e, detail.f, detail.g]);
    detailIdx++;
  }

  // 빈 행
  rows.push(emptyRow());

  // 지출부 헤더
  rows.push([null, '지출부', null, null, null, null, null]);

  // 지출부 카테고리 (건축 제외)
  const generalExpCats = data.expense.categories.filter(c => c.categoryCode < 500);
  for (const cat of generalExpCats) {
    rows.push([null, cat.categoryName, cat.total, null, null, null, null]);
  }

  // 일반지출 소계
  rows.push(['일반지출 소계', null, data.expense.generalSubtotal, null, null, null, null]);

  // 건축비
  const constructionExp = data.expense.categories.find(c => c.categoryCode === 500);
  rows.push([null, '건축비', constructionExp?.total || 0, null, null, null, null]);

  // 빈 행
  rows.push(emptyRow());

  // 금년총계
  rows.push(['금년총계', null, data.expense.grandTotal, null, null, null, null]);

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

  // 워크북 생성 및 다운로드
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '예산안');
  XLSX.writeFile(wb, `예산안_${data.year}년.xlsx`);
}
