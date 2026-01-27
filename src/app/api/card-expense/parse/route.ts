import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  getCardOwners,
  findNhCardExpenseRecord,
  generateId,
} from '@/lib/google-sheets';
import type { CardOwner, CardExpenseItem, CardExpenseParseResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json<CardExpenseParseResponse>(
        { success: false, transactions: [], matchingRecord: null, totalAmount: 0, error: '파일이 없습니다' },
        { status: 400 }
      );
    }

    // 파일 읽기
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // 첫 번째 시트
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // JSON으로 변환
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    // 헤더 찾기 (농협 카드 결제내역 형식)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (Array.isArray(row)) {
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('카드번호') || rowStr.includes('가맹점') || rowStr.includes('매출일')) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json<CardExpenseParseResponse>(
        {
          success: false,
          transactions: [],
          matchingRecord: null,
          totalAmount: 0,
          error: '지원하지 않는 파일 형식입니다. NH카드 결제내역 XLSX 파일을 사용하세요.',
        },
        { status: 400 }
      );
    }

    const headers = rawData[headerRowIndex] as string[];
    const dataRows = rawData.slice(headerRowIndex + 1);

    // 컬럼 인덱스 매핑 (사용자 지정: C/D=카드번호, G=가맹점, H=매출일, K=거래금액)
    const colIndex = {
      cardNumber: findColumnIndex(headers, ['카드번호']),
      merchant: findColumnIndex(headers, ['가맹점명', '가맹점', '상호', '이용가맹점']),
      saleDate: findColumnIndex(headers, ['매출일', '이용일', '거래일']),
      transactionAmount: findColumnIndex(headers, ['거래금액', '청구금액', '이용금액']),
    };

    // 카드 소유자 목록 조회
    let cardOwners: CardOwner[] = [];
    try {
      cardOwners = await getCardOwners();
    } catch {
      // 카드 소유자 테이블이 없을 수 있음
    }

    // 데이터 변환
    const transactions: CardExpenseItem[] = [];
    let totalAmount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as unknown[];
      if (!row || row.length === 0) continue;

      const cardNumber = String(row[colIndex.cardNumber] || '').trim();
      const merchant = String(row[colIndex.merchant] || '').trim();

      // 가맹점 필수
      if (!merchant) continue;

      const amount = parseAmount(row[colIndex.transactionAmount]);

      // 금액이 없으면 스킵
      if (amount === 0) continue;

      // 카드소유자 매핑
      const vendor = findCardOwner(cardNumber, cardOwners);

      // 자동 분류 적용
      const { description, accountCode } = applyAutoClassification(vendor, merchant);

      const item: CardExpenseItem = {
        tempId: generateId('TEMP'),
        date: '', // NH카드대금 행에서 가져올 예정
        payment_method: '법인카드',
        vendor: vendor || `미등록(${cardNumber})`,
        amount,
        note: merchant,
        transaction_date: parseDate(row[colIndex.saleDate]),
        description,
        account_code: accountCode,
        card_number: cardNumber,
      };

      transactions.push(item);
      totalAmount += amount;
    }

    if (transactions.length === 0) {
      return NextResponse.json<CardExpenseParseResponse>(
        {
          success: false,
          transactions: [],
          matchingRecord: null,
          totalAmount: 0,
          error: '유효한 카드 거래 데이터가 없습니다',
        },
        { status: 400 }
      );
    }

    // 지출부에서 NH카드대금 행 검색
    const matchingRecord = await findNhCardExpenseRecord(totalAmount);

    let warning: string | undefined;
    if (matchingRecord) {
      // 매칭된 행의 date를 모든 거래에 적용
      transactions.forEach((tx) => {
        tx.date = matchingRecord.date;
      });
    } else {
      warning = `지출부에서 금액 ${totalAmount.toLocaleString()}원과 일치하는 'NH카드대금' 항목을 찾을 수 없습니다.`;
    }

    return NextResponse.json<CardExpenseParseResponse>({
      success: true,
      transactions,
      matchingRecord: matchingRecord
        ? {
            id: matchingRecord.id,
            date: matchingRecord.date,
            amount: matchingRecord.amount,
          }
        : null,
      totalAmount,
      warning,
    });
  } catch (error) {
    console.error('Card expense parse error:', error);
    return NextResponse.json<CardExpenseParseResponse>(
      {
        success: false,
        transactions: [],
        matchingRecord: null,
        totalAmount: 0,
        error: '카드내역 파싱 중 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase().trim();
    for (const candidate of candidates) {
      if (header.includes(candidate.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}

function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const str = String(value).replace(/[,원\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: unknown): string {
  if (!value) return '';

  // Excel serial number
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }

  // String 형식
  const str = String(value).split(' ')[0].replace(/\//g, '-');
  const dateMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
}

function findCardOwner(cardNumber: string, owners: CardOwner[]): string {
  if (!cardNumber) return '';
  const owner = owners.find((o) => o.card_number === cardNumber);
  return owner?.owner_name || '';
}

// 자동 분류 규칙 적용
function applyAutoClassification(
  vendor: string,
  note: string
): { description: string; accountCode: number | null } {
  // 정옥숙 → 차량유지 (65)
  if (vendor === '정옥숙') {
    return { description: '차량유지', accountCode: 65 };
  }

  // 최병희 + 주유소/하이패스 → 차량유지 (65)
  if (vendor === '최병희') {
    const noteLower = note.toLowerCase();
    if (noteLower.includes('주유소') || noteLower.includes('하이패스')) {
      return { description: '차량유지', accountCode: 65 };
    }
  }

  // 그 외는 빈값 (수동 입력 필요)
  return { description: '', accountCode: null };
}
