import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getIncomeRecords, getExpenseRecords, getCarryoverBalance } from '@/lib/google-sheets';

// 검증 결과 타입
interface VerificationResult {
  success: boolean;
  referenceDate: string | null;
  income: {
    dbAmount: number;
    excelAmount: number;
    match: boolean;
    difference: number;
  } | null;
  expense: {
    dbAmount: number;
    excelAmount: number;
    match: boolean;
    difference: number;
  } | null;
  balance: {
    dbAmount: number;
    excelAmount: number;
    match: boolean;
    difference: number;
  } | null;
  error?: string;
}

/**
 * H6 셀에서 기준일 추출
 * 예: "2026년 01월 05일 (일)" → "2026-01-05"
 */
function extractDateFromH6(cellValue: string): string | null {
  if (!cellValue) return null;

  // 마지막 10자 추출
  const last10 = cellValue.slice(-10).trim();

  // 다양한 날짜 형식 지원
  // "2026-01-05", "2026/01/05", "2026.01.05" 등
  const patterns = [
    /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,  // 2026-01-05, 2026/01/05, 2026.01.05
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,  // 2026년 01월 05일
  ];

  for (const pattern of patterns) {
    const match = last10.match(pattern) || cellValue.match(pattern);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');

      // 날짜 유효성 검증
      const date = new Date(`${year}-${month}-${day}`);
      if (date.getFullYear() === parseInt(year) &&
          date.getMonth() === parseInt(month) - 1 &&
          date.getDate() === parseInt(day)) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  return null;
}

/**
 * E11 셀에서 금액 추출
 */
function extractAmountFromE11(cellValue: any): number | null {
  if (cellValue === null || cellValue === undefined) return null;

  // 숫자인 경우
  if (typeof cellValue === 'number') {
    return cellValue;
  }

  // 문자열인 경우 (콤마, 원화 기호 제거)
  if (typeof cellValue === 'string') {
    const cleaned = cellValue.replace(/[,원₩]/g, '').trim();
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }

  return null;
}

/**
 * 현재 잔액 계산 (주간보고와 동일한 로직)
 * 공식: 전년도 이월잔액 + 누적 수입(자본이동 제외) - 누적 지출(자본이동 제외)
 */
async function calculateCurrentBalance(referenceDate: string): Promise<number> {
  const year = new Date(referenceDate).getFullYear();

  // 전년도 이월잔액 조회 (주간보고와 동일)
  const carryover = await getCarryoverBalance(year - 1);
  const yearStartBalance = carryover?.balance || 0;

  // 해당 기준일까지의 누적 수입/지출
  const startOfYear = `${year}-01-01`;
  const incomeRecords = await getIncomeRecords(startOfYear, referenceDate);
  const expenseRecords = await getExpenseRecords(startOfYear, referenceDate);

  // 자본이동 제외하고 합산 (주간보고와 동일)
  let totalIncome = 0;
  for (const r of incomeRecords) {
    const code = r.offering_code;
    // 자본수입(40번대) 제외
    if (!(code >= 40 && code < 50)) {
      totalIncome += r.amount || 0;
    }
  }

  let totalExpense = 0;
  for (const r of expenseRecords) {
    const accountCode = r.account_code;
    // 자본지출(92, 93) 제외
    if (accountCode !== 92 && accountCode !== 93) {
      totalExpense += r.amount || 0;
    }
  }

  return yearStartBalance + totalIncome - totalExpense;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate: null,
        income: null,
        expense: null,
        balance: null,
        error: '파일을 선택해주세요',
      });
    }

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate: null,
        income: null,
        expense: null,
        balance: null,
        error: '엑셀 파일(.xls, .xlsx)만 업로드 가능합니다',
      });
    }

    // 파일 읽기
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // 첫 번째 시트 선택
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate: null,
        income: null,
        expense: null,
        balance: null,
        error: '엑셀 파일에 시트가 없습니다',
      });
    }

    const worksheet = workbook.Sheets[sheetName];

    // H6 셀 읽기 (기준일)
    const h6Cell = worksheet['H6'];
    if (!h6Cell) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate: null,
        income: null,
        expense: null,
        balance: null,
        error: 'H6 셀을 찾을 수 없습니다. 올바른 원장 파일인지 확인해주세요.',
      });
    }

    const h6Value = h6Cell.v || h6Cell.w || '';
    const referenceDate = extractDateFromH6(String(h6Value));

    if (!referenceDate) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate: null,
        income: null,
        expense: null,
        balance: null,
        error: `H6 셀에서 날짜를 파싱할 수 없습니다. 현재 값: "${h6Value}"`,
      });
    }

    // E11 셀 읽기 (현재잔액)
    const e11Cell = worksheet['E11'];
    if (!e11Cell) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate,
        income: null,
        expense: null,
        balance: null,
        error: 'E11 셀을 찾을 수 없습니다. 올바른 원장 파일인지 확인해주세요.',
      });
    }

    const excelBalance = extractAmountFromE11(e11Cell.v);
    if (excelBalance === null) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate,
        income: null,
        expense: null,
        balance: null,
        error: `E11 셀에서 금액을 파싱할 수 없습니다. 현재 값: "${e11Cell.v}"`,
      });
    }

    // 엑셀에서 C11~끝(지출), D11~끝(수입) 전체 합산
    // 헬퍼 함수: 금액 파싱
    const parseAmount = (value: any): number => {
      if (value === null || value === undefined || value === '') return 0;
      if (typeof value === 'number') return value;
      const str = String(value).replace(/[,원\s]/g, '');
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    // 시트의 마지막 행 찾기
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const lastRow = range.e.r;

    let excelExpense = 0;  // C열: 지출
    let excelIncome = 0;   // D열: 수입

    // C11부터 끝까지 (지출)
    for (let row = 10; row <= lastRow; row++) {  // Excel row 11 = index 10
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 });  // C열 = column 2
      const cell = worksheet[cellAddress];
      if (cell && cell.v !== null && cell.v !== undefined && cell.v !== '') {
        excelExpense += parseAmount(cell.v);
      }
    }

    // D11부터 끝까지 (수입)
    for (let row = 10; row <= lastRow; row++) {  // Excel row 11 = index 10
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 });  // D열 = column 3
      const cell = worksheet[cellAddress];
      if (cell && cell.v !== null && cell.v !== undefined && cell.v !== '') {
        excelIncome += parseAmount(cell.v);
      }
    }

    console.log('[Crosscheck] Excel parsing - Income:', excelIncome, 'Expense:', excelExpense);

    // 해당 기준일의 수입부 총액 조회 (DB)
    const incomeRecords = await getIncomeRecords(referenceDate, referenceDate);
    const dbIncome = incomeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 해당 기준일의 지출부 총액 조회 (DB)
    const expenseRecords = await getExpenseRecords(referenceDate, referenceDate);
    const dbExpense = expenseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 현재 잔액 계산 (DB 기준)
    const dbBalance = await calculateCurrentBalance(referenceDate);

    console.log('[Crosscheck] DB query - Income:', dbIncome, 'Expense:', dbExpense);
    console.log('[Crosscheck] Balance - Excel:', excelBalance, 'DB:', dbBalance);

    // 비교 결과 생성
    const result: VerificationResult = {
      success: true,
      referenceDate,
      income: {
        dbAmount: dbIncome,
        excelAmount: excelIncome,
        match: Math.abs(dbIncome - excelIncome) < 0.01,
        difference: dbIncome - excelIncome,
      },
      expense: {
        dbAmount: dbExpense,
        excelAmount: excelExpense,
        match: Math.abs(dbExpense - excelExpense) < 0.01,
        difference: dbExpense - excelExpense,
      },
      balance: {
        dbAmount: dbBalance,
        excelAmount: excelBalance,
        match: Math.abs(dbBalance - excelBalance) < 0.01,
        difference: dbBalance - excelBalance,
      },
    };

    return NextResponse.json<VerificationResult>(result);

  } catch (error) {
    console.error('Crosscheck verification error:', error);
    return NextResponse.json<VerificationResult>({
      success: false,
      referenceDate: null,
      income: null,
      expense: null,
      balance: null,
      error: error instanceof Error ? error.message : '검증 중 오류가 발생했습니다',
    });
  }
}
