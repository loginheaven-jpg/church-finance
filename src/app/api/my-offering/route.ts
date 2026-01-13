import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIncomeRecords, getIncomeCodes, getDonorInfo, getPledgeDonations } from '@/lib/google-sheets';
import { FinanceSession, SESSION_COOKIE_NAME } from '@/lib/auth/finance-permissions';

// 가족 그룹 멤버 조회
async function getFamilyGroup(userName: string): Promise<{
  representative: string;
  members: Array<{ name: string; isRepresentative: boolean }>;
}> {
  const donorInfos = await getDonorInfo();

  // 1. userName이 대표자인 경우 → 해당 대표자 아래 모든 헌금자
  const asRepresentative = donorInfos.filter(d => d.representative === userName);
  if (asRepresentative.length > 0) {
    const memberNames = new Set<string>();
    asRepresentative.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(userName); // 대표자도 포함

    return {
      representative: userName,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === userName,
      })),
    };
  }

  // 2. userName이 헌금자인 경우 → 같은 대표자 아래 모든 헌금자
  const asDoer = donorInfos.find(d => d.donor_name === userName);
  if (asDoer && asDoer.representative) {
    const rep = asDoer.representative;
    const sameFamilyDonors = donorInfos.filter(d => d.representative === rep);
    const memberNames = new Set<string>();
    sameFamilyDonors.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(rep); // 대표자도 포함

    return {
      representative: rep,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === rep,
      })),
    };
  }

  // 3. 헌금자정보에 없는 경우 → 본인만
  return {
    representative: userName,
    members: [{ name: userName, isRepresentative: true }],
  };
}

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

    // URL 파라미터
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const mode = searchParams.get('mode') || 'personal'; // 'personal' | 'family'
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const yearNum = parseInt(year);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 사용자 이름
    const userName = session.name;

    // 가족 그룹 조회
    const familyGroup = await getFamilyGroup(userName);

    // 헌금자 목록 결정 (본인명의 vs 가족전체)
    const targetNames = mode === 'family'
      ? familyGroup.members.map(m => m.name)
      : [userName];

    // 병렬로 데이터 조회
    const [incomeRecords, incomeCodes] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getIncomeCodes(),
    ]);

    // 필터링 (본인명의: donor_name === userName, 가족전체: donor_name in targetNames)
    const myOfferings = incomeRecords.filter(record =>
      targetNames.includes(record.donor_name)
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

    // === 전년도 월별 데이터 조회 ===
    const prevYear = yearNum - 1;
    const prevStartDate = `${prevYear}-01-01`;
    const prevEndDate = `${prevYear}-12-31`;
    const prevIncomeRecords = await getIncomeRecords(prevStartDate, prevEndDate);
    const prevOfferings = prevIncomeRecords.filter(record =>
      targetNames.includes(record.donor_name)
    );

    const prevSummaryByMonth = new Map<string, number>();
    prevOfferings.forEach(record => {
      const month = record.date.substring(0, 7);
      prevSummaryByMonth.set(month, (prevSummaryByMonth.get(month) || 0) + record.amount);
    });

    const previousYearMonthly = Array.from({ length: 12 }, (_, i) => {
      const month = `${prevYear}-${String(i + 1).padStart(2, '0')}`;
      return {
        month,
        monthLabel: `${i + 1}월`,
        amount: prevSummaryByMonth.get(month) || 0,
      };
    });

    // === 연도별 히스토리 (2003년~현재) ===
    let yearlyHistory: Array<{ year: number; totalAmount: number }> | undefined;
    if (includeHistory) {
      yearlyHistory = [];
      const currentYear = new Date().getFullYear();

      for (let y = 2003; y <= currentYear; y++) {
        const yStart = `${y}-01-01`;
        const yEnd = `${y}-12-31`;
        const yRecords = await getIncomeRecords(yStart, yEnd);
        const yOfferings = yRecords.filter(record =>
          targetNames.includes(record.donor_name)
        );
        const yTotal = yOfferings.reduce((sum, r) => sum + r.amount, 0);
        yearlyHistory.push({ year: y, totalAmount: yTotal });
      }
    }

    // === 작정헌금 현황 ===
    const pledgeDonations = await getPledgeDonations(yearNum);
    // 가족 구성원의 작정 조회 (donor_name 또는 representative가 가족 멤버에 포함)
    const familyPledges = pledgeDonations.filter(p =>
      targetNames.includes(p.donor_name) || targetNames.includes(p.representative)
    );

    // 건축헌금 집계 (type === '건축헌금')
    const buildingPledges = familyPledges.filter(p => p.type === '건축헌금');
    const buildingPledgeTotal = buildingPledges.reduce((sum, p) => sum + (p.pledged_amount || 0), 0);
    // 건축헌금 실제 납부액 (수입부에서 offering_code 500~599)
    const buildingOfferingCodes = Array.from({ length: 100 }, (_, i) => 500 + i);
    const buildingFulfilled = myOfferings
      .filter(r => buildingOfferingCodes.includes(r.offering_code))
      .reduce((sum, r) => sum + r.amount, 0);

    // 선교헌금 집계 (type === '선교헌금')
    const missionPledges = familyPledges.filter(p => p.type === '선교헌금');
    const missionPledgeTotal = missionPledges.reduce((sum, p) => sum + (p.pledged_amount || 0), 0);
    // 선교헌금 실제 납부액 (수입부에서 offering_code 30~39)
    const missionOfferingCodes = Array.from({ length: 10 }, (_, i) => 30 + i);
    const missionFulfilled = myOfferings
      .filter(r => missionOfferingCodes.includes(r.offering_code))
      .reduce((sum, r) => sum + r.amount, 0);

    const pledgeStatus = [
      {
        type: '건축헌금' as const,
        pledged_amount: buildingPledgeTotal,
        fulfilled_amount: buildingFulfilled,
        remaining: Math.max(0, buildingPledgeTotal - buildingFulfilled),
      },
      {
        type: '선교헌금' as const,
        pledged_amount: missionPledgeTotal,
        fulfilled_amount: missionFulfilled,
        remaining: Math.max(0, missionPledgeTotal - missionFulfilled),
      },
    ];

    return NextResponse.json({
      year: yearNum,
      userName,
      mode,
      totalAmount,
      totalCount: myOfferings.length,
      summaryByType: Array.from(summaryByType.values()).sort((a, b) => b.amount - a.amount),
      monthlyData,
      previousYearMonthly,
      records: myOfferings.sort((a, b) => b.date.localeCompare(a.date)),
      // 신규 필드
      familyGroup,
      yearlyHistory,
      pledgeStatus,
    });
  } catch (error) {
    console.error('My offering API error:', error);
    return NextResponse.json(
      { error: '헌금 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
