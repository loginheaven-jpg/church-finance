// google-sheets.ts의 내부 함수를 직접 사용
async function getAllIncomeRecords() {
  const { getIncomeRecords } = await import('../src/lib/google-sheets.js');
  return await getIncomeRecords();
}

async function getAllExpenseRecords() {
  const { getExpenseRecords } = await import('../src/lib/google-sheets.js');
  return await getExpenseRecords();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Google Sheets 중복 분석 리포트');
  console.log('='.repeat(60));

  // 수입부 데이터 조회
  console.log('\n### 수입부 (Google Sheets) ###\n');
  console.log('데이터 조회 중... (시간이 걸릴 수 있습니다)');
  const allIncomeRecords = await getAllIncomeRecords();
  console.log(`총 레코드 수: ${allIncomeRecords.length}`);

  // 2003-2017 범위 필터링
  const income2003_2017 = allIncomeRecords.filter(record => {
    const date = record.date;
    if (!date) return false;
    const year = new Date(date).getFullYear();
    return year >= 2003 && year <= 2017;
  });

  console.log(`2003-2017 범위: ${income2003_2017.length}건`);

  // 연도별 집계
  const incomeByYear: Record<number, number> = {};
  let incomeTotalAmount = 0;
  income2003_2017.forEach(record => {
    const year = new Date(record.date).getFullYear();
    incomeByYear[year] = (incomeByYear[year] || 0) + 1;
    incomeTotalAmount += record.amount;
  });

  console.log('\n연도별 레코드 수:');
  Object.keys(incomeByYear).sort().forEach(year => {
    console.log(`  ${year}: ${incomeByYear[Number(year)]}건`);
  });
  console.log(`\n총 금액 합계: ${incomeTotalAmount.toLocaleString()}원`);

  // 중복 감지: date + donor_name + amount 기준
  const incomeDuplicates: Record<string, number> = {};
  income2003_2017.forEach(record => {
    const key = `${record.date}|${record.donor_name}|${record.amount}`;
    incomeDuplicates[key] = (incomeDuplicates[key] || 0) + 1;
  });

  const incomeDupes = Object.entries(incomeDuplicates).filter(([k, v]) => v > 1);
  console.log(`\n중복된 고유 키: ${incomeDupes.length}개`);

  const incomeDupeCount = incomeDupes.reduce((sum, [k, v]) => sum + v, 0);
  const incomeExtraRecords = incomeDupeCount - incomeDupes.length;
  console.log(`중복으로 인한 초과 레코드: ${incomeExtraRecords}건`);

  if (incomeDupes.length > 0) {
    console.log('\n중복 샘플 (상위 10개):');
    incomeDupes.slice(0, 10).forEach(([key, count]) => {
      const [date, donor, amount] = key.split('|');
      console.log(`  ${date} | ${donor} | ${Number(amount).toLocaleString()}원 → ${count}회 중복`);
    });
  }

  // 지출부 데이터 조회
  console.log('\n' + '='.repeat(60));
  console.log('### 지출부 (Google Sheets) ###\n');
  console.log('데이터 조회 중... (시간이 걸릴 수 있습니다)');
  const allExpenseRecords = await getAllExpenseRecords();
  console.log(`총 레코드 수: ${allExpenseRecords.length}`);

  // 2003-2017 범위 필터링
  const expense2003_2017 = allExpenseRecords.filter(record => {
    const date = record.date;
    if (!date) return false;
    const year = new Date(date).getFullYear();
    return year >= 2003 && year <= 2017;
  });

  console.log(`2003-2017 범위: ${expense2003_2017.length}건`);

  // 연도별 집계
  const expenseByYear: Record<number, number> = {};
  let expenseTotalAmount = 0;
  expense2003_2017.forEach(record => {
    const year = new Date(record.date).getFullYear();
    expenseByYear[year] = (expenseByYear[year] || 0) + 1;
    expenseTotalAmount += record.amount;
  });

  console.log('\n연도별 레코드 수:');
  Object.keys(expenseByYear).sort().forEach(year => {
    console.log(`  ${year}: ${expenseByYear[Number(year)]}건`);
  });
  console.log(`\n총 금액 합계: ${expenseTotalAmount.toLocaleString()}원`);

  // 중복 감지: date + vendor + amount 기준
  const expenseDuplicates: Record<string, number> = {};
  expense2003_2017.forEach(record => {
    const key = `${record.date}|${record.vendor}|${record.amount}`;
    expenseDuplicates[key] = (expenseDuplicates[key] || 0) + 1;
  });

  const expenseDupes = Object.entries(expenseDuplicates).filter(([k, v]) => v > 1);
  console.log(`\n중복된 고유 키: ${expenseDupes.length}개`);

  const expenseDupeCount = expenseDupes.reduce((sum, [k, v]) => sum + v, 0);
  const expenseExtraRecords = expenseDupeCount - expenseDupes.length;
  console.log(`중복으로 인한 초과 레코드: ${expenseExtraRecords}건`);

  if (expenseDupes.length > 0) {
    console.log('\n중복 샘플 (상위 10개):');
    expenseDupes.slice(0, 10).forEach(([key, count]) => {
      const [date, vendor, amount] = key.split('|');
      console.log(`  ${date} | ${vendor} | ${Number(amount).toLocaleString()}원 → ${count}회 중복`);
    });
  }

  // 비교 요약
  console.log('\n' + '='.repeat(60));
  console.log('### 원본 Excel vs Google Sheets 비교 ###\n');
  console.log('수입부:');
  console.log(`  원본 Excel: 28,334건, 8,996,367,775원`);
  console.log(`  Google Sheets: ${income2003_2017.length}건, ${incomeTotalAmount.toLocaleString()}원`);
  console.log(`  차이: ${income2003_2017.length - 28334}건 (${((income2003_2017.length / 28334) * 100).toFixed(1)}%)`);
  console.log(`  중복 제거 후 예상: ${income2003_2017.length - incomeExtraRecords}건`);

  console.log('\n지출부:');
  console.log(`  원본 Excel: 10,839건, 8,026,775,045원`);
  console.log(`  Google Sheets: ${expense2003_2017.length}건, ${expenseTotalAmount.toLocaleString()}원`);
  console.log(`  차이: ${expense2003_2017.length - 10839}건 (${((expense2003_2017.length / 10839) * 100).toFixed(1)}%)`);
  console.log(`  중복 제거 후 예상: ${expense2003_2017.length - expenseExtraRecords}건`);

  console.log('\n='.repeat(60));
}

main().catch(console.error);
