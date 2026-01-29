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

  console.log(`[getFamilyGroup] userName: ${userName}`);
  console.log(`[getFamilyGroup] 헌금자정보 총 ${donorInfos.length}건`);
  // 첫 번째 레코드의 모든 필드 출력 (헤더 확인용)
  if (donorInfos.length > 0) {
    console.log(`[getFamilyGroup] 첫 번째 레코드 필드들:`, Object.keys(donorInfos[0]));
    console.log(`[getFamilyGroup] 첫 번째 레코드 값:`, JSON.stringify(donorInfos[0]));
    // 최철영 검색
    const matchingRecords = donorInfos.filter(d =>
      String(d.representative || '').includes('최철영') ||
      String(d.donor_name || '').includes('최철영') ||
      JSON.stringify(d).includes('최철영')
    );
    console.log(`[getFamilyGroup] 최철영 포함 레코드: ${matchingRecords.length}건`);
    if (matchingRecords.length > 0) {
      matchingRecords.forEach((r, i) => console.log(`[getFamilyGroup] 매칭${i+1}:`, JSON.stringify(r)));
    }
  }

  // 1. userName이 대표자인 경우 → 해당 대표자 아래 모든 헌금자
  const asRepresentative = donorInfos.filter(d => d.representative === userName);
  console.log(`[getFamilyGroup] asRepresentative(대표자=${userName}): ${asRepresentative.length}건`);
  if (asRepresentative.length > 0) {
    const memberNames = new Set<string>();
    asRepresentative.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(userName); // 대표자도 포함

    const result = {
      representative: userName,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === userName,
      })),
    };
    console.log(`[getFamilyGroup] 케이스1 결과:`, JSON.stringify(result));
    return result;
  }

  // 2. userName이 헌금자인 경우 → 같은 대표자 아래 모든 헌금자
  const asDoer = donorInfos.find(d => d.donor_name === userName);
  console.log(`[getFamilyGroup] asDoer(헌금자=${userName}): ${asDoer ? `대표자=${asDoer.representative}` : '없음'}`);
  if (asDoer && asDoer.representative) {
    const rep = asDoer.representative;
    const sameFamilyDonors = donorInfos.filter(d => d.representative === rep);
    console.log(`[getFamilyGroup] 같은 대표자(${rep}) 헌금자: ${sameFamilyDonors.length}건`);
    const memberNames = new Set<string>();
    sameFamilyDonors.forEach(d => memberNames.add(d.donor_name));
    memberNames.add(rep); // 대표자도 포함

    const result = {
      representative: rep,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === rep,
      })),
    };
    console.log(`[getFamilyGroup] 케이스2 결과:`, JSON.stringify(result));
    return result;
  }

  // 3. 헌금자정보에 없는 경우 → 수입부에서 가족 관계 추출 시도
  console.log(`[getFamilyGroup] 케이스3: 헌금자정보에 없음 → 수입부에서 추출 시도`);

  // 수입부에서 representative가 userName이거나 donor_name이 userName인 레코드 찾기
  const currentYear = new Date().getFullYear();
  const incomeRecords = await getIncomeRecords(`${currentYear}-01-01`, `${currentYear}-12-31`);

  // userName이 대표자로 등록된 헌금 레코드 (타인이 userName을 대표자로 지정)
  const recordsWithUserAsRep = incomeRecords.filter(r => r.representative === userName && r.donor_name !== userName);

  if (recordsWithUserAsRep.length > 0) {
    const memberNames = new Set<string>();
    memberNames.add(userName); // 대표자
    recordsWithUserAsRep.forEach(r => memberNames.add(r.donor_name));

    const result = {
      representative: userName,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === userName,
      })),
    };
    console.log(`[getFamilyGroup] 케이스3-1(수입부 대표자):`, JSON.stringify(result));
    return result;
  }

  // userName 본인의 헌금 레코드에서 대표자 찾기
  const userOwnRecords = incomeRecords.filter(r => r.donor_name === userName);
  if (userOwnRecords.length > 0 && userOwnRecords[0].representative && userOwnRecords[0].representative !== userName) {
    const rep = userOwnRecords[0].representative;
    // 같은 대표자를 가진 모든 헌금자 찾기
    const sameFamilyRecords = incomeRecords.filter(r => r.representative === rep);
    const memberNames = new Set<string>();
    memberNames.add(rep); // 대표자
    sameFamilyRecords.forEach(r => memberNames.add(r.donor_name));

    const result = {
      representative: rep,
      members: Array.from(memberNames).map(name => ({
        name,
        isRepresentative: name === rep,
      })),
    };
    console.log(`[getFamilyGroup] 케이스3-2(수입부 헌금자):`, JSON.stringify(result));
    return result;
  }

  // 4. 완전히 정보가 없는 경우 → 본인만
  console.log(`[getFamilyGroup] 케이스4: 수입부에도 정보 없음 → 본인만`);
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

    // === 최근 8주 주간 데이터 ===
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kst.getDay();
    const thisMonday = new Date(kst);
    thisMonday.setDate(kst.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);

    const eightWeeksAgoMonday = new Date(thisMonday);
    eightWeeksAgoMonday.setDate(thisMonday.getDate() - 7 * 7);

    const weeklyStart = eightWeeksAgoMonday.toISOString().split('T')[0];
    const weeklyEnd = thisSunday.toISOString().split('T')[0];

    // 8주 범위가 연도를 넘는 경우 별도 조회
    let weeklyRecords: typeof incomeRecords;
    if (weeklyStart >= startDate && weeklyEnd <= endDate) {
      // 현재 조회 연도 범위 안에 있으면 기존 데이터 재사용
      weeklyRecords = incomeRecords;
    } else {
      weeklyRecords = await getIncomeRecords(weeklyStart, weeklyEnd);
    }
    const weeklyOfferings = weeklyRecords.filter(record =>
      targetNames.includes(record.donor_name) &&
      record.date >= weeklyStart && record.date <= weeklyEnd
    );

    const weeklyData: Array<{ date: string; amount: number }> = [];
    for (let i = 0; i < 8; i++) {
      const wMonday = new Date(eightWeeksAgoMonday);
      wMonday.setDate(eightWeeksAgoMonday.getDate() + i * 7);
      const wSunday = new Date(wMonday);
      wSunday.setDate(wMonday.getDate() + 6);
      const wStart = wMonday.toISOString().split('T')[0];
      const wEnd = wSunday.toISOString().split('T')[0];

      const weekAmount = weeklyOfferings
        .filter(r => r.date >= wStart && r.date <= wEnd)
        .reduce((sum, r) => sum + r.amount, 0);

      weeklyData.push({
        date: `${wSunday.getMonth() + 1}/${wSunday.getDate()}`,
        amount: weekAmount,
      });
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
      weeklyData,
    });
  } catch (error) {
    console.error('My offering API error:', error);
    return NextResponse.json(
      { error: '헌금 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
