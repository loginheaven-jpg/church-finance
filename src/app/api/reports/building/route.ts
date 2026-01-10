import { NextRequest, NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getBuildingSummary,
  getBuildingYearlyDonations,
} from '@/lib/google-sheets';

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

// 2003~2011 히스토리 데이터 (고정 - 역사적 마일스톤)
const earlyHistoryData: BuildingHistory[] = [
  {
    year: 2003,
    yearlyDonation: 0,
    cumulativeDonation: 0,
    principalPaid: 0,
    interestPaid: 0,
    loanBalance: 1800000000,
    milestone: { title: '토지 매입', description: '18억원', icon: '🏞️' }
  },
  { year: 2004, yearlyDonation: 200000000, cumulativeDonation: 200000000, principalPaid: 0, interestPaid: 72000000, loanBalance: 1800000000 },
  { year: 2005, yearlyDonation: 250000000, cumulativeDonation: 450000000, principalPaid: 0, interestPaid: 144000000, loanBalance: 1800000000 },
  { year: 2006, yearlyDonation: 300000000, cumulativeDonation: 750000000, principalPaid: 0, interestPaid: 216000000, loanBalance: 1800000000 },
  { year: 2007, yearlyDonation: 350000000, cumulativeDonation: 1100000000, principalPaid: 0, interestPaid: 288000000, loanBalance: 1800000000 },
  { year: 2008, yearlyDonation: 400000000, cumulativeDonation: 1500000000, principalPaid: 0, interestPaid: 360000000, loanBalance: 1800000000 },
  { year: 2009, yearlyDonation: 450000000, cumulativeDonation: 1950000000, principalPaid: 0, interestPaid: 432000000, loanBalance: 1800000000 },
  { year: 2010, yearlyDonation: 500000000, cumulativeDonation: 2450000000, principalPaid: 0, interestPaid: 504000000, loanBalance: 1800000000 },
  {
    year: 2011,
    yearlyDonation: 750000000,
    cumulativeDonation: 3200000000,
    principalPaid: 0,
    interestPaid: 576000000,
    loanBalance: 2100000000,
    milestone: { title: '건축 완공', description: '34억원', icon: '🏛️' }
  },
];

// 연도별 누적 데이터 (2012~2025 기준, 시트에서 읽지 못할 경우 폴백)
const yearlyProgressData: Record<number, { principalPaid: number; interestPaid: number; loanBalance: number }> = {
  2012: { principalPaid: 0, interestPaid: 660000000, loanBalance: 2100000000 },
  2013: { principalPaid: 0, interestPaid: 744000000, loanBalance: 2100000000 },
  2014: { principalPaid: 100000000, interestPaid: 820000000, loanBalance: 2000000000 },
  2015: { principalPaid: 200000000, interestPaid: 890000000, loanBalance: 1900000000 },
  2016: { principalPaid: 300000000, interestPaid: 950000000, loanBalance: 1800000000 },
  2017: { principalPaid: 350000000, interestPaid: 1005000000, loanBalance: 1750000000 },
  2018: { principalPaid: 400000000, interestPaid: 1055000000, loanBalance: 1700000000 },
  2019: { principalPaid: 500000000, interestPaid: 1100000000, loanBalance: 1600000000 },
  2020: { principalPaid: 560000000, interestPaid: 1143000000, loanBalance: 1540000000 },
  2021: { principalPaid: 640000000, interestPaid: 1203000000, loanBalance: 1460000000 },
  2022: { principalPaid: 690000000, interestPaid: 1258000000, loanBalance: 1410000000 },
  2023: { principalPaid: 740000000, interestPaid: 1313000000, loanBalance: 1360000000 },
  2024: { principalPaid: 780000000, interestPaid: 1363000000, loanBalance: 1320000000 },
  2025: { principalPaid: 800000000, interestPaid: 1026764421, loanBalance: 1300000000 },
};

// 연도별 (원금상환, 이자지출) 분리 데이터
const yearlyRepaymentData: Record<number, { principal: number; interest: number }> = {
  2020: { principal: 60000000, interest: 43000000 },
  2021: { principal: 80000000, interest: 60000000 },
  2022: { principal: 50000000, interest: 55000000 },
  2023: { principal: 50000000, interest: 55000000 },
  2024: { principal: 40000000, interest: 50000000 },
  2025: { principal: 20000000, interest: 49000000 },
};

