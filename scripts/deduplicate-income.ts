import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { config } from 'dotenv';

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

// 딜레이 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('='.repeat(60));
  console.log('수입부 중복 제거 스크립트 (실제 실행)');
  console.log('='.repeat(60));
  console.log('\n🚨 실제 실행 모드: 수입부 데이터가 변경됩니다!\n');

  // Google Sheets API 클라이언트
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. 현재 데이터 조회
  console.log('### Step 1: 현재 데이터 조회 ###\n');
  const incomeResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '수입부!A:K',
  });

  const incomeRows = incomeResponse.data.values || [];
  const incomeHeader = incomeRows[0];

  console.log(`현재 수입부 총 행: ${incomeRows.length} (헤더 포함)`);

  // 2003-2017 범위와 2018년 이후 분리
  const rows2018Plus: unknown[][] = [incomeHeader]; // 헤더 포함
  const rows2003_2017: unknown[][] = [];

  incomeRows.forEach((row, idx) => {
    if (idx === 0) return; // 헤더 제외
    const date = row[1];
    if (!date) {
      rows2018Plus.push(row); // 날짜 없으면 2018+ 로 간주
      return;
    }
    try {
      const year = new Date(date).getFullYear();
      if (year >= 2003 && year <= 2017) {
        rows2003_2017.push(row);
      } else {
        rows2018Plus.push(row);
      }
    } catch {
      rows2018Plus.push(row);
    }
  });

  console.log(`2003-2017 범위: ${rows2003_2017.length}건 (삭제 대상)`);
  console.log(`2018년 이후: ${rows2018Plus.length - 1}건 (보존)`);

  // 2. 원본 Excel 로드
  console.log('\n### Step 2: 원본 Excel 로드 ###\n');
  const incomeExcelPath = path.join(__dirname, '../../saint-record-v2/수입부_2003_2017_원장.xlsx');
  const incomeWb = XLSX.readFile(incomeExcelPath);
  const incomeSheet = incomeWb.Sheets[incomeWb.SheetNames[0]];
  const incomeExcelData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 }) as unknown[][];

  console.log(`원본 Excel: ${incomeExcelData.length - 1}건`);

  // 3. 원본 데이터를 Google Sheets 형식으로 변환
  console.log('\n### Step 3: 데이터 변환 ###\n');
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
      'Legacy(2003-2017)',             // input_method
      now,                             // created_at
      'deduplicate-script',            // created_by
    ];

    newIncomeRecords.push(record);
  }

  console.log(`변환된 레코드: ${newIncomeRecords.length}건`);

  // 4. 시트 ID 조회
  console.log('\n### Step 4: 시트 ID 조회 ###\n');
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_SHEET_ID,
  });

  const incomeSheetInfo = spreadsheet.data.sheets?.find(
    s => s.properties?.title === '수입부'
  );

  if (!incomeSheetInfo?.properties?.sheetId) {
    throw new Error('수입부 시트를 찾을 수 없습니다');
  }

  const sheetId = incomeSheetInfo.properties.sheetId;
  console.log(`수입부 시트 ID: ${sheetId}`);

  // 5. 수입부 시트 초기화 (헤더 제외하고 전체 삭제)
  console.log('\n### Step 5: 기존 데이터 삭제 ###\n');

  if (incomeRows.length > 1) {
    // 헤더(1행) 제외하고 나머지 전체 삭제
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: FINANCE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: 1, // 0-based, 헤더 다음부터
                endIndex: incomeRows.length, // 전체 행 수
              },
            },
          },
        ],
      },
    });
    console.log(`${incomeRows.length - 1}개 행 삭제 완료`);
  }

  await delay(2000); // API 쿼터 방지

  // 6. 2018년 이후 데이터 복원
  console.log('\n### Step 6: 2018년 이후 데이터 복원 ###\n');

  const data2018Plus = rows2018Plus.slice(1); // 헤더 제외
  if (data2018Plus.length > 0) {
    // 배치로 추가
    const BATCH_SIZE = 1000;
    for (let i = 0; i < data2018Plus.length; i += BATCH_SIZE) {
      const batch = data2018Plus.slice(i, i + BATCH_SIZE);
      await sheets.spreadsheets.values.append({
        spreadsheetId: FINANCE_SHEET_ID,
        range: '수입부!A:K',
        valueInputOption: 'RAW',
        requestBody: {
          values: batch,
        },
      });
      console.log(`2018+ 데이터 복원: ${Math.min(i + BATCH_SIZE, data2018Plus.length)}/${data2018Plus.length}`);
      await delay(1500);
    }
  }
  console.log(`2018년 이후 데이터 ${data2018Plus.length}건 복원 완료`);

  // 7. 원본 Excel 데이터 추가
  console.log('\n### Step 7: 원본 Excel 데이터 추가 ###\n');

  const BATCH_SIZE = 1000;
  for (let i = 0; i < newIncomeRecords.length; i += BATCH_SIZE) {
    const batch = newIncomeRecords.slice(i, i + BATCH_SIZE);
    await sheets.spreadsheets.values.append({
      spreadsheetId: FINANCE_SHEET_ID,
      range: '수입부!A:K',
      valueInputOption: 'RAW',
      requestBody: {
        values: batch,
      },
    });
    console.log(`원본 데이터 추가: ${Math.min(i + BATCH_SIZE, newIncomeRecords.length)}/${newIncomeRecords.length}`);
    await delay(1500);
  }
  console.log(`원본 Excel 데이터 ${newIncomeRecords.length}건 추가 완료`);

  // 8. 검증
  console.log('\n### Step 8: 검증 ###\n');

  await delay(2000);

  const verifyResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '수입부!A:K',
  });

  const verifyRows = verifyResponse.data.values || [];
  const finalCount = verifyRows.length - 1;

  console.log('='.repeat(60));
  console.log('### 최종 결과 ###\n');
  console.log(`작업 전 수입부: ${incomeRows.length - 1}건`);
  console.log(`  - 2003-2017: ${rows2003_2017.length}건 (삭제됨)`);
  console.log(`  - 2018+: ${data2018Plus.length}건 (보존됨)`);
  console.log(`추가된 원본: ${newIncomeRecords.length}건`);
  console.log(`\n작업 후 수입부: ${finalCount}건`);
  console.log(`\n예상: ${data2018Plus.length + newIncomeRecords.length}건`);
  console.log(`실제: ${finalCount}건`);

  if (finalCount === data2018Plus.length + newIncomeRecords.length) {
    console.log('\n✅ 검증 성공! 데이터가 정확히 보정되었습니다.');
  } else {
    console.log('\n⚠️  검증 실패: 예상과 다른 결과입니다. 확인이 필요합니다.');
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
