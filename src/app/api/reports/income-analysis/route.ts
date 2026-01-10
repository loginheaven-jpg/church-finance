import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getIncomeCodes } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year')) || new Date().getFullYear();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [incomeRecords, incomeCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getIncomeCodes(),
    ]);

    // 코드 맵 생성: code -> { category_item, item }
    const codeMap = new Map<number, { category: string; item: string }>();
    incomeCodes.forEach(c => {
      codeMap.set(c.code, { category: c.category_item, item: c.item });
    });

    // 특수 카테고리 코드 fallback (코드 범위별)
    const getCategoryName = (code: number): string => {
      const codeInfo = codeMap.get(code);
      if (codeInfo?.category) return codeInfo.category;
      // 코드 범위별 기본값
      if (code >= 500) return '건축헌금';
      if (code >= 40 && code < 50) return '자본수입';
      if (code >= 30 && code < 40) return '목적헌금';
      if (code >= 20 && code < 30) return '잡수입';
      if (code >= 10 && code < 20) return '일반헌금';
      return '기타수입';
    };

    // 카테고리별 집계 (category_item 기준: 일반헌금, 목적헌금, 잡수입, 자본수입, 건축헌금)
    const byCategory = new Map<string, { name: string; amount: number; count: number }>();
    // 항목별 집계
    const byCode = new Map<number, { name: string; category: string; amount: number; count: number }>();
    // 월별 집계
    const byMonth = Array(12).fill(null).map(() => ({ income: 0, count: 0 }));
    // 경로별 집계 (헌금함, 계좌이체 등)
    const bySource = new Map<string, { amount: number; count: number }>();

    incomeRecords.forEach(r => {
      const code = r.offering_code;
      const codeInfo = codeMap.get(code);
      const categoryName = getCategoryName(code);
      const month = new Date(r.date).getMonth();

      // 카테고리별 (category_item 기준)
      if (!byCategory.has(categoryName)) {
        byCategory.set(categoryName, {
          name: categoryName,
          amount: 0,
          count: 0,
        });
      }
      const cat = byCategory.get(categoryName)!;
      cat.amount += r.amount;
      cat.count += 1;

      // 항목별
      if (!byCode.has(code)) {
        byCode.set(code, {
          name: codeInfo?.item || `기타`,
          category: categoryName,
          amount: 0,
          count: 0,
        });
      }
      const item = byCode.get(code)!;
      item.amount += r.amount;
      item.count += 1;

      // 월별
      byMonth[month].income += r.amount;
      byMonth[month].count += 1;

      // 경로별
      const source = r.source || '기타';
      if (!bySource.has(source)) {
        bySource.set(source, { amount: 0, count: 0 });
      }
      const src = bySource.get(source)!;
      src.amount += r.amount;
      src.count += 1;
    });

    // 총 합계
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalCount = incomeRecords.length;

    // 상위 헌금자
    const donorMap = new Map<string, { representative: string; amount: number; count: number }>();
    incomeRecords.forEach(r => {
      const key = r.representative || r.donor_name;
      if (!donorMap.has(key)) {
        donorMap.set(key, { representative: key, amount: 0, count: 0 });
      }
      const donor = donorMap.get(key)!;
      donor.amount += r.amount;
      donor.count += 1;
    });

    const topDonors = Array.from(donorMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: {
        year,
        summary: {
          totalIncome,
          totalCount,
          averagePerTransaction: totalCount > 0 ? Math.round(totalIncome / totalCount) : 0,
        },
        byCategory: Array.from(byCategory.values())
          .sort((a, b) => b.amount - a.amount),
        byCode: Array.from(byCode.entries())
          .map(([code, data]) => ({ code, ...data }))
          .sort((a, b) => b.amount - a.amount),
        byMonth: byMonth.map((data, idx) => ({
          month: idx + 1,
          ...data,
        })),
        bySource: Array.from(bySource.entries())
          .map(([source, data]) => ({ source, ...data }))
          .sort((a, b) => b.amount - a.amount),
        topDonors,
      },
    });
  } catch (error) {
    console.error('Income analysis error:', error);
    return NextResponse.json(
      { success: false, error: '수입 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
