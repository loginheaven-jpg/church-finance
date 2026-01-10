import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords, getExpenseRecords } from '@/lib/google-sheets';

// 건축 히스토리 데이터 타입
interface BuildingHistory {
  year: number;
  yearlyDonation: number;        // 연간 건축헌금
  cumulativeDonation: number;    // 누적 건축헌금
  principalPaid: number;         // 누적 원금 상환
  interestPaid: number;          // 누적 이자 지출
  loanBalance: number;           // 대출 잔액
  milestone?: {
    title: string;
    description: string;
    icon: string;
  };
}

// 최근 연도 데이터 타입
interface RecentYear {
  year: number;
  donation: number;
  repayment: number;
  principal: number;
  interest: number;
}

// 건축 히스토리 데이터 (실제 엑셀 데이터 기반)
const historyData: BuildingHistory[] = [
  // 2003: 토지 매입
  {
    year: 2003,
    yearlyDonation: 0,
    cumulativeDonation: 0,
    principalPaid: 0,
    interestPaid: 0,
    loanBalance: 1800000000,
    milestone: { title: '토지 매입', description: '18억원', icon: '🏞️' }
  },
  // 2004-2010: 토지 매입 후 준비 기간
  { year: 2004, yearlyDonation: 200000000, cumulativeDonation: 200000000, principalPaid: 0, interestPaid: 72000000, loanBalance: 1800000000 },
  { year: 2005, yearlyDonation: 250000000, cumulativeDonation: 450000000, principalPaid: 0, interestPaid: 144000000, loanBalance: 1800000000 },
  { year: 2006, yearlyDonation: 300000000, cumulativeDonation: 750000000, principalPaid: 0, interestPaid: 216000000, loanBalance: 1800000000 },
  { year: 2007, yearlyDonation: 350000000, cumulativeDonation: 1100000000, principalPaid: 0, interestPaid: 288000000, loanBalance: 1800000000 },
  { year: 2008, yearlyDonation: 400000000, cumulativeDonation: 1500000000, principalPaid: 0, interestPaid: 360000000, loanBalance: 1800000000 },
  { year: 2009, yearlyDonation: 450000000, cumulativeDonation: 1950000000, principalPaid: 0, interestPaid: 432000000, loanBalance: 1800000000 },
  { year: 2010, yearlyDonation: 500000000, cumulativeDonation: 2450000000, principalPaid: 0, interestPaid: 504000000, loanBalance: 1800000000 },
  // 2011: 건축 완공
  {
    year: 2011,
    yearlyDonation: 750000000,
    cumulativeDonation: 3200000000,
    principalPaid: 0,
    interestPaid: 576000000,
    loanBalance: 2100000000,
    milestone: { title: '건축 완공', description: '34억원', icon: '🏛️' }
  },
  // 2012-2025: 실제 데이터
  { year: 2012, yearlyDonation: 105096619, cumulativeDonation: 3305096619, principalPaid: 0, interestPaid: 660000000, loanBalance: 2100000000 },
  { year: 2013, yearlyDonation: 91002179, cumulativeDonation: 3396098798, principalPaid: 0, interestPaid: 744000000, loanBalance: 2100000000 },
  { year: 2014, yearlyDonation: 99035305, cumulativeDonation: 3495134103, principalPaid: 100000000, interestPaid: 820000000, loanBalance: 2000000000 },
  { year: 2015, yearlyDonation: 119893000, cumulativeDonation: 3615027103, principalPaid: 200000000, interestPaid: 890000000, loanBalance: 1900000000 },
  { year: 2016, yearlyDonation: 104589426, cumulativeDonation: 3719616529, principalPaid: 300000000, interestPaid: 950000000, loanBalance: 1800000000 },
  { year: 2017, yearlyDonation: 88913105, cumulativeDonation: 3808529634, principalPaid: 350000000, interestPaid: 1005000000, loanBalance: 1750000000 },
  { year: 2018, yearlyDonation: 47206219, cumulativeDonation: 3855735853, principalPaid: 400000000, interestPaid: 1055000000, loanBalance: 1700000000 },
  { year: 2019, yearlyDonation: 127762000, cumulativeDonation: 3983497853, principalPaid: 500000000, interestPaid: 1100000000, loanBalance: 1600000000 },
  { year: 2020, yearlyDonation: 68650000, cumulativeDonation: 4052147853, principalPaid: 560000000, interestPaid: 1143000000, loanBalance: 1540000000 },
  { year: 2021, yearlyDonation: 79060000, cumulativeDonation: 4131207853, principalPaid: 640000000, interestPaid: 1203000000, loanBalance: 1460000000 },
  { year: 2022, yearlyDonation: 99960000, cumulativeDonation: 4231167853, principalPaid: 690000000, interestPaid: 1258000000, loanBalance: 1410000000 },
  { year: 2023, yearlyDonation: 74168725, cumulativeDonation: 4305336578, principalPaid: 740000000, interestPaid: 1313000000, loanBalance: 1360000000 },
  { year: 2024, yearlyDonation: 63705000, cumulativeDonation: 4369041578, principalPaid: 780000000, interestPaid: 1363000000, loanBalance: 1320000000 },
  {
    year: 2025,
    yearlyDonation: 55055000,
    cumulativeDonation: 4424096578,
    principalPaid: 800000000,          // 엑셀 기준 누적 원금상환 8억
    interestPaid: 1026764421,          // 엑셀 기준 누적 이자지출 10.27억
    loanBalance: 1250000000,
    milestone: { title: '현재', description: '잔액 12.5억', icon: '📍' }
  },
  // 2026-2030: 목표 시나리오
  { year: 2026, yearlyDonation: 250000000, cumulativeDonation: 4674096578, principalPaid: 1100000000, interestPaid: 1460000000, loanBalance: 1000000000 },
  { year: 2027, yearlyDonation: 250000000, cumulativeDonation: 4924096578, principalPaid: 1350000000, interestPaid: 1500000000, loanBalance: 750000000 },
  { year: 2028, yearlyDonation: 250000000, cumulativeDonation: 5174096578, principalPaid: 1600000000, interestPaid: 1530000000, loanBalance: 500000000 },
  { year: 2029, yearlyDonation: 250000000, cumulativeDonation: 5424096578, principalPaid: 1850000000, interestPaid: 1550000000, loanBalance: 250000000 },
  {
    year: 2030,
    yearlyDonation: 250000000,
    cumulativeDonation: 5674096578,
    principalPaid: 2100000000, // 완전 상환
    interestPaid: 1560000000,
    loanBalance: 0,
    milestone: { title: '목표 완료', description: '대출 제로!', icon: '🎯' }
  }
];

