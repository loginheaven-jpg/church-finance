import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords } from '@/lib/google-sheets';
import { getServerSession, hasRole } from '@/lib/auth/finance-permissions';

// GET: 수입부 레코드 검색
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const donorName = searchParams.get('donorName') || '';
    const minAmount = searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : null;
    const maxAmount = searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : null;

    let records = await getIncomeRecords(startDate, endDate);

    // 헌금자명 필터
    if (donorName) {
      records = records.filter(r =>
        r.donor_name?.includes(donorName) || r.representative?.includes(donorName)
      );
    }

    // 금액 범위 필터
    if (minAmount !== null) {
      records = records.filter(r => (r.amount || 0) >= minAmount);
    }
    if (maxAmount !== null) {
      records = records.filter(r => (r.amount || 0) <= maxAmount);
    }

    // 날짜순 정렬 (최신순)
    records.sort((a, b) => b.date.localeCompare(a.date));

    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary: {
          count: records.length,
          totalAmount,
        },
      },
    });
  } catch (error) {
    console.error('Income records search error:', error);
    return NextResponse.json(
      { success: false, error: '수입부 검색 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
