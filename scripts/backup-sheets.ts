import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// .env.local 로드
config({ path: path.join(__dirname, '../.env.local') });

const FINANCE_SHEET_ID = process.env.FINANCE_SHEET_ID!;

if (!FINANCE_SHEET_ID) {
  console.error('❌ FINANCE_SHEET_ID 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Google Sheets 백업 스크립트');
  console.log('='.repeat(60));

  // Google Sheets API 클라이언트 초기화
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 백업 디렉토리 생성
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupSubDir = path.join(backupDir, `backup_${timestamp}`);
  fs.mkdirSync(backupSubDir, { recursive: true });

  console.log(`\n백업 위치: ${backupSubDir}\n`);

  // 수입부 백업
  console.log('수입부 백업 중...');
  const incomeResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '수입부!A:K',
  });

  const incomeRows = incomeResponse.data.values || [];
  console.log(`  총 ${incomeRows.length}행 (헤더 포함)`);

  // 2003-2017 범위만 백업
  const incomeHeader = incomeRows[0];
  const income2003_2017 = incomeRows.filter((row, idx) => {
    if (idx === 0) return true; // 헤더 포함
    const date = row[1]; // date 컬럼
    if (!date) return false;
    try {
      const year = new Date(date).getFullYear();
      return year >= 2003 && year <= 2017;
    } catch {
      return false;
    }
  });

  console.log(`  2003-2017 범위: ${income2003_2017.length - 1}건 (헤더 제외)`);

  const incomeCSV = income2003_2017.map(row =>
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const incomeBackupPath = path.join(backupSubDir, '수입부_2003_2017_백업.csv');
  fs.writeFileSync(incomeBackupPath, '\uFEFF' + incomeCSV, 'utf-8'); // BOM 추가 (Excel 호환)
  console.log(`  저장 완료: ${incomeBackupPath}`);

  // 지출부 백업
  console.log('\n지출부 백업 중...');
  const expenseResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_SHEET_ID,
    range: '지출부!A:K',
  });

  const expenseRows = expenseResponse.data.values || [];
  console.log(`  총 ${expenseRows.length}행 (헤더 포함)`);

  // 2003-2017 범위만 백업
  const expenseHeader = expenseRows[0];
  const expense2003_2017 = expenseRows.filter((row, idx) => {
    if (idx === 0) return true; // 헤더 포함
    const date = row[1]; // date 컬럼
    if (!date) return false;
    try {
      const year = new Date(date).getFullYear();
      return year >= 2003 && year <= 2017;
    } catch {
      return false;
    }
  });

  console.log(`  2003-2017 범위: ${expense2003_2017.length - 1}건 (헤더 제외)`);

  const expenseCSV = expense2003_2017.map(row =>
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const expenseBackupPath = path.join(backupSubDir, '지출부_2003_2017_백업.csv');
  fs.writeFileSync(expenseBackupPath, '\uFEFF' + expenseCSV, 'utf-8'); // BOM 추가
  console.log(`  저장 완료: ${expenseBackupPath}`);

  // 백업 요약 파일 생성
  const summary = {
    timestamp: new Date().toISOString(),
    backup_dir: backupSubDir,
    income: {
      total_rows: incomeRows.length,
      range_2003_2017: income2003_2017.length - 1,
      file: incomeBackupPath,
    },
    expense: {
      total_rows: expenseRows.length,
      range_2003_2017: expense2003_2017.length - 1,
      file: expenseBackupPath,
    },
  };

  const summaryPath = path.join(backupSubDir, 'backup_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('✅ 백업 완료!');
  console.log('='.repeat(60));
  console.log(`\n백업 위치: ${backupSubDir}`);
  console.log(`\n수입부: ${income2003_2017.length - 1}건`);
  console.log(`지출부: ${expense2003_2017.length - 1}건`);
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
