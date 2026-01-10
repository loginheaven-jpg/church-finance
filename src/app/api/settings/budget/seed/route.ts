import { NextResponse } from 'next/server';
import { clearSheetData, appendToSheet } from '@/lib/google-sheets';

// 예산 데이터 (2019-2026년)
// CSV 데이터 기반: 예산2019-2026.csv
const BUDGET_DATA: {
  category_code: number;
  category_item: string;
  account_code: number;
  account_item: string;
  budgets: Record<number, number>;
  note: string;
}[] = [
  // 사례비 (10)
  { category_code: 10, category_item: '사례비', account_code: 11, account_item: '교역자사례',
    budgets: { 2019: 63600000, 2020: 67200000, 2021: 81980000, 2022: 95975760, 2023: 106720000, 2024: 106600000, 2025: 128200000, 2026: 140440000 },
    note: '사례비' },
  { category_code: 10, category_item: '사례비', account_code: 13, account_item: '기타수당',
    budgets: { 2019: 2500000, 2020: 5506080, 2021: 5300000, 2022: 5970000, 2023: 8200000, 2024: 9000000, 2025: 16100000, 2026: 13240000 },
    note: '사례비' },
  { category_code: 10, category_item: '사례비', account_code: 14, account_item: '중식대',
    budgets: { 2019: 700000, 2020: 0, 2021: 0, 2022: 500000, 2023: 500000, 2024: 3000000, 2025: 4500000, 2026: 6000000 },
    note: '사례비' },
  // 예배비 (20)
  { category_code: 20, category_item: '예배비', account_code: 21, account_item: '예배환경비',
    budgets: { 2019: 1000000, 2020: 1600000, 2021: 1000000, 2022: 1000000, 2023: 14000000, 2024: 30000000, 2025: 12000000, 2026: 12000000 },
    note: '예배부' },
  { category_code: 20, category_item: '예배비', account_code: 23, account_item: '찬양대',
    budgets: { 2019: 4300000, 2020: 4800000, 2021: 4800000, 2022: 15000000, 2023: 6200000, 2024: 6500000, 2025: 8000000, 2026: 8400000 },
    note: '예배부' },
  // 선교비 (30)
  { category_code: 30, category_item: '선교비', account_code: 31, account_item: '전도비',
    budgets: { 2019: 2200000, 2020: 4880000, 2021: 2400000, 2022: 4000000, 2023: 4000000, 2024: 2500000, 2025: 1000000, 2026: 1320000 },
    note: '선교부' },
  { category_code: 30, category_item: '선교비', account_code: 32, account_item: '선교보고비',
    budgets: { 2019: 2000000, 2020: 1600000, 2021: 1000000, 2022: 1000000, 2023: 1000000, 2024: 1700000, 2025: 1000000, 2026: 840000 },
    note: '선교부' },
  { category_code: 30, category_item: '선교비', account_code: 33, account_item: '선교후원비',
    budgets: { 2019: 13800000, 2020: 15600000, 2021: 24000000, 2022: 24600000, 2023: 39200000, 2024: 45400000, 2025: 30000000, 2026: 25400000 },
    note: '선교부' },
  // 교육비 (40)
  { category_code: 40, category_item: '교육비', account_code: 41, account_item: '교육훈련비',
    budgets: { 2019: 1500000, 2020: 3500000, 2021: 3500000, 2022: 1500000, 2023: 20000000, 2024: 26000000, 2025: 29000000, 2026: 4800000 },
    note: '공통' },
  { category_code: 40, category_item: '교육비', account_code: 42, account_item: '어린이부',
    budgets: { 2019: 3500000, 2020: 5000000, 2021: 2000000, 2022: 5000000, 2023: 7900000, 2024: 7500000, 2025: 9000000, 2026: 14400000 },
    note: '어린이부' },
  { category_code: 40, category_item: '교육비', account_code: 43, account_item: '청소년부',
    budgets: { 2019: 3500000, 2020: 3500000, 2021: 1500000, 2022: 3000000, 2023: 3980000, 2024: 5800000, 2025: 6800000, 2026: 7980000 },
    note: '청소년부' },
  { category_code: 40, category_item: '교육비', account_code: 44, account_item: '청년부',
    budgets: { 2019: 1000000, 2020: 2500000, 2021: 1000000, 2022: 6000000, 2023: 7110000, 2024: 7960000, 2025: 10000000, 2026: 11200000 },
    note: '청년부' },
  { category_code: 40, category_item: '교육비', account_code: 45, account_item: '가정교회부',
    budgets: { 2019: 1200000, 2020: 2000000, 2021: 5000000, 2022: 600000, 2023: 600000, 2024: 0, 2025: 0, 2026: 15855000 },
    note: '가정교회부' },
  { category_code: 40, category_item: '교육비', account_code: 46, account_item: '행사비',
    budgets: { 2019: 12000000, 2020: 18000000, 2021: 16000000, 2022: 20000000, 2023: 15000000, 2024: 4000000, 2025: 19000000, 2026: 18400000 },
    note: '공통, 행사부' },
  { category_code: 40, category_item: '교육비', account_code: 47, account_item: '친교비',
    budgets: { 2019: 6500000, 2020: 9000000, 2021: 7000000, 2022: 3000000, 2023: 16000000, 2024: 19000000, 2025: 15000000, 2026: 19200000 },
    note: '공통' },
  { category_code: 40, category_item: '교육비', account_code: 48, account_item: '도서비',
    budgets: { 2019: 3700000, 2020: 4000000, 2021: 4200000, 2022: 3700000, 2023: 5000000, 2024: 1700000, 2025: 4000000, 2026: 2160000 },
    note: '공통' },
  { category_code: 40, category_item: '교육비', account_code: 49, account_item: '장학금',
    budgets: { 2019: 15000000, 2020: 22000000, 2021: 16000000, 2022: 20000000, 2023: 20000000, 2024: 21000000, 2025: 30000000, 2026: 24000000 },
    note: '사례비' },
  // 봉사비 (50)
  { category_code: 50, category_item: '봉사비', account_code: 51, account_item: '경조비',
    budgets: { 2019: 1500000, 2020: 1500000, 2021: 1000000, 2022: 2000000, 2023: 2000000, 2024: 800000, 2025: 600000, 2026: 2160000 },
    note: '사랑봉사부' },
  { category_code: 50, category_item: '봉사비', account_code: 52, account_item: '구호비',
    budgets: { 2019: 2500000, 2020: 2000000, 2021: 5000000, 2022: 5000000, 2023: 5000000, 2024: 5000000, 2025: 500000, 2026: 3000000 },
    note: '사랑봉사부' },
  { category_code: 50, category_item: '봉사비', account_code: 53, account_item: '지역사회봉사비',
    budgets: { 2019: 4000000, 2020: 2000000, 2021: 1000000, 2022: 2000000, 2023: 650000, 2024: 1000000, 2025: 1000000, 2026: 2400000 },
    note: '사랑봉사부' },
  // 관리비 (60)
  { category_code: 60, category_item: '관리비', account_code: 61, account_item: '사택관리비',
    budgets: { 2019: 8000000, 2020: 7678430, 2021: 8000000, 2022: 10800000, 2023: 11000000, 2024: 11000000, 2025: 9000000, 2026: 9240000 },
    note: '사례비' },
  { category_code: 60, category_item: '관리비', account_code: 62, account_item: '수도광열비',
    budgets: { 2019: 15000000, 2020: 19740000, 2021: 21000000, 2022: 15100000, 2023: 21000000, 2024: 24000000, 2025: 20000000, 2026: 25200000 },
    note: '공통' },
  { category_code: 60, category_item: '관리비', account_code: 63, account_item: '공과금',
    budgets: { 2019: 1800000, 2020: 1947400, 2021: 3000000, 2022: 2500000, 2023: 2500000, 2024: 1900000, 2025: 2000000, 2026: 2760000 },
    note: '공통' },
  { category_code: 60, category_item: '관리비', account_code: 64, account_item: '관리대행비',
    budgets: { 2019: 7200000, 2020: 5514000, 2021: 5500000, 2022: 7700000, 2023: 7000000, 2024: 6600000, 2025: 6100000, 2026: 6000000 },
    note: '공통' },
  { category_code: 60, category_item: '관리비', account_code: 65, account_item: '차량유지비',
    budgets: { 2019: 3500000, 2020: 7511425, 2021: 29000000, 2022: 10000000, 2023: 7000000, 2024: 8400000, 2025: 11000000, 2026: 8400000 },
    note: '공통' },
  { category_code: 60, category_item: '관리비', account_code: 66, account_item: '수선유지비',
    budgets: { 2019: 24000000, 2020: 20000000, 2021: 40000000, 2022: 50000000, 2023: 50000000, 2024: 24000000, 2025: 20000000, 2026: 10800000 },
    note: '공통, 시설관리부' },
  // 운영비 (70)
  { category_code: 70, category_item: '운영비', account_code: 71, account_item: '통신비',
    budgets: { 2019: 800000, 2020: 942560, 2021: 700000, 2022: 700000, 2023: 800000, 2024: 720000, 2025: 2200000, 2026: 2400000 },
    note: '공통, 사례비' },
  { category_code: 70, category_item: '운영비', account_code: 72, account_item: '도서인쇄비',
    budgets: { 2019: 1000000, 2020: 366000, 2021: 750000, 2022: 1000000, 2023: 1600000, 2024: 360000, 2025: 500000, 2026: 1040000 },
    note: '공통, 행사부' },
  { category_code: 70, category_item: '운영비', account_code: 74, account_item: '사무비',
    budgets: { 2019: 700000, 2020: 377670, 2021: 700000, 2022: 600000, 2023: 3000000, 2024: 3000000, 2025: 3000000, 2026: 6000000 },
    note: '공통' },
  { category_code: 70, category_item: '운영비', account_code: 75, account_item: '잡비',
    budgets: { 2019: 200000, 2020: 38400, 2021: 200000, 2022: 800000, 2023: 500000, 2024: 400000, 2025: 1000000, 2026: 120000 },
    note: '공통' },
  // 상회비 (80)
  { category_code: 80, category_item: '상회비', account_code: 81, account_item: '상회비',
    budgets: { 2019: 3800000, 2020: 3570000, 2021: 3570000, 2022: 5000000, 2023: 6000000, 2024: 5500000, 2025: 6500000, 2026: 6000000 },
    note: '공통' },
  // 기타비용 (90)
  { category_code: 90, category_item: '기타비용', account_code: 91, account_item: '목회활동비',
    budgets: { 2019: 3700000, 2020: 3600000, 2021: 4200000, 2022: 5800000, 2023: 12000000, 2024: 13900000, 2025: 10000000, 2026: 8400000 },
    note: '사례비' },
  { category_code: 90, category_item: '기타비용', account_code: 94, account_item: '소득세',
    budgets: { 2019: 0, 2020: 100000, 2021: 100000, 2022: 50000, 2023: 50000, 2024: 50000, 2025: 20000, 2026: 50000 },
    note: '공통' },
  // 건축비 (500)
  { category_code: 500, category_item: '건축비', account_code: 501, account_item: '지급이자',
    budgets: { 2019: 74400000, 2020: 70000000, 2021: 53000000, 2022: 43200000, 2023: 80000000, 2024: 75000000, 2025: 71342488, 2026: 62400000 },
    note: '공통' },
  { category_code: 500, category_item: '건축비', account_code: 502, account_item: '원금상환',
    budgets: { 2019: 60000000, 2020: 90000000, 2021: 100000000, 2022: 0, 2023: 50000000, 2024: 50000000, 2025: 50000000, 2026: 50000000 },
    note: '공통' },
];

// POST: 예산 데이터 일괄 입력 (2019-2026년)
export async function POST() {
  try {
    // 1. 기존 예산 데이터 삭제
    await clearSheetData('예산');

    // 2. 모든 연도/항목 데이터 생성
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const rows: (string | number)[][] = [];

    for (const item of BUDGET_DATA) {
      for (const year of years) {
        const amount = item.budgets[year] || 0;
        if (amount > 0) {  // 0인 항목은 제외
          rows.push([
            year,
            item.category_code,
            item.category_item,
            item.account_code,
            item.account_item,
            amount,
            item.note,
          ]);
        }
      }
    }

    // 3. 일괄 입력
    await appendToSheet('예산', rows);

    // 4. 결과 반환
    return NextResponse.json({
      success: true,
      message: `${rows.length}개의 예산 항목이 입력되었습니다 (2019-2026년)`,
      count: rows.length,
      years: years,
    });
  } catch (error) {
    console.error('Budget seed error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET: 현재 예산 데이터 현황 조회
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST 요청으로 2019-2026년 예산 데이터를 입력할 수 있습니다',
    available_years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    categories: BUDGET_DATA.map(d => ({
      code: d.account_code,
      item: d.account_item,
      category: d.category_item,
    })),
  });
}
