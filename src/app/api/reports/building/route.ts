import { NextRequest, NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getBuildingMaster,
} from '@/lib/google-sheets';

// 기본 이자율 4.7% (연)
const DEFAULT_INTEREST_RATE = 4.7;

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

// 시나리오 타입
interface Scenario {
  name: string;
  years: number;
  monthlyPayment: number;
  futureInterest: number;
  totalInterest: number;
  saving: number;
  highlight: boolean;
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

// 연도별 헌금 폴백 데이터 (시트에서 읽지 못할 경우)
const yearlyDonationFallback: Record<number, number> = {
  2012: 105096619,
  2013: 91002179,
  2014: 90000000,
  2015: 85000000,
  2016: 80000000,
  2017: 75000000,
  2018: 70000000,
  2019: 68650000,
  2020: 68650000,
  2021: 79060000,
  2022: 99960000,
  2023: 74168725,
  2024: 63705000,
  2025: 55055000,
};

// 연도별 (원금상환, 이자지출) 분리 데이터
const yearlyRepaymentData: Record<number, { principal: number; interest: number }> = {
  2020: { principal: 60000000, interest: 43000000 },
  2021: { principal: 80000000, interest: 60000000 },
  2022: { principal: 50000000, interest: 55000000 },
  2023: { principal: 50000000, interest: 55000000 },
  2024: { principal: 40000000, interest: 50000000 },
  2025: { principal: 50000000, interest: 61035133 },
};

/**
 * 원리금균등상환 월 납입액 계산
 */
function calculateMonthlyPayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return principal / months;
  return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
}

/**
 * 완납까지 기간 계산 (월 상환액 기준)
 */
function calculatePayoffYears(principal: number, monthlyPayment: number, annualRate: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyPayment <= principal * monthlyRate) return 99; // 이자보다 적으면 완납 불가
  const months = Math.log(monthlyPayment / (monthlyPayment - principal * monthlyRate)) / Math.log(1 + monthlyRate);
  return months / 12;
}

/**
 * 향후 이자 계산
 */
function calculateFutureInterest(principal: number, annualRate: number, years: number): number {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);
  const totalPayment = monthlyPayment * years * 12;
  return totalPayment - principal;
}

/**
 * 시나리오 생성
 */
function generateScenarios(loanBalance: number, cumulativeInterest: number, annualRate: number): Scenario[] {
  const scenarios: Scenario[] = [];

  // 현재 속도 (실제 상환액 기반, 약 월 926만원 ≈ 17년)
  const currentYears = 17;
  const currentMonthlyPayment = calculateMonthlyPayment(loanBalance, annualRate, currentYears);
  const currentFutureInterest = calculateFutureInterest(loanBalance, annualRate, currentYears);

  // 5개 시나리오
  const scenarioConfigs = [
    { name: '현재 속도', years: currentYears, highlight: false },
    { name: '15년 완납', years: 15, highlight: false },
    { name: '10년 완납', years: 10, highlight: true },
    { name: '7년 완납', years: 7, highlight: false },
    { name: '5년 완납', years: 5, highlight: false },
  ];

  for (const config of scenarioConfigs) {
    const monthlyPayment = calculateMonthlyPayment(loanBalance, annualRate, config.years);
    const futureInterest = calculateFutureInterest(loanBalance, annualRate, config.years);
    const totalInterest = cumulativeInterest + futureInterest;
    const saving = currentFutureInterest - futureInterest;

    scenarios.push({
      name: config.name,
      years: config.years,
      monthlyPayment: Math.round(monthlyPayment),
      futureInterest: Math.round(futureInterest),
      totalInterest: Math.round(totalInterest),
      saving: Math.round(saving),
      highlight: config.highlight,
    });
  }

  return scenarios;
}

