/**
 * 지출부에서 연도별 원금상환(502), 이자지출(501) 조회
 */
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function queryExpenseHistory() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.FINANCE_SHEET_ID;

  try {
    // 지출부 데이터 읽기
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '지출부!A:H',
    });

    const rows = res.data.values || [];
    console.log('지출부 총 행 수:', rows.length);

    // 연도별 집계
    const yearlyData = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateStr = row[1]; // B열: 날짜
      const accountCode = parseInt(row[6]); // G열: 계정코드
      const amount = parseInt(String(row[5] || '0').replace(/,/g, '')); // F열: 금액

      if (!dateStr || isNaN(amount)) continue;

      // 연도 추출
      const year = parseInt(dateStr.substring(0, 4));
      if (year < 2012 || year > 2025) continue;

      // 501(이자) 또는 502(원금)만 집계
      if (accountCode !== 501 && accountCode !== 502) continue;

      if (!yearlyData[year]) {
        yearlyData[year] = { interest: 0, principal: 0 };
      }

      if (accountCode === 501) {
        yearlyData[year].interest += amount;
      } else if (accountCode === 502) {
        yearlyData[year].principal += amount;
      }
    }

    // 결과 출력
    console.log('\n=== 연도별 원금상환(502) / 이자지출(501) ===\n');
    console.log('연도\t원금상환(502)\t이자지출(501)');
    console.log('----\t------------\t------------');

    const years = Object.keys(yearlyData).sort();
    for (const year of years) {
      const d = yearlyData[year];
      console.log(`${year}\t${d.principal.toLocaleString()}\t${d.interest.toLocaleString()}`);
    }

    // 시트에 K-L열 업데이트
    console.log('\n건축원장 K-L열에 데이터 입력 중...');

    // F4~F17 연도 읽기
    const fRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '건축원장!F4:F20',
    });
    const fYears = fRes.data.values || [];

    // K-L열 데이터 준비
    const klData = [];
    for (let i = 0; i < fYears.length; i++) {
      const year = parseInt(fYears[i]?.[0]);
      if (year && yearlyData[year]) {
        klData.push([yearlyData[year].principal, yearlyData[year].interest]);
      } else {
        klData.push(['', '']);
      }
    }

    // K4부터 쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `건축원장!K4:L${4 + klData.length - 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: klData },
    });

    console.log('K-L열 업데이트 완료!');

  } catch (error) {
    console.error('에러:', error.message);
  }
}

queryExpenseHistory();
