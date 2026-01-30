const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function analyzeSheet() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.FINANCE_SHEET_ID;

  // 건축원장 전체 읽기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '건축원장!A1:L30',
  });

  const rows = res.data.values || [];

  console.log('=== 건축원장 분석 ===\n');

  // 1. 합계 행 (Row 1-2) 분석
  console.log('【합계 행】');
  console.log(`J1 (대출잔액): ${rows[0]?.[9]}`);
  console.log(`K1 (상환원금 합계): ${rows[0]?.[10]}`);
  console.log(`L1 (이자지출 합계): ${rows[0]?.[11]}`);

  // 2. 연도별 데이터 분석 (F4~L17 추정)
  console.log('\n【연도별 데이터 검증】');

  let totalPrincipal = 0;  // K열 합계
  let totalInterest = 0;   // L열 합계
  let errors = [];

  // 헤더 찾기
  let dataStartRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[5] === '2012' || parseInt(rows[i]?.[5]) === 2012) {
      dataStartRow = i;
      break;
    }
  }

  if (dataStartRow === -1) {
    console.log('2012년 데이터 행을 찾을 수 없습니다.');
    return;
  }

  console.log(`\n데이터 시작 행: ${dataStartRow + 1}`);
  console.log('\n연도\t헌금(G)\t\t누적원금(H)\t누적이자(I)\t잔액(J)\t\t상환원금(K)\t이자지출(L)');
  console.log('─'.repeat(100));

  let prevCumulativePrincipal = 0;
  let prevCumulativeInterest = 0;
  let prevLoanBalance = 2100000000; // 초기 대출

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const year = parseInt(row[5]);
    if (!year || year < 2012 || year > 2025) break;

    const donation = parseInt(String(row[6] || '0').replace(/,/g, '')) || 0;
    const cumulativePrincipal = parseInt(String(row[7] || '0').replace(/,/g, '')) || 0;
    const cumulativeInterest = parseInt(String(row[8] || '0').replace(/,/g, '')) || 0;
    const loanBalance = parseInt(String(row[9] || '0').replace(/,/g, '')) || 0;
    const yearlyPrincipal = parseInt(String(row[10] || '0').replace(/,/g, '')) || 0;
    const yearlyInterest = parseInt(String(row[11] || '0').replace(/,/g, '')) || 0;

    totalPrincipal += yearlyPrincipal;
    totalInterest += yearlyInterest;

    console.log(`${year}\t${donation.toLocaleString().padStart(12)}\t${cumulativePrincipal.toLocaleString().padStart(12)}\t${cumulativeInterest.toLocaleString().padStart(12)}\t${loanBalance.toLocaleString().padStart(14)}\t${yearlyPrincipal.toLocaleString().padStart(12)}\t${yearlyInterest.toLocaleString().padStart(12)}`);

    // 검증 1: 누적원금 = 이전 누적원금 + 당년 상환원금
    const expectedCumulativePrincipal = prevCumulativePrincipal + yearlyPrincipal;
    if (cumulativePrincipal !== expectedCumulativePrincipal) {
      errors.push(`${year}년: 누적원금 불일치 (H열=${cumulativePrincipal.toLocaleString()}, 계산=${expectedCumulativePrincipal.toLocaleString()})`);
    }

    // 검증 2: 누적이자 = 이전 누적이자 + 당년 이자
    const expectedCumulativeInterest = prevCumulativeInterest + yearlyInterest;
    if (cumulativeInterest !== expectedCumulativeInterest) {
      errors.push(`${year}년: 누적이자 불일치 (I열=${cumulativeInterest.toLocaleString()}, 계산=${expectedCumulativeInterest.toLocaleString()})`);
    }

    // 검증 3: 대출잔액 = 이전 잔액 - 당년 원금상환
    const expectedLoanBalance = prevLoanBalance - yearlyPrincipal;
    if (loanBalance !== expectedLoanBalance) {
      errors.push(`${year}년: 대출잔액 불일치 (J열=${loanBalance.toLocaleString()}, 계산=${expectedLoanBalance.toLocaleString()})`);
    }

    prevCumulativePrincipal = cumulativePrincipal;
    prevCumulativeInterest = cumulativeInterest;
    prevLoanBalance = loanBalance;
  }

  console.log('─'.repeat(100));
  console.log(`합계\t\t\t\t\t\t\t\t\t\t\t${totalPrincipal.toLocaleString().padStart(12)}\t${totalInterest.toLocaleString().padStart(12)}`);

  // 검증 4: K1, L1 합계와 실제 합계 비교
  const k1 = parseInt(String(rows[0]?.[10] || '0').replace(/,/g, '')) || 0;
  const l1 = parseInt(String(rows[0]?.[11] || '0').replace(/,/g, '')) || 0;

  console.log(`\n【합계 검증】`);
  console.log(`K1 (상환원금 합계): ${k1.toLocaleString()} / 실제 합계: ${totalPrincipal.toLocaleString()} → ${k1 === totalPrincipal ? '✓ 일치' : '✗ 불일치'}`);
  console.log(`L1 (이자지출 합계): ${l1.toLocaleString()} / 실제 합계: ${totalInterest.toLocaleString()} → ${l1 === totalInterest ? '✓ 일치' : '✗ 불일치'}`);

  // 검증 5: 2025년 말 잔액과 J1 비교
  console.log(`J1 (마감 대출잔액): ${rows[0]?.[9]} / 2025년 잔액: ${prevLoanBalance.toLocaleString()}`);

  // 오류 보고
  console.log('\n【오류 목록】');
  if (errors.length === 0) {
    console.log('✓ 오류 없음');
  } else {
    errors.forEach(e => console.log(`✗ ${e}`));
  }
}

analyzeSheet();
