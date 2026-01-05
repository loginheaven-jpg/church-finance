const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '2025결산.xlsm');
const wb = XLSX.readFile(filePath);

console.log('=== 시트 목록 ===');
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    console.log(`- ${name}: ${range.e.r + 1}행 x ${range.e.c + 1}열`);
  } else {
    console.log(`- ${name}: 빈 시트`);
  }
});

// 수입부 미리보기
console.log('\n=== 수입부 상위 5행 ===');
const incomeSheet = wb.Sheets['수입부'];
if (incomeSheet) {
  const data = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 });
  data.slice(0, 5).forEach((row, i) => {
    console.log(`${i}: ${JSON.stringify(row.slice(0, 10))}`);
  });
}

// 지출부 미리보기
console.log('\n=== 지출부 상위 5행 ===');
const expenseSheet = wb.Sheets['지출부'];
if (expenseSheet) {
  const data = XLSX.utils.sheet_to_json(expenseSheet, { header: 1 });
  data.slice(0, 5).forEach((row, i) => {
    console.log(`${i}: ${JSON.stringify(row.slice(0, 10))}`);
  });
}
