const XLSX = require('xlsx');
const path = require('path');

console.log('='.repeat(60));
console.log('원장 데이터 분석 리포트');
console.log('='.repeat(60));

// 수입부 분석
console.log('\n### 수입부 분석 ###\n');
const incomePath = path.join(__dirname, '../../saint-record-v2/수입부_2003_2017_원장.xlsx');
const incomeWb = XLSX.readFile(incomePath);
const incomeSheetName = incomeWb.SheetNames[0];
const incomeSheet = incomeWb.Sheets[incomeSheetName];
const incomeData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 });

console.log(`파일: ${incomePath}`);
console.log(`시트명: ${incomeSheetName}`);
console.log(`총 행 수: ${incomeData.length} (헤더 포함)`);
console.log(`총 레코드 수: ${incomeData.length - 1}`);
console.log(`\n컬럼 구조:\n`, incomeData[0]);

// 샘플 데이터 (첫 3개 레코드)
console.log('\n샘플 데이터 (첫 3개):');
incomeData.slice(1, 4).forEach((row, i) => {
  console.log(`  ${i + 1}:`, row);
});

// 연도별 집계
const incomeByYear = {};
let incomeTotal = 0;
incomeData.slice(1).forEach(row => {
  const year = row[6]; // 연도 컬럼 (인덱스는 실제 구조에 따라 조정 필요)
  const amount = row[5] || 0; // 금액 컬럼
  if (year && row[0]) { // 날짜와 연도가 있는 행만
    incomeByYear[year] = (incomeByYear[year] || 0) + 1;
    incomeTotal += Number(amount);
  }
});

console.log('\n연도별 레코드 수:');
Object.keys(incomeByYear).sort().forEach(year => {
  console.log(`  ${year}: ${incomeByYear[year]}건`);
});
console.log(`\n총 금액 합계: ${incomeTotal.toLocaleString()}원`);

// 지출부 분석
console.log('\n' + '='.repeat(60));
console.log('### 지출부 분석 ###\n');
const expensePath = path.join(__dirname, '../../saint-record-v2/지출부_2003_2017_원장.xlsx');
const expenseWb = XLSX.readFile(expensePath);
const expenseSheetName = expenseWb.SheetNames[0];
const expenseSheet = expenseWb.Sheets[expenseSheetName];
const expenseData = XLSX.utils.sheet_to_json(expenseSheet, { header: 1 });

console.log(`파일: ${expensePath}`);
console.log(`시트명: ${expenseSheetName}`);
console.log(`총 행 수: ${expenseData.length} (헤더 포함)`);
console.log(`총 레코드 수: ${expenseData.length - 1}`);
console.log(`\n컬럼 구조:\n`, expenseData[0]);

// 샘플 데이터 (첫 3개 레코드)
console.log('\n샘플 데이터 (첫 3개):');
expenseData.slice(1, 4).forEach((row, i) => {
  console.log(`  ${i + 1}:`, row);
});

// 연도별 집계
const expenseByYear = {};
let expenseTotal = 0;
expenseData.slice(1).forEach(row => {
  const year = row[7]; // 연도 컬럼 (인덱스는 실제 구조에 따라 조정 필요)
  const amount = row[5] || 0; // 금액 컬럼
  if (year && row[0]) { // 날짜와 연도가 있는 행만
    expenseByYear[year] = (expenseByYear[year] || 0) + 1;
    expenseTotal += Number(amount);
  }
});

console.log('\n연도별 레코드 수:');
Object.keys(expenseByYear).sort().forEach(year => {
  console.log(`  ${year}: ${expenseByYear[year]}건`);
});
console.log(`\n총 금액 합계: ${expenseTotal.toLocaleString()}원`);

// 요약
console.log('\n' + '='.repeat(60));
console.log('### 요약 ###\n');
console.log(`수입부: ${incomeData.length - 1}건, ${incomeTotal.toLocaleString()}원`);
console.log(`지출부: ${expenseData.length - 1}건, ${expenseTotal.toLocaleString()}원`);
console.log('='.repeat(60));
