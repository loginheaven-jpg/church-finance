import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIncomeRecords, getIncomeCodes } from '@/lib/google-sheets';
import { FinanceSession, SESSION_COOKIE_NAME } from '@/lib/auth/finance-permissions';

export async function GET(request: NextRequest) {
  try {
    // 세션에서 사용자 정보 가져오기
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    let session: FinanceSession;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json(
        { error: '세션이 유효하지 않습니다' },
        { status: 401 }
      );
    }

    // URL 파라미터에서 연도 가져오기
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    // 해당 연도의 시작일과 종료일
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 수입 기록과 헌금 코드 조회
    const [incomeRecords, incomeCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getIncomeCodes(),
    ]);

    // 사용자 이름으로 필터링 (donor_name 또는 representative)
    const userName = session.name;
    const myOfferings = incomeRecords.filter(
      record => record.donor_name === userName || record.representative === userName
    );

    // 헌금 코드명 맵 생성
    const codeNameMap = new Map<number, string>();
    incomeCodes.forEach(incomeCode => {
      codeNameMap.set(incomeCode.code, incomeCode.item);
    });

    // 헌금 종류별 집계
    const summaryByType = new Map<number, { code: number; name: string; amount: number; count: number }>();
    myOfferings.forEach(record => {
      const existing = summaryByType.get(record.offering_code);
      if (existing) {
        existing.amount += record.amount;
        existing.count += 1;
      } else {
        summaryByType.set(record.offering_code, {
          code: record.offering_code,
          name: codeNameMap.get(record.offering_code) || `코드${record.offering_code}`,
          amount: record.amount,
          count: 1,
        });
      }
    });

    // 월별 집계
    const summaryByMonth = new Map<string, number>();
    myOfferings.forEach(record => {
      const month = record.date.substring(0, 7); // YYYY-MM
      summaryByMonth.set(month, (summaryByMonth.get(month) || 0) + record.amount);
    });

    // 월별 데이터 정렬 (1월~12월)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      return {
        month,
        monthLabel: `${i + 1}월`,
        amount: summaryByMonth.get(month) || 0,
      };
    });

    // 총계
    const totalAmount = myOfferings.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      year: parseInt(year),
      userName,
      totalAmount,
      totalCount: myOfferings.length,
      summaryByType: Array.from(summaryByType.values()).sort((a, b) => b.amount - a.amount),
      monthlyData,
      records: myOfferings.sort((a, b) => b.date.localeCompare(a.date)), // 최신순
    });
  } catch (error) {
    console.error('My offering API error:', error);
    return NextResponse.json(
      { error: '헌금 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
