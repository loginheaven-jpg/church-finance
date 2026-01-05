import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { addCardTransactions, getCardOwners, generateId, getKSTDateTime } from '@/lib/google-sheets';
import type { CardTransaction, CardOwner } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다' },
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
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. 농협 카드 결제내역 XLSX 파일을 사용하세요.' },
        { status: 400 }
      );
    }

    const headers = rawData[headerRowIndex] as string[];
    const dataRows = rawData.slice(headerRowIndex + 1);

    // 컬럼 인덱스 매핑
    const colIndex = {
      billingDate: findColumnIndex(headers, ['청구일', '결제일', '청구예정일']),
      seq: findColumnIndex(headers, ['순번', 'NO', 'no']),
      cardNumber: findColumnIndex(headers, ['카드번호']),
      merchant: findColumnIndex(headers, ['가맹점명', '가맹점', '상호']),
      saleDate: findColumnIndex(headers, ['매출일', '이용일', '거래일']),
      saleAmount: findColumnIndex(headers, ['매출금액', '이용금액', '결제금액']),
      transactionAmount: findColumnIndex(headers, ['거래금액', '청구금액']),
    };

    // 카드 소유자 목록 조회
    let cardOwners: CardOwner[] = [];
    try {
      cardOwners = await getCardOwners();
    } catch {
      // 카드 소유자 테이블이 없을 수 있음
    }

    // 청구일 추출 (파일명 또는 첫 번째 데이터에서)
    let billingDate = '';
    if (colIndex.billingDate >= 0 && dataRows[0]) {
      const firstRow = dataRows[0] as unknown[];
      billingDate = parseDate(firstRow[colIndex.billingDate]);
    }
    if (!billingDate) {
      // 오늘 날짜 사용
      billingDate = new Date().toISOString().split('T')[0];
    }

    // 데이터 변환
    const transactions: CardTransaction[] = [];
    const uploadedAt = getKSTDateTime();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as unknown[];
      if (!row || row.length === 0) continue;

      const cardNumber = String(row[colIndex.cardNumber] || '').trim();
      const merchant = String(row[colIndex.merchant] || '').trim();

      // 가맹점 필수
      if (!merchant) continue;

      const saleAmount = parseAmount(row[colIndex.saleAmount]);
      const transactionAmount = parseAmount(row[colIndex.transactionAmount]) || saleAmount;

      // 금액이 없으면 스킵
      if (saleAmount === 0 && transactionAmount === 0) continue;

      const transaction: CardTransaction = {
        id: generateId('CARD'),
        billing_date: billingDate,
        seq: String(row[colIndex.seq] || i + 1),
        card_number: cardNumber,
        card_owner: findCardOwner(cardNumber, cardOwners),
        merchant,
        sale_date: parseDate(row[colIndex.saleDate]) || billingDate,
        sale_amount: saleAmount,
        transaction_amount: transactionAmount,
        purpose: '',
        account_code: undefined,
        detail_completed: false,
        matched_status: 'pending',
        matched_id: '',
        uploaded_at: uploadedAt,
      };

      transactions.push(transaction);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 카드 거래 데이터가 없습니다' },
        { status: 400 }
      );
    }

    // Google Sheets에 저장
    await addCardTransactions(transactions);

    return NextResponse.json({
      success: true,
      uploaded: transactions.length,
      message: `${transactions.length}건의 카드 결제내역이 업로드되었습니다`,
    });
  } catch (error) {
    console.error('Card upload error:', error);
    return NextResponse.json(
      { success: false, error: '카드내역 업로드 중 오류가 발생했습니다' },
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
  const owner = owners.find(o => o.card_number === cardNumber);
  return owner?.owner_name || '';
}