export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();

    // 1. 건축현황마스터에서 스냅샷 데이터 읽기
    const master = await getBuildingMaster();
    const interestRate = master.interestRate;

    // 2. 스냅샷 이후 년도 데이터 조회 (수입부/지출부)
    let currentYearDonation = 0;
    let currentYearPrincipal = 0;
    let currentYearInterest = 0;
    let currentYearRepayment = 0;

    if (currentYear > master.snapshotYear) {
      const [incomeRecords, expenseRecords] = await Promise.all([
        getIncomeRecords(`${currentYear}-01-01`, `${currentYear}-12-31`),
        getExpenseRecords(`${currentYear}-01-01`, `${currentYear}-12-31`),
      ]);

      // 건축헌금 (offering_code 501)
      currentYearDonation = incomeRecords
        .filter(r => r.offering_code === 501)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      // 원금상환 (account_code 502)
      currentYearPrincipal = expenseRecords
        .filter(r => r.account_code === 502)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      // 이자지출 (account_code 501)
      currentYearInterest = expenseRecords
        .filter(r => r.account_code === 501)
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      currentYearRepayment = currentYearPrincipal + currentYearInterest;
    }

    // 3. 히스토리 데이터 구성 (마스터에서 읽기 + 폴백)
    const historyData: BuildingHistory[] = [];

    // 마스터 히스토리가 있으면 사용, 없으면 기존 earlyHistoryData 폴백
    if (master.history.length > 0) {
      // 누적 계산용 변수
      let cumulativeDonation = master.cumulativeDonationBefore2011;
      let cumulativePrincipal = 0;
      let cumulativeInterest = 0;

      for (const h of master.history) {
        // 2012년 이전은 누적을 따로 계산
        if (h.year <= 2011) {
          historyData.push({
            year: h.year,
            yearlyDonation: h.donation,
            cumulativeDonation: h.year === 2011 ? master.cumulativeDonationBefore2011 : cumulativeDonation,
            principalPaid: h.principal,
            interestPaid: h.interest,
            loanBalance: h.loanBalance,
            milestone: h.milestone ? {
              title: h.milestone.split(':')[0] || h.milestone,
              description: h.milestone.split(':')[1] || '',
              icon: h.milestone.includes('토지') ? '🏞️' : h.milestone.includes('완공') ? '🏛️' : '📍'
            } : undefined
          });
        } else {
          // 2012년 이후 누적 계산
          cumulativeDonation += h.donation;
          cumulativePrincipal += h.principal;
          cumulativeInterest += h.interest;

          historyData.push({
            year: h.year,
            yearlyDonation: h.donation,
            cumulativeDonation,
            principalPaid: cumulativePrincipal,
            interestPaid: cumulativeInterest,
            loanBalance: h.loanBalance,
            milestone: h.year === master.snapshotYear ? {
              title: '스냅샷',
              description: `잔액 ${(h.loanBalance / 100000000).toFixed(1)}억`,
              icon: '📍'
            } : undefined
          });
        }
      }
    } else {
      // 폴백: 기존 earlyHistoryData 사용
      historyData.push(...earlyHistoryData);

      // 2012~스냅샷연도 히스토리 추가
      let prevCumulativeDonation = 3200000000; // 2011년 누적
      for (let year = 2012; year <= master.snapshotYear; year++) {
        const yearlyDonation = yearlyDonationFallback[year] || 0;
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
          loanBalance: year === master.snapshotYear ? master.loanBalance : progress.loanBalance,
          ...(year === master.snapshotYear && {
            milestone: {
              title: '스냅샷',
              description: `잔액 ${(master.loanBalance / 100000000).toFixed(1)}억`,
              icon: '📍'
            }
          })
        });
      }
    }

    // 금년 데이터 추가 (스냅샷 이후 연도)
    if (currentYear > master.snapshotYear) {
      const lastYearData = historyData[historyData.length - 1];
      const cumulativeDonation = lastYearData.cumulativeDonation + currentYearDonation;
      const principalPaid = master.cumulativePrincipal + currentYearPrincipal;
      const interestPaidCumulative = master.cumulativeInterest + currentYearInterest;
      const loanBalance = master.loanBalance - currentYearPrincipal;

      historyData.push({
        year: currentYear,
        yearlyDonation: currentYearDonation,
        cumulativeDonation,
        principalPaid,
        interestPaid: interestPaidCumulative,
        loanBalance: Math.max(0, loanBalance),
        milestone: {
          title: '금년',
          description: `잔액 ${(Math.max(0, loanBalance) / 100000000).toFixed(1)}억`,
          icon: '📌'
        }
      });
    }

    // 4. 최근 5년 데이터 구성 (마스터 히스토리 + 금년 데이터)
    const recentYears: RecentYear[] = [];

    // 마스터 히스토리에서 최근 4년 가져오기
    const masterHistoryByYear = new Map(master.history.map(h => [h.year, h]));

    for (let year = currentYear - 4; year <= currentYear; year++) {
      if (year === currentYear && currentYear > master.snapshotYear) {
        // 금년: 수입부/지출부에서 계산
        recentYears.push({
          year,
          donation: currentYearDonation,
          repayment: currentYearRepayment,
          principal: currentYearPrincipal,
          interest: currentYearInterest,
        });
      } else {
        // 과거년도: 마스터 히스토리 또는 폴백 사용
        const masterData = masterHistoryByYear.get(year);
        if (masterData) {
          recentYears.push({
            year,
            donation: masterData.donation,
            repayment: masterData.principal + masterData.interest,
            principal: masterData.principal,
            interest: masterData.interest,
          });
        } else if (year >= 2020 && year <= 2025) {
          // 폴백 적용된 헌금 + 원금/이자 데이터
          const donation = yearlyDonationFallback[year] || 0;
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
    }

    // 합계 계산
    const totalDonation5Years = recentYears.reduce((sum, d) => sum + d.donation, 0);
    const totalRepayment5Years = recentYears.reduce((sum, d) => sum + d.repayment, 0);
    const totalPrincipal5Years = recentYears.reduce((sum, d) => sum + d.principal, 0);
    const totalInterest5Years = recentYears.reduce((sum, d) => sum + d.interest, 0);
    const shortage5Years = totalRepayment5Years - totalDonation5Years;

    // 5. 건축 개요 (마스터 데이터 사용)
    const totalDonation = master.cumulativeDonationBefore2011 + master.cumulativeDonationAfter2012 +
      (currentYear > master.snapshotYear ? currentYearDonation : 0);
    const totalPrincipalPaid = master.cumulativePrincipal +
      (currentYear > master.snapshotYear ? currentYearPrincipal : 0);
    const actualLoanBalance = master.loanBalance -
      (currentYear > master.snapshotYear ? currentYearPrincipal : 0);

    const summary = {
      totalCost: master.totalCost,
      landCost: master.landCost,
      buildingCost: master.buildingCost,
      totalDonation,
      totalLoan: master.initialLoan,
      principalPaid: totalPrincipalPaid,
      interestPaid: master.cumulativeInterest + (currentYear > master.snapshotYear ? currentYearInterest : 0),
      loanBalance: Math.max(0, actualLoanBalance),
      donationRate: Math.round((totalDonation / master.totalCost) * 1000) / 10,
      repaymentRate: Math.round((totalPrincipalPaid / master.initialLoan) * 1000) / 10,
    };

    // 6. 최근 통계
    const recentStats = {
      totalDonation: totalDonation5Years,
      totalRepayment: totalRepayment5Years,
      totalPrincipal: totalPrincipal5Years,
      totalInterest: totalInterest5Years,
      shortage: shortage5Years,
      years: recentYears
    };

    // 7. 시나리오 생성 (4.7% 이자율 적용)
    const scenarios = generateScenarios(
      summary.loanBalance,
      summary.interestPaid,
      interestRate
    );

    // 10년 완납 시나리오 정보 추출
    const tenYearScenario = scenarios.find(s => s.years === 10);
    const currentScenario = scenarios.find(s => s.name === '현재 속도');

    // 8. 실시간 이자 계산 데이터 (4.7% 이자율 적용)
    const dailyInterest = (summary.loanBalance * interestRate / 100) / 365;
    const realTimeInterest = {
      perSecond: dailyInterest / 86400,
      perDay: dailyInterest,
      perMonth: dailyInterest * 30,
      perYear: summary.loanBalance * interestRate / 100,
    };

    // 9. 10년 완납 챌린지 데이터
    const currentMonthlyDonation = yearlyDonationFallback[2025] / 12; // 약 459만원
    const targetMonthlyPayment = tenYearScenario?.monthlyPayment || 13598676; // 약 1360만원
    const additionalNeeded = targetMonthlyPayment - currentMonthlyDonation;

    const challengeData = {
      currentMonthlyDonation: Math.round(currentMonthlyDonation),
      targetMonthlyPayment: targetMonthlyPayment,
      additionalNeeded: Math.round(additionalNeeded),
      saving: tenYearScenario?.saving || 259000000,
      perPersonByCount: {
        50: Math.round(additionalNeeded / 50),
        100: Math.round(additionalNeeded / 100),
        150: Math.round(additionalNeeded / 150),
        200: Math.round(additionalNeeded / 200),
      }
    };

    // 10. 시뮬레이션 기본값
    const simulation = {
      currentLoanBalance: summary.loanBalance,
      interestRate,
      cumulativeInterestPaid: summary.interestPaid,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        history: historyData,
        recent: recentStats,
        simulation,
        scenarios,
        realTimeInterest,
        challenge: challengeData,
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
