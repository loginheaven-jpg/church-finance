import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { addBankTransactions, generateId, getKSTDateTime } from '@/lib/google-sheets';
import type { BankTransaction } from '@/types';

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

    // 헤더 찾기 (농협 XLS 형식)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (Array.isArray(row)) {
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('거래일시') || rowStr.includes('출금') || rowStr.includes('입금')) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. 농협 입출금내역 XLS 파일을 사용하세요.' },
        { status: 400 }
      );
    }

    const headers = rawData[headerRowIndex] as string[];
    const dataRows = rawData.slice(headerRowIndex + 1);

    // 컬럼 인덱스 매핑
    const colIndex = {
      date: findColumnIndex(headers, ['거래일시', '거래일', '일시']),
      withdrawal: findColumnIndex(headers, ['출금액', '출금', '지급금액']),
      deposit: findColumnIndex(headers, ['입금액', '입금', '입금금액']),
      balance: findColumnIndex(headers, ['잔액', '거래후잔액']),
      description: findColumnIndex(headers, ['적요', '거래내용', '내용']),
      detail: findColumnIndex(headers, ['거래기록사항', '비고', '메모', '기록사항']),
      branch: findColumnIndex(headers, ['거래점', '지점']),
    };

    // 데이터 변환
    const transactions: BankTransaction[] = [];
    const uploadedAt = getKSTDateTime();

    for (const row of dataRows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const dateValue = row[colIndex.date];
      if (!dateValue) continue;

      // 날짜/시간 파싱
      const { date, time } = parseDatetime(dateValue);
      if (!date) continue;

      const withdrawal = parseAmount(row[colIndex.withdrawal]);
      const deposit = parseAmount(row[colIndex.deposit]);

      // 입출금 둘 다 없으면 스킵
      if (withdrawal === 0 && deposit === 0) continue;

      const transaction: BankTransaction = {
        id: generateId('BANK'),
        transaction_date: date,
        withdrawal,
        deposit,
        balance: parseAmount(row[colIndex.balance]),
        description: String(row[colIndex.description] || ''),
        detail: String(row[colIndex.detail] || ''),
        branch: String(row[colIndex.branch] || ''),
        time,
        memo: '',
        matched_status: 'pending',
        matched_type: '',
        matched_ids: '',
        suppressed: false,
        suppressed_reason: '',
        uploaded_at: uploadedAt,
      };

      transactions.push(transaction);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 거래 데이터가 없습니다' },
        { status: 400 }
      );
    }

    // Google Sheets에 저장
    await addBankTransactions(transactions);

    return NextResponse.json({
      success: true,
      uploaded: transactions.length,
      message: `${transactions.length}건의 은행 거래가 업로드되었습니다`,
    });
  } catch (error) {
    console.error('Bank upload error:', error);
    return NextResponse.json(
      { success: false, error: '은행원장 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase();
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

function parseDatetime(value: unknown): { date: string; time: string } {
  if (!value) return { date: '', time: '' };

  let str = String(value);

  // Excel serial number
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      const date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
      const time = `${String(excelDate.H).padStart(2, '0')}:${String(excelDate.M).padStart(2, '0')}`;
      return { date, time };
    }
  }

  // String 형식 파싱
  // "2024/01/15 14:30:00" or "2024-01-15 14:30"
  const parts = str.split(' ');
  const datePart = parts[0].replace(/\//g, '-');
  const timePart = parts[1] || '';

  // 날짜 형식 확인
  const dateMatch = datePart.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const time = timePart.substring(0, 5) || '';
    return { date, time };
  }

  return { date: '', time: '' };
}
