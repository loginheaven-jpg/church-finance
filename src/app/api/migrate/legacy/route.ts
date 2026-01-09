import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { addIncomeRecords, addExpenseRecords, generateId, getKSTDateTime } from '@/lib/google-sheets';
import type { IncomeRecord, ExpenseRecord } from '@/types';

const BATCH_SIZE = 1000; // 배치 크기 증가
const BATCH_DELAY = 1500; // 배치 간 딜레이 (ms) - API 쿼터 제한 회피

// 딜레이 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Legacy 데이터 업로드 API
// GET: 파일 목록 및 미리보기
// POST: 데이터 업로드 실행

export async function GET() {
  try {
    const basePath = path.join(process.cwd(), '..');

    const files = {
      income2003_2017: '수입부_통합_2003_2017_최종.xlsx',
      income2018_2024: '수입부_통합_최종.xlsx',
      expense2003_2017: '지출부_통합_2003_2017_최종.xlsx',
      expense2018_2024: '지출부_통합_최종.xlsx',
    };

    const fileInfo: Record<string, { exists: boolean; path?: string; rows?: number; sample?: unknown[]; error?: string }> = {};

    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(basePath, filename);

      try {
        const exists = fs.existsSync(filePath);

        if (exists) {
          // 파일을 버퍼로 먼저 읽고 XLSX로 파싱
          const buffer = fs.readFileSync(filePath);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

          fileInfo[key] = {
            exists,
            path: filePath,
            rows: data.length - 1, // 헤더 제외
            sample: data.slice(0, 4), // 헤더 + 3행
          };
        } else {
          fileInfo[key] = { exists, path: filePath };
        }
      } catch (fileError) {
        fileInfo[key] = {
          exists: false,
          path: filePath,
          error: String(fileError)
        };
      }
    }

    return NextResponse.json({
      success: true,
      basePath,
      cwd: process.cwd(),
      files: fileInfo,
    });
  } catch (error) {
    console.error('Legacy file check error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'income' | 'expense' | 'all'

    const basePath = path.join(process.cwd(), '..');
    const now = getKSTDateTime();

    const results: Record<string, unknown> = {};

    if (type === 'income' || type === 'all') {
      // 수입부 2003-2017
      const income1Path = path.join(basePath, '수입부_통합_2003_2017_최종.xlsx');
      if (fs.existsSync(income1Path)) {
        results.income2003_2017 = await migrateIncomeFile(income1Path, now, '2003-2017');
      }

      // 수입부 2018-2024
      const income2Path = path.join(basePath, '수입부_통합_최종.xlsx');
      if (fs.existsSync(income2Path)) {
        results.income2018_2024 = await migrateIncomeFile(income2Path, now, '2018-2024');
      }
    }

    if (type === 'expense' || type === 'all') {
      // 지출부 2003-2017
      const expense1Path = path.join(basePath, '지출부_통합_2003_2017_최종.xlsx');
      if (fs.existsSync(expense1Path)) {
        results.expense2003_2017 = await migrateExpenseFile(expense1Path, now, '2003-2017');
      }

      // 지출부 2018-2024
      const expense2Path = path.join(basePath, '지출부_통합_최종.xlsx');
      if (fs.existsSync(expense2Path)) {
        results.expense2018_2024 = await migrateExpenseFile(expense2Path, now, '2018-2024');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Legacy 데이터 마이그레이션이 완료되었습니다',
      results,
    });
  } catch (error) {
    console.error('Legacy migration error:', error);
    return NextResponse.json({
      success: false,
      error: `마이그레이션 중 오류가 발생했습니다: ${error}`,
    }, { status: 500 });
  }
}

async function migrateIncomeFile(filePath: string, now: string, period: string) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // 헤더: 날짜, 경로, 헌금코드, 헌금자, 대표, 금액, 연도
  const dataRows = rawData.slice(1).filter(row => row[0] && row[5]); // 날짜와 금액이 있는 행

  const records: IncomeRecord[] = [];

  for (const row of dataRows) {
    const date = excelDateToString(row[0]);
    if (!date) continue;

    const record: IncomeRecord = {
      id: generateId('INC'),
      date,
      source: String(row[1] || '헌금함'),
      offering_code: Number(row[2]) || 11,
      donor_name: String(row[3] || ''),
      representative: String(row[4] || row[3] || ''),
      amount: Number(row[5]) || 0,
      note: '',
      input_method: `Legacy(${period})`,
      created_at: now,
      created_by: 'legacy-migrate',
    };

    records.push(record);
  }

  // 배치 처리
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await addIncomeRecords(batch);
    processed += batch.length;
    console.log(`수입부(${period}) 진행: ${processed}/${records.length}`);

    // 쿼터 제한 회피를 위한 딜레이
    if (i + BATCH_SIZE < records.length) {
      await delay(BATCH_DELAY);
    }
  }

  return { processed, total: records.length, period };
}

async function migrateExpenseFile(filePath: string, now: string, period: string) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // 헤더: 날짜, 경로, 지출코드, 지출항목, 청구자, 금액, 비고, 연도
  const dataRows = rawData.slice(1).filter(row => row[0] && row[5]); // 날짜와 금액이 있는 행

  const records: ExpenseRecord[] = [];

  for (const row of dataRows) {
    const date = excelDateToString(row[0]);
    if (!date) continue;

    const accountCode = Number(row[2]) || 0;
    const categoryCode = accountCode > 0 ? Math.floor(accountCode / 10) * 10 : 0;

    // 500번대 코드 특별 처리 (건축비)
    const finalCategoryCode = accountCode >= 500 ? 500 : categoryCode;

    const record: ExpenseRecord = {
      id: generateId('EXP'),
      date,
      payment_method: String(row[1] || ''),
      vendor: String(row[4] || ''),
      description: String(row[3] || ''),
      amount: Number(row[5]) || 0,
      account_code: accountCode,
      category_code: finalCategoryCode,
      note: String(row[6] || ''),
      created_at: now,
      created_by: 'legacy-migrate',
    };

    records.push(record);
  }

  // 배치 처리
  let processed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await addExpenseRecords(batch);
    processed += batch.length;
    console.log(`지출부(${period}) 진행: ${processed}/${records.length}`);

    // 쿼터 제한 회피를 위한 딜레이
    if (i + BATCH_SIZE < records.length) {
      await delay(BATCH_DELAY);
    }
  }

  return { processed, total: records.length, period };
}

function excelDateToString(value: unknown): string {
  if (!value) return '';

  // Excel serial number to date
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }

  // Already a string date (YYYY-MM-DD or similar)
  if (typeof value === 'string') {
    // Handle various date formats
    const cleaned = value.replace(/\//g, '-').split(' ')[0];
    return cleaned;
  }

  // Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  return '';
}