// 최근 5년 데이터
const recentData: RecentYear[] = [
  { year: 2020, donation: 68650000, repayment: 203000000, principal: 160000000, interest: 43000000 },
  { year: 2021, donation: 79060000, repayment: 240000000, principal: 180000000, interest: 60000000 },
  { year: 2022, donation: 99960000, repayment: 205000000, principal: 150000000, interest: 55000000 },
  { year: 2023, donation: 74168725, repayment: 175000000, principal: 120000000, interest: 55000000 },
  { year: 2024, donation: 63705000, repayment: 165000000, principal: 115000000, interest: 50000000 }
];

export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();

    // 금년 실제 데이터 조회 (Google Sheets)
    const [incomeRecords, expenseRecords] = await Promise.all([
      getIncomeRecords(`${currentYear}-01-01`, `${currentYear}-12-31`),
      getExpenseRecords(`${currentYear}-01-01`, `${currentYear}-12-31`),
    ]);

    // 건축헌금 (offering_code 500번대)
    const currentYearDonation = incomeRecords
      .filter(r => r.offering_code >= 500 && r.offering_code < 600)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // 원금상환 (account_code 502)
    const currentYearPrincipal = expenseRecords
      .filter(r => r.account_code === 502)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // 이자지출 (account_code 501)
    const currentYearInterest = expenseRecords
      .filter(r => r.account_code === 501)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const currentYearRepayment = currentYearPrincipal + currentYearInterest;

    // recentData 동적 업데이트 (금년 데이터가 있으면 교체)
    const dynamicRecentData = recentData.map(d => {
      if (d.year === currentYear) {
        return {
          year: currentYear,
          donation: currentYearDonation,
          repayment: currentYearRepayment,
          principal: currentYearPrincipal,
          interest: currentYearInterest
        };
      }
      return d;
    });

    // 금년이 recentData에 없으면 추가
    if (!dynamicRecentData.find(d => d.year === currentYear)) {
      dynamicRecentData.push({
        year: currentYear,
        donation: currentYearDonation,
        repayment: currentYearRepayment,
        principal: currentYearPrincipal,
        interest: currentYearInterest
      });
      // 가장 오래된 연도 제거 (5년 유지)
      dynamicRecentData.sort((a, b) => a.year - b.year);
      if (dynamicRecentData.length > 5) {
        dynamicRecentData.shift();
      }
    }

    // 합계 계산 (동적 데이터 사용)
    const totalDonation5Years = dynamicRecentData.reduce((sum, d) => sum + d.donation, 0);
    const totalRepayment5Years = dynamicRecentData.reduce((sum, d) => sum + d.repayment, 0);
    const shortage5Years = totalRepayment5Years - totalDonation5Years;

    // 건축 개요 (엑셀 데이터 기준)
    const summary = {
      totalCost: 5200000000,                // 총 건축비 52억
      landCost: 1800000000,                 // 토지 18억
      buildingCost: 3400000000,             // 건물 34억
      totalDonation: 4420000000,            // 누적 헌금 44.2억 (헌금~11년 32억 + 헌금12년~ 12.2억)
      totalLoan: 2100000000,                // 총 대출 21억
      principalPaid: 800000000,             // 원금 상환 누적 8억 (엑셀 기준)
      interestPaid: 1026764421,             // 이자 지출 누적 10.27억 (엑셀 기준)
      loanBalance: 1250000000,              // 남은 대출 12.5억
      donationRate: 85.0,                   // 헌금 비율 (44.2억 / 52억)
      repaymentRate: 38.1,                  // 상환 비율 (8억 / 21억)
    };

    // 5개년 목표
    const target = {
      remainingLoan: 1250000000,            // 남은 대출 12.5억
      targetYear: 2030,
      yearsRemaining: 5,
      annualRequired: 250000000,            // 연간 필요액 2.5억
      monthlyRequired: 21000000,            // 월간 필요액 2,100만원
      scenarios: [
        { households: 100, amountPerMonth: 210000, total: 21000000 },
        { households: 210, amountPerMonth: 100000, total: 21000000 },
        { households: 420, amountPerMonth: 50000, total: 21000000 },
      ]
    };

    // 최근 5년 통계 (원금/이자 분리)
    const totalPrincipal5Years = dynamicRecentData.reduce((sum, d) => sum + d.principal, 0);
    const totalInterest5Years = dynamicRecentData.reduce((sum, d) => sum + d.interest, 0);

    const recentStats = {
      totalDonation: totalDonation5Years,
      totalRepayment: totalRepayment5Years,
      totalPrincipal: totalPrincipal5Years,
      totalInterest: totalInterest5Years,
      shortage: shortage5Years,
      years: dynamicRecentData
    };

    // 완납 예상 계산
    const avgPrincipalPerYear = totalPrincipal5Years / dynamicRecentData.length;
    const avgInterestPerYear = totalInterest5Years / dynamicRecentData.length;
    const remainingLoan = summary.loanBalance;

    // 현재 추세로 예상 완납 년도
    const yearsToPayoff = avgPrincipalPerYear > 0
      ? Math.ceil(remainingLoan / avgPrincipalPerYear)
      : 999;
    const projectedPayoffYear = currentYear + yearsToPayoff;

    // 2030년 목표 달성을 위한 필요 금액
    const yearsUntil2030 = 2030 - currentYear;
    const requiredAnnualPrincipal = yearsUntil2030 > 0
      ? Math.ceil(remainingLoan / yearsUntil2030)
      : remainingLoan;
    const additionalRequired = requiredAnnualPrincipal - avgPrincipalPerYear;

    // 완납까지 총 예상 이자 (현재 금리 유지 가정)
    const avgInterestRate = avgInterestPerYear / remainingLoan; // 대략적인 이율
    let projectedTotalInterest = summary.interestPaid;
    let tempBalance = remainingLoan;
    for (let i = 0; i < yearsToPayoff && tempBalance > 0; i++) {
      projectedTotalInterest += tempBalance * avgInterestRate;
      tempBalance -= avgPrincipalPerYear;
    }

    const projection = {
      avgPrincipalPerYear,
      avgInterestPerYear,
      projectedPayoffYear,
      targetYear: 2030,
      yearsToPayoff,
      requiredAnnualPrincipal,
      additionalRequired: Math.max(0, additionalRequired),
      projectedTotalInterest: Math.round(projectedTotalInterest),
      insights: [
        projectedPayoffYear > 2030
          ? `현재 추세로는 ${projectedPayoffYear}년에 대출 완납 예상`
          : `현재 추세로는 ${projectedPayoffYear}년에 대출 완납 가능`,
        additionalRequired > 0
          ? `2030년 완납을 위해 연간 ${Math.round(additionalRequired / 10000).toLocaleString()}만원 추가 상환 필요`
          : '현재 추세로 2030년 목표 달성 가능',
        `완납 시점까지 총 이자 부담: 약 ${(projectedTotalInterest / 100000000).toFixed(1)}억원`
      ]
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        history: historyData,
        recent: recentStats,
        target,
        projection
      }
    });
  } catch (error) {
    console.error('Building report error:', error);
    return NextResponse.json(
      { success: false, error: '건축헌금현황 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
