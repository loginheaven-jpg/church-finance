const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkCurrentYear() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.FINANCE_SHEET_ID;

  // 건축원장 F-L열 전체 읽기 (값)
  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '건축원장!F1:L20',
  });

  // 수식 읽기 (F18:L18 - 2026년 행 추정)
  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '건축원장!F4:L20',
    valueRenderOption: 'FORMULA',
  });

  console.log('=== 건축원장 현재 상태 ===\n');

  const values = valuesRes.data.values || [];
  console.log('【값 (F-L열)】');
  values.forEach((row, i) => {
    const rowNum = i + 1;
    console.log(`Row ${rowNum}: ${row.join('\t')}`);
  });

  console.log('\n【수식 (F4~ 행)】');
  const formulas = formulaRes.data.values || [];
  formulas.forEach((row, i) => {
    const rowNum = i + 4;
    const hasFormula = row.some(cell => cell && String(cell).startsWith('='));
    if (hasFormula) {
      console.log(`Row ${rowNum}: ${row.join('\t')}`);
    }
  });

  // 2026년 행 찾기
  console.log('\n【2026년 데이터 확인】');
  for (let i = 0; i < values.length; i++) {
    if (values[i]?.[0] === '2026' || values[i]?.[0] === 2026) {
      console.log(`Row ${i+1}에서 2026년 발견:`);
      console.log(`  F(연도): ${values[i][0]}`);
      console.log(`  G(헌금): ${values[i][1]}`);
      console.log(`  H(누적원금): ${values[i][2]}`);
      console.log(`  I(누적이자): ${values[i][3]}`);
      console.log(`  J(잔액): ${values[i][4]}`);
      console.log(`  K(연간원금): ${values[i][5]}`);
      console.log(`  L(연간이자): ${values[i][6]}`);

      // 수식 확인
      const formulaRow = formulas[i - 3]; // F4부터 시작이므로 offset
      if (formulaRow) {
        console.log('\n  수식:');
        ['F','G','H','I','J','K','L'].forEach((col, j) => {
          const cell = formulaRow[j];
          if (cell && String(cell).startsWith('=')) {
            console.log(`    ${col}: ${cell}`);
          }
        });
      }
    }
  }
}

checkCurrentYear();