export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Google Sheets에서 건축 요약 데이터 읽기
    const [sheetSummary, sheetDonations] = await Promise.all([
      getBuildingSummary(),
      getBuildingYearlyDonations(),
    ]);

    // 2. 금년 실제 데이터 조회 (수입부/지출부)
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

    // 3. 히스토리 데이터 구성 (2012년 이후는 시트 데이터 사용)
    const historyData: BuildingHistory[] = [...earlyHistoryData];

    // 시트에서 읽은 연도별 헌금을 Map으로 변환
    const donationByYear = new Map<number, number>();
    sheetDonations.forEach(d => donationByYear.set(d.year, d.donation));

    // 2012~2025 히스토리 추가
    let prevCumulativeDonation = 3200000000; // 2011년 누적
    for (let year = 2012; year <= 2025; year++) {
      const yearlyDonation = donationByYear.get(year) || 0;
      prevCumulativeDonation += yearlyDonation;

      const progress = yearlyProgressData[year] || {
        principalPaid: 0,
        interestPaid: 0,
        loanBalance: 2100000000,
      };

      historyData.push({
        year,
        yearlyDonation,
        cumulativeDonation: prevCumulativeDonation,
        principalPaid: progress.principalPaid,
        interestPaid: progress.interestPaid,
        loanBalance: year === 2025 ? sheetSummary.loanBalance : progress.loanBalance,
        ...(year === 2025 && {
          milestone: {
            title: '현재',
            description: `잔액 ${(sheetSummary.loanBalance / 100000000).toFixed(1)}억`,
            icon: '📍'
          }
        })
      });
    }

    // 금년 데이터 추가 (2026년 이후)
    if (currentYear > 2025) {
      const lastYearData = historyData[historyData.length - 1];
      const cumulativeDonation = lastYearData.cumulativeDonation + currentYearDonation;
      const principalPaid = sheetSummary.cumulativePrincipal + currentYearPrincipal;
      const interestPaid = sheetSummary.cumulativeInterest + currentYearInterest;
      const loanBalance = sheetSummary.loanBalance - currentYearPrincipal;

      historyData.push({
        year: currentYear,
        yearlyDonation: currentYearDonation,
        cumulativeDonation,
        principalPaid,
        interestPaid,
        loanBalance: Math.max(0, loanBalance),
        milestone: {
          title: '금년',
          description: `잔액 ${(Math.max(0, loanBalance) / 100000000).toFixed(1)}억`,
          icon: '📌'
        }
      });
    }

    // 4. 목표 시나리오 (2027~2030) 추가
    const lastActualData = historyData[historyData.length - 1];
    const remainingYears = 2030 - currentYear;
    const annualTarget = remainingYears > 0 ? Math.ceil(lastActualData.loanBalance / remainingYears) : 0;

    for (let year = currentYear + 1; year <= 2030; year++) {
      const yearsFromNow = year - currentYear;
      const projectedPrincipal = Math.min(annualTarget * yearsFromNow, lastActualData.loanBalance);
      const projectedBalance = Math.max(0, lastActualData.loanBalance - projectedPrincipal);
      const prevData = historyData[historyData.length - 1];

      historyData.push({
        year,
        yearlyDonation: 250000000, // 목표 연간 헌금
        cumulativeDonation: prevData.cumulativeDonation + 250000000,
        principalPaid: lastActualData.principalPaid + projectedPrincipal,
        interestPaid: prevData.interestPaid + 40000000, // 예상 이자
        loanBalance: projectedBalance,
        ...(year === 2030 && {
          milestone: { title: '목표 완료', description: '대출 제로!', icon: '🎯' }
        })
      });
    }

    // 5. 최근 5년 데이터 동적 구성 (currentYear-4 ~ currentYear)
    const recentYears: RecentYear[] = [];
    for (let year = currentYear - 4; year <= currentYear; year++) {
      if (year === currentYear) {
        // 금년: 수입부/지출부에서 계산
        recentYears.push({
          year,
          donation: currentYearDonation,
          repayment: currentYearRepayment,
          principal: currentYearPrincipal,
          interest: currentYearInterest,
        });
      } else if (year >= 2020 && year <= 2025) {
        // 과거년도: 시트 헌금 + 하드코딩된 원금/이자 데이터
        const donation = donationByYear.get(year) || 0;
        const repayment = yearlyRepaymentData[year] || { principal: 0, interest: 0 };
        recentYears.push({
          year,
          donation,
          repayment: repayment.principal + repayment.interest,
          principal: repayment.principal,
          interest: repayment.interest,
        });
      }
    }

    // 합계 계산
    const totalDonation5Years = recentYears.reduce((sum, d) => sum + d.donation, 0);
    const totalRepayment5Years = recentYears.reduce((sum, d) => sum + d.repayment, 0);
    const totalPrincipal5Years = recentYears.reduce((sum, d) => sum + d.principal, 0);
    const totalInterest5Years = recentYears.reduce((sum, d) => sum + d.interest, 0);
    const shortage5Years = totalRepayment5Years - totalDonation5Years;

    // 6. 건축 개요 (시트 데이터 사용)
    const totalDonation = sheetSummary.donationBefore2011 + sheetSummary.donationAfter2012 +
      (currentYear > 2025 ? currentYearDonation : 0);
    const totalPrincipalPaid = sheetSummary.cumulativePrincipal +
      (currentYear > 2025 ? currentYearPrincipal : 0);
    const actualLoanBalance = sheetSummary.loanBalance -
      (currentYear > 2025 ? currentYearPrincipal : 0);

    const summary = {
      totalCost: sheetSummary.totalCost || 5200000000,
      landCost: sheetSummary.landCost || 1800000000,
      buildingCost: sheetSummary.buildingCost || 3400000000,
      totalDonation,
      totalLoan: sheetSummary.totalLoan || 2100000000,
      principalPaid: totalPrincipalPaid,
      interestPaid: sheetSummary.cumulativeInterest + (currentYear > 2025 ? currentYearInterest : 0),
      loanBalance: Math.max(0, actualLoanBalance),
      donationRate: Math.round((totalDonation / (sheetSummary.totalCost || 5200000000)) * 1000) / 10,
      repaymentRate: Math.round((totalPrincipalPaid / (sheetSummary.totalLoan || 2100000000)) * 1000) / 10,
    };

    // 7. 5개년 목표 계산
    const yearsUntil2030 = Math.max(1, 2030 - currentYear);
    const monthlyRequired = Math.ceil(summary.loanBalance / yearsUntil2030 / 12);

    const target = {
      remainingLoan: summary.loanBalance,
      targetYear: 2030,
      yearsRemaining: yearsUntil2030,
      annualRequired: Math.ceil(summary.loanBalance / yearsUntil2030),
      monthlyRequired,
      scenarios: [
        { households: 100, amountPerMonth: Math.ceil(monthlyRequired / 100), total: monthlyRequired },
        { households: 210, amountPerMonth: Math.ceil(monthlyRequired / 210), total: monthlyRequired },
        { households: 420, amountPerMonth: Math.ceil(monthlyRequired / 420), total: monthlyRequired },
      ]
    };

    // 8. 최근 통계
    const recentStats = {
      totalDonation: totalDonation5Years,
      totalRepayment: totalRepayment5Years,
      totalPrincipal: totalPrincipal5Years,
      totalInterest: totalInterest5Years,
      shortage: shortage5Years,
      years: recentYears
    };

    // 9. 완납 예상 계산
    const avgPrincipalPerYear = totalPrincipal5Years / recentYears.length;
    const avgInterestPerYear = totalInterest5Years / recentYears.length;

    const yearsToPayoff = avgPrincipalPerYear > 0
      ? Math.ceil(summary.loanBalance / avgPrincipalPerYear)
      : 999;
    const projectedPayoffYear = currentYear + yearsToPayoff;

    const requiredAnnualPrincipal = yearsUntil2030 > 0
      ? Math.ceil(summary.loanBalance / yearsUntil2030)
      : summary.loanBalance;
    const additionalRequired = requiredAnnualPrincipal - avgPrincipalPerYear;

    // 완납까지 총 예상 이자
    const avgInterestRate = summary.loanBalance > 0 ? avgInterestPerYear / summary.loanBalance : 0.04;
    let projectedTotalInterest = summary.interestPaid;
    let tempBalance = summary.loanBalance;
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
