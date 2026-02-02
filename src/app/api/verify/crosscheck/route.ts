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
 * 현재 잔액 계산
 * 공식: 이월잔액 + 누적 수입 - 누적 지출
 */
async function calculateCurrentBalance(referenceDate: string): Promise<number> {
  const year = new Date(referenceDate).getFullYear();

  // 이월잔액 조회
  const carryover = await getCarryoverBalance(year);
  const carryoverBalance = carryover?.balance || 0;

  // 해당 기준일까지의 누적 수입
  const startOfYear = `${year}-01-01`;
  const incomeRecords = await getIncomeRecords(startOfYear, referenceDate);
  const totalIncome = incomeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

  // 해당 기준일까지의 누적 지출
  const expenseRecords = await getExpenseRecords(startOfYear, referenceDate);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

  return carryoverBalance + totalIncome - totalExpense;
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

    // 엑셀에서 해당 기준일의 입금/출금 총액 계산
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 헤더 찾기 (농협 은행 원장 형식)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
      if (rowStr.includes('거래일') && (rowStr.includes('입금') || rowStr.includes('출금'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate,
        income: null,
        expense: null,
        balance: null,
        error: '엑셀 파일에서 거래 헤더를 찾을 수 없습니다.',
      });
    }

    const headers = rawData[headerRowIndex];

    // 컬럼 인덱스 찾기
    const findColumn = (candidates: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i] || '').toLowerCase();
        for (const candidate of candidates) {
          if (header.includes(candidate.toLowerCase())) {
            return i;
          }
        }
      }
      return -1;
    };

    const colIndex = {
      date: findColumn(['거래일시', '거래일자', '거래일']),
      withdrawal: findColumn(['출금액', '출금금액', '출금']),
      deposit: findColumn(['입금액', '입금금액', '입금']),
    };

    if (colIndex.date === -1 || colIndex.withdrawal === -1 || colIndex.deposit === -1) {
      return NextResponse.json<VerificationResult>({
        success: false,
        referenceDate,
        income: null,
        expense: null,
        balance: null,
        error: '필수 컬럼(거래일, 입금액, 출금액)을 찾을 수 없습니다.',
      });
    }

    // 헬퍼 함수: 금액 파싱
    const parseAmount = (value: any): number => {
      if (value === null || value === undefined || value === '') return 0;
      if (typeof value === 'number') return value;
      const str = String(value).replace(/[,원\s]/g, '');
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    // 헬퍼 함수: 날짜 파싱
    const parseDate = (value: any): string => {
      if (!value) return '';

      // Excel serial number
      if (typeof value === 'number') {
        const excelDate = XLSX.SSF.parse_date_code(value);
        if (excelDate) {
          return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
        }
      }

      // String 형식
      const str = String(value);
      const match = str.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
      if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      }

      return '';
    };

    // 해당 기준일의 입금/출금 합계 계산
    let excelIncome = 0;
    let excelExpense = 0;

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const transactionDate = parseDate(row[colIndex.date]);
      if (transactionDate !== referenceDate) continue;

      const deposit = parseAmount(row[colIndex.deposit]);
      const withdrawal = parseAmount(row[colIndex.withdrawal]);

      excelIncome += deposit;
      excelExpense += withdrawal;
    }

    // 해당 기준일의 수입부 총액 조회 (DB)
    const incomeRecords = await getIncomeRecords(referenceDate, referenceDate);
    const dbIncome = incomeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 해당 기준일의 지출부 총액 조회 (DB)
    const expenseRecords = await getExpenseRecords(referenceDate, referenceDate);
    const dbExpense = expenseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 현재 잔액 계산 (DB 기준)
    const dbBalance = await calculateCurrentBalance(referenceDate);

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
