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
    // NH카드 엑셀 기준: H컬럼(인덱스 7)이 매출일
    const colIndex = {
      cardNumber: findColumnIndex(headers, ['카드번호']),
      merchant: findColumnIndex(headers, ['가맹점명', '가맹점', '상호', '이용가맹점']),
      saleDate: findColumnIndexWithFallback(headers, ['매출일', '이용일', '거래일', '매출일자', '이용일자', '거래일자'], 7),
      transactionAmount: findColumnIndex(headers, ['거래금액', '청구금액', '이용금액']),
    };

    // 디버그: 컬럼 매핑 정보 로깅
    console.log('Column mapping:', {
      headers: headers.slice(0, 15),
      colIndex,
    });

    // 카드 소유자 목록 조회
    let cardOwners: CardOwner[] = [];
    try {
      cardOwners = await getCardOwners();
      // 디버그: 카드소유자 목록 로깅
      console.log('Card owners:', cardOwners.map(o => ({
        card_number: o.card_number,
        owner_name: o.owner_name
      })));
    } catch (err) {
      console.log('Failed to get card owners:', err);
    }

    // 데이터 변환
    const transactions: CardExpenseItem[] = [];
    let totalAmount = 0;
    let skippedRows: { reason: string; row: unknown[] }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as unknown[];
      if (!row || row.length === 0) continue;

      const cardNumber = String(row[colIndex.cardNumber] || '').trim();
      const merchant = String(row[colIndex.merchant] || '').trim();
      const amount = parseAmount(row[colIndex.transactionAmount]);

      // 금액이 없으면 스킵 (가맹점 조건 제거 - 금액이 있으면 처리)
      if (amount === 0) {
        if (merchant) {
          skippedRows.push({ reason: '금액 0', row });
        }
        continue;
      }

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
        note: merchant || '(가맹점 정보 없음)',
        transaction_date: parseDate(row[colIndex.saleDate]),
        description,
        account_code: accountCode,
        card_number: cardNumber,
      };

      transactions.push(item);
      totalAmount += amount;

      // 디버그: 첫 3개 행의 전체 데이터 로깅
      if (transactions.length <= 3) {
        const rawSaleDate = row[colIndex.saleDate];
        console.log(`Row ${i} full data:`, JSON.stringify(row.slice(0, 12)));
        console.log(`Row ${i}: saleDate col[${colIndex.saleDate}]=[${rawSaleDate}] type=${typeof rawSaleDate}, parsed="${parseDate(rawSaleDate)}"`);
      }
    }

    // 디버그: 총 금액 로깅
    console.log(`Total parsed: ${transactions.length} transactions, amount=${totalAmount}`);

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

// 헤더 매칭 실패 시 fallback 인덱스 사용
function findColumnIndexWithFallback(headers: string[], candidates: string[], fallbackIndex: number): number {
  const found = findColumnIndex(headers, candidates);
  if (found >= 0) return found;
  // 헤더 매칭 실패 시 fallback 인덱스 반환 (단, 헤더 범위 내일 때만)
  if (fallbackIndex >= 0 && fallbackIndex < headers.length) {
    console.log(`Column not found by header, using fallback index ${fallbackIndex} for: ${candidates.join(', ')}`);
    return fallbackIndex;
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

  // String 형식 (슬래시와 점 모두 하이픈으로 변환: 2025.11.18 → 2025-11-18)
  const str = String(value).split(' ')[0].replace(/[.\/]/g, '-');
  const dateMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
}

function findCardOwner(cardNumber: string, owners: CardOwner[]): string {
  if (!cardNumber) return '';

  // 카드번호 정규화 (하이픈, 공백, 마스킹 문자 제거)
  const normalizeCardNumber = (num: string): string => {
    return num.replace(/[-\s*]/g, '');
  };

  const normalizedInput = normalizeCardNumber(cardNumber);

  // 1차: 정확히 일치
  let owner = owners.find((o) => o.card_number === cardNumber);
  if (owner) return owner.owner_name;

  // 2차: 정규화 후 일치
  owner = owners.find((o) => normalizeCardNumber(o.card_number) === normalizedInput);
  if (owner) return owner.owner_name;

  // 3차: 뒤 4자리로 매칭 (카드 식별에 주로 사용)
  const last4Digits = cardNumber.replace(/\D/g, '').slice(-4);
  if (last4Digits.length === 4) {
    owner = owners.find((o) => o.card_number.replace(/\D/g, '').slice(-4) === last4Digits);
    if (owner) return owner.owner_name;
  }

  return '';
}

// 자동 분류 규칙 적용
function applyAutoClassification(
  vendor: string,
  note: string
): { description: string; accountCode: number | null } {
  const noteLower = note.toLowerCase();

  // 1. 정옥숙 → 모두 차량유지 (65)
  if (vendor === '정옥숙') {
    return { description: '차량유지', accountCode: 65 };
  }

  // 2. 후불하이패스 → 보유자 무관하게 차량유지 (65)
  const isHighpass = noteLower.includes('하이패스') ||
                     noteLower.includes('후불하이패스') ||
                     noteLower.includes('hipass') ||
                     noteLower.includes('hi-pass') ||
                     noteLower.includes('도로공사') ||
                     noteLower.includes('고속도로');
  if (isHighpass) {
    return { description: '차량유지', accountCode: 65 };
  }

  // 3. 최병희 + 주유소/석유/오일 → 차량유지 (65)
  if (vendor === '최병희') {
    const isGasStation = noteLower.includes('주유소') ||
                         noteLower.includes('주유') ||
                         noteLower.includes('석유') ||
                         noteLower.includes('오일');
    if (isGasStation) {
      return { description: '차량유지', accountCode: 65 };
    }
  }

  // 그 외는 빈값 (수동 입력 필요)
  return { description: '', accountCode: null };
}
