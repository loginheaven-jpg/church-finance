/**
 * 건축원장 시트 구조 업데이트
 * F-G열(연도, 헌금)에 H-J열(누적원금, 누적이자, 잔액) 추가
 */
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// 기존 yearlyProgressData (2012~2025)
const yearlyProgressData = {
  2012: { principalPaid: 0, interestPaid: 660000000, loanBalance: 2100000000 },
  2013: { principalPaid: 0, interestPaid: 744000000, loanBalance: 2100000000 },
  2014: { principalPaid: 100000000, interestPaid: 820000000, loanBalance: 2000000000 },
  2015: { principalPaid: 200000000, interestPaid: 890000000, loanBalance: 1900000000 },
  2016: { principalPaid: 300000000, interestPaid: 950000000, loanBalance: 1800000000 },
  2017: { principalPaid: 350000000, interestPaid: 1005000000, loanBalance: 1750000000 },
  2018: { principalPaid: 400000000, interestPaid: 1055000000, loanBalance: 1700000000 },
  2019: { principalPaid: 500000000, interestPaid: 1100000000, loanBalance: 1600000000 },
  2020: { principalPaid: 560000000, interestPaid: 1143000000, loanBalance: 1540000000 },
  2021: { principalPaid: 640000000, interestPaid: 1203000000, loanBalance: 1460000000 },
  2022: { principalPaid: 690000000, interestPaid: 1258000000, loanBalance: 1410000000 },
  2023: { principalPaid: 740000000, interestPaid: 1313000000, loanBalance: 1360000000 },
  2024: { principalPaid: 780000000, interestPaid: 1363000000, loanBalance: 1320000000 },
  2025: { principalPaid: 800000000, interestPaid: 1026764421, loanBalance: 1300000000 },
};

async function updateBuildingSheet() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.FINANCE_SHEET_ID;
  const sheetName = '건축원장';

  try {
    // 1. 현재 F-G열 데이터 읽기
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!F3:G20`,
    });

    const currentData = readRes.data.values || [];
    console.log('현재 F-G열 데이터:');
    currentData.forEach((row, i) => console.log(`  Row ${i+3}: ${row.join(', ')}`));

    // 2. H3에 헤더 추가, H4부터 데이터 추가
    const headerRow = ['누적원금', '누적이자', '대출잔액'];

    // 연도별 데이터 매핑
    const updateData = [headerRow]; // H3: 헤더

    for (let i = 0; i < currentData.length; i++) {
      const yearStr = currentData[i]?.[0];
      const year = parseInt(yearStr);

      if (year && yearlyProgressData[year]) {
        const p = yearlyProgressData[year];
        updateData.push([p.principalPaid, p.interestPaid, p.loanBalance]);
      } else if (yearStr === '연도' || yearStr === '') {
        // 헤더 행이거나 빈 행
        updateData.push(['', '', '']);
      } else {
        updateData.push(['', '', '']);
      }
    }

    console.log('\n업데이트할 H-J열 데이터:');
    updateData.forEach((row, i) => console.log(`  Row ${i+3}: ${row.join(', ')}`));

    // 3. H열에 데이터 쓰기
    const updateRes = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!H3:J${3 + updateData.length - 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: updateData,
      },
    });

    console.log('\n업데이트 완료:', updateRes.data.updatedCells, '셀');

  } catch (error) {
    console.error('에러:', error.message);
  }
}

updateBuildingSheet();
