import { NextRequest, NextResponse } from 'next/server';
import { getExpenseRecords } from '@/lib/google-sheets';

// GET: 지출 내역 조회 (계정과목별 필터링)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get('accountCode');
    const categoryCode = searchParams.get('categoryCode');
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 지출 데이터 조회
    let records = await getExpenseRecords(startDate, endDate);

    // 계정과목 코드로 필터링
    if (accountCode) {
      const code = Number(accountCode);
      records = records.filter(r => r.account_code === code);
    }

    // 카테고리 코드로 필터링 (소계 클릭 시)
    if (categoryCode) {
      const catCode = Number(categoryCode);
      records = records.filter(r => r.category_code === catCode);
    }

    // 날짜순 정렬 (최신순)
    records.sort((a, b) => b.date.localeCompare(a.date));

    // 합계 계산
    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary: {
          count: records.length,
          totalAmount,
          year: Number(year),
          accountCode: accountCode ? Number(accountCode) : null,
          categoryCode: categoryCode ? Number(categoryCode) : null,
        },
      },
    });
  } catch (error) {
    console.error('Expense records fetch error:', error);
    return NextResponse.json(
      { success: false, error: '지출 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
