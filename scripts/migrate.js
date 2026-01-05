const XLSX = require('xlsx');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const BATCH_SIZE = 500;

// Google Sheets 클라이언트
function getGoogleSheetsClient() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function generateId(prefix) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = kst.getTime().toString().slice(-6);
  return `${prefix}${dateStr}${timeStr}`;
}

function excelDateToString(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    }
  }
  if (typeof value === 'string') {
    return value.replace(/\//g, '-').split(' ')[0];
  }
  return '';
}

async function appendToSheet(sheets, spreadsheetId, sheetName, data) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: data },
  });
}

async function main() {
  const excelPath = path.join(__dirname, '..', '..', '2025결산.xlsm');
  console.log('Excel 파일 경로:', excelPath);

  const workbook = XLSX.readFile(excelPath);
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.FINANCE_SHEET_ID;
  const now = new Date().toISOString();

  console.log('=== 수입부 마이그레이션 시작 ===');
  const incomeSheet = workbook.Sheets['수입부'];
  const incomeData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 });
  const incomeRows = incomeData.slice(1).filter(row => row[0] && row[2] && row[3]);

  let incomeCount = 0;
  for (let i = 0; i < incomeRows.length; i += BATCH_SIZE) {
    const batch = incomeRows.slice(i, i + BATCH_SIZE);
    const rows = batch.map(row => {
      const date = excelDateToString(row[0]);
      return [
        generateId('INC'),
        date,
        String(row[1] || '헌금함'),
        Number(row[5]) || 11,
        String(row[2] || ''),
        String(row[9] || row[2] || ''),
        Number(row[3]) || 0,
        String(row[4] || ''),
        'Excel마이그레이션',
        now,
        'migrate',
      ];
    }).filter(row => row[1]); // 날짜가 있는 것만

    if (rows.length > 0) {
      await appendToSheet(sheets, spreadsheetId, '수입부', rows);
      incomeCount += rows.length;
      console.log(`수입부 진행: ${incomeCount}/${incomeRows.length}`);
    }
  }
  console.log(`수입부 완료: ${incomeCount}건`);

  console.log('\n=== 지출부 마이그레이션 시작 ===');
  const expenseSheet = workbook.Sheets['지출부'];
  const expenseData = XLSX.utils.sheet_to_json(expenseSheet, { header: 1 });
  const expenseRows = expenseData.slice(1).filter(row => row[1] && row[4]);

  let expenseCount = 0;
  for (let i = 0; i < expenseRows.length; i += BATCH_SIZE) {
    const batch = expenseRows.slice(i, i + BATCH_SIZE);
    const rows = batch.map(row => {
      const date = excelDateToString(row[1]);
      return [
        generateId('EXP'),
        date,
        String(row[2] || '계좌이체'),
        String(row[3] || ''),
        String(row[5] || ''),
        Number(row[4]) || 0,
        Number(row[6]) || 0,
        Number(row[8]) || 0,
        '',
        now,
        'migrate',
      ];
    }).filter(row => row[1]); // 날짜가 있는 것만

    if (rows.length > 0) {
      await appendToSheet(sheets, spreadsheetId, '지출부', rows);
      expenseCount += rows.length;
      console.log(`지출부 진행: ${expenseCount}/${expenseRows.length}`);
    }
  }
  console.log(`지출부 완료: ${expenseCount}건`);

  console.log('\n=== 마이그레이션 완료 ===');
  console.log(`수입부: ${incomeCount}건`);
  console.log(`지출부: ${expenseCount}건`);
}

main().catch(console.error);
