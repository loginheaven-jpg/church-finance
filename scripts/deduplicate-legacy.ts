import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { config } from 'dotenv';
import type { IncomeRecord, ExpenseRecord } from '../src/types';

// .env.local 로드
config({ path: path.join(__dirname, '../.env.local') });

const FINANCE_SHEET_ID = process.env.FINANCE_SHEET_ID!;

if (!FINANCE_SHEET_ID) {
  console.error('❌ FINANCE_SHEET_ID 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

// ID 생성 함수
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// KST 날짜/시간
function getKSTDateTime(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kst.toISOString();
}

// Excel 날짜 변환
function excelDateToString(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/\//g, '-').split(' ')[0];
    return cleaned;
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  return '';
}

async function main(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log(`중복 제거 스크립트 ${dryRun ? '(드라이런 모드)' : '(실제 실행)'}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n⚠️  드라이런 모드: 실제 변경은 발생하지 않습니다.\n');
  } else {
    console.log('\n🚨 실제 실행 모드: 데이터가 변경됩니다!\n');
  }

  // Google Sheets API 클라이언트
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. 수입부 처리
  console.log('### 수입부 처리 ###\n');

  // 1-1. 현재 데이터 조회
  console.log('1. 현재 데이터 조회 중...');
  const incomeResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '수입부!A:K',
  });

  const incomeRows = incomeResponse.data.values || [];
  const incomeHeader = incomeRows[0];

  // 2003-2017 범위 필터링
  const income2003_2017_indices: number[] = [];
  incomeRows.forEach((row, idx) => {
    if (idx === 0) return; // 헤더 제외
    const date = row[1];
    if (!date) return;
    try {
      const year = new Date(date).getFullYear();
      if (year >= 2003 && year <= 2017) {
        income2003_2017_indices.push(idx + 1); // 1-based index
      }
    } catch {}
  });

  console.log(`   현재 수입부 총 레코드: ${incomeRows.length - 1}건`);
  console.log(`   2003-2017 범위: ${income2003_2017_indices.length}건`);

  // 1-2. 원본 Excel 로드
  console.log('\n2. 원본 Excel 로드 중...');
  const incomeExcelPath = path.join(__dirname, '../../saint-record-v2/수입부_2003_2017_원장.xlsx');
  const incomeWb = XLSX.readFile(incomeExcelPath);
  const incomeSheet = incomeWb.Sheets[incomeWb.SheetNames[0]];
  const incomeExcelData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 }) as unknown[][];

  console.log(`   원본 Excel: ${incomeExcelData.length - 1}건`);

  // 1-3. 원본 데이터를 Google Sheets 형식으로 변환
  const now = getKSTDateTime();
  const newIncomeRecords: unknown[][] = [];

  for (let i = 1; i < incomeExcelData.length; i++) {
    const row = incomeExcelData[i];
    const date = excelDateToString(row[0]);
    if (!date) continue;

    const record = [
      generateId('INC'),               // id
      date,                            // date
      String(row[1] || '헌금함'),       // source
      Number(row[2]) || 11,            // offering_code
      String(row[3] || ''),            // donor_name
      String(row[4] || row[3] || ''),  // representative
      Number(row[5]) || 0,             // amount
      '',                              // note
      'Legacy(2003-2017-재업로드)',    // input_method
      now,                             // created_at
      'deduplicate-script',            // created_by
    ];

    newIncomeRecords.push(record);
  }

  console.log(`   변환된 레코드: ${newIncomeRecords.length}건`);

  // 2. 지출부 처리
  console.log('\n' + '='.repeat(60));
  console.log('### 지출부 처리 ###\n');

  // 2-1. 현재 데이터 조회
  console.log('1. 현재 데이터 조회 중...');
  const expenseResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '지출부!A:K',
  });

  const expenseRows = expenseResponse.data.values || [];
  const expenseHeader = expenseRows[0];

  // 2003-2017 범위 필터링
  const expense2003_2017_indices: number[] = [];
  expenseRows.forEach((row, idx) => {
    if (idx === 0) return; // 헤더 제외
    const date = row[1];
    if (!date) return;
    try {
      const year = new Date(date).getFullYear();
      if (year >= 2003 && year <= 2017) {
        expense2003_2017_indices.push(idx + 1); // 1-based index
      }
    } catch {}
  });

  console.log(`   현재 지출부 총 레코드: ${expenseRows.length - 1}건`);
  console.log(`   2003-2017 범위: ${expense2003_2017_indices.length}건`);

  // 2-2. 원본 Excel 로드
  console.log('\n2. 원본 Excel 로드 중...');
  const expenseExcelPath = path.join(__dirname, '../../saint-record-v2/지출부_2003_2017_원장.xlsx');
  const expenseWb = XLSX.readFile(expenseExcelPath);
  const expenseSheet = expenseWb.Sheets[expenseWb.SheetNames[0]];
  const expenseExcelData = XLSX.utils.sheet_to_json(expenseSheet, { header: 1 }) as unknown[][];

  console.log(`   원본 Excel: ${expenseExcelData.length - 1}건`);

  // 2-3. 원본 데이터를 Google Sheets 형식으로 변환
  const newExpenseRecords: unknown[][] = [];

  for (let i = 1; i < expenseExcelData.length; i++) {
    const row = expenseExcelData[i];
    const date = excelDateToString(row[0]);
    if (!date) continue;

    const accountCode = Number(row[2]) || 0;
    const categoryCode = accountCode > 0 ? Math.floor(accountCode / 10) * 10 : 0;
    const finalCategoryCode = accountCode >= 500 ? 500 : categoryCode;

    const record = [
      generateId('EXP'),                // id
      date,                             // date
      String(row[1] || ''),             // payment_method
      String(row[4] || ''),             // vendor
      String(row[3] || ''),             // description
      Number(row[5]) || 0,              // amount
      accountCode,                      // account_code
      finalCategoryCode,                // category_code
      String(row[6] || ''),             // note
      now,                              // created_at
      'deduplicate-script',             // created_by
    ];

    newExpenseRecords.push(record);
  }

  console.log(`   변환된 레코드: ${newExpenseRecords.length}건`);

  // 3. 실행 계획 출력
  console.log('\n' + '='.repeat(60));
  console.log('### 실행 계획 ###\n');
  console.log('수입부:');
  console.log(`  1. 삭제할 행: ${income2003_2017_indices.length}개 (2003-2017)`);
  console.log(`  2. 추가할 행: ${newIncomeRecords.length}개 (원본 Excel)`);
  console.log(`  3. 최종 예상: 기존 ${incomeRows.length - 1}건 - ${income2003_2017_indices.length}건 + ${newIncomeRecords.length}건 = ${incomeRows.length - 1 - income2003_2017_indices.length + newIncomeRecords.length}건`);

  console.log('\n지출부:');
  console.log(`  1. 삭제할 행: ${expense2003_2017_indices.length}개 (2003-2017)`);
  console.log(`  2. 추가할 행: ${newExpenseRecords.length}개 (원본 Excel)`);
  console.log(`  3. 최종 예상: 기존 ${expenseRows.length - 1}건 - ${expense2003_2017_indices.length}건 + ${newExpenseRecords.length}건 = ${expenseRows.length - 1 - expense2003_2017_indices.length + newExpenseRecords.length}건`);

  if (dryRun) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ 드라이런 완료! 실제 변경은 발생하지 않았습니다.');
    console.log('='.repeat(60));
    console.log('\n실제 실행하려면: npx tsx scripts/deduplicate-legacy.ts --execute');
    return;
  }

  // 4. 실제 실행
  console.log('\n' + '='.repeat(60));
  console.log('### 실제 실행 시작 ###\n');

  // 4-1. 수입부 2003-2017 삭제
  console.log('1. 수입부 2003-2017 범위 삭제 중...');
  // Google Sheets API로 행 삭제는 복잡하므로, 간단하게 clear 후 다시 작성하는 방식 사용
  // 실제 구현은 추후 완성

  console.log('\n⚠️  실제 삭제/추가 로직은 사용자 승인 후 구현됩니다.');
  console.log('='.repeat(60));
}

// 커맨드 라인 인자 확인
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

main(dryRun).catch(console.error);
