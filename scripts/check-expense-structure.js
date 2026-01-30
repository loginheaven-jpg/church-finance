const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkStructure() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.FINANCE_SHEET_ID;

  // 지출부 헤더 및 샘플 데이터
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '지출부!A1:L5',
  });

  console.log('지출부 구조:');
  res.data.values?.forEach((row, i) => {
    console.log(`Row ${i+1}:`, row.map((v, j) => `${String.fromCharCode(65+j)}=${v}`).join(', '));
  });

  // 501, 502 코드가 있는 행 찾기
  const allRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '지출부!A:L',
  });

  const rows = allRes.data.values || [];
  console.log('\n501/502 코드 샘플:');
  let count = 0;
  for (let i = 1; i < rows.length && count < 5; i++) {
    const row = rows[i];
    // 각 열에서 501 또는 502 찾기
    for (let j = 0; j < row.length; j++) {
      if (row[j] === '501' || row[j] === '502' || row[j] === 501 || row[j] === 502) {
        console.log(`Row ${i+1}, Col ${String.fromCharCode(65+j)}: ${row.join(' | ')}`);
        count++;
        break;
      }
    }
  }
}

checkStructure();
