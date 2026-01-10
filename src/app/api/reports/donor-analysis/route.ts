import { NextRequest, NextResponse } from 'next/server';
import { getIncomeRecords } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year')) || new Date().getFullYear();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const incomeRecords = await getIncomeRecords(startDate, endDate);

    // 헌금자별 집계 (representative 기준 = 가구)
    const householdMap = new Map<string, {
      representative: string;
      totalAmount: number;
      count: number;
      months: Set<number>;
    }>();

    // 개인별 집계 (donor_name 기준)
    const individualSet = new Set<string>();

    incomeRecords.forEach(r => {
      // 개인 집계
      const individualKey = r.donor_name || '익명';
      individualSet.add(individualKey);

      // 가구 집계
      const householdKey = r.representative || r.donor_name || '익명';
      const month = new Date(r.date).getMonth() + 1;

      if (!householdMap.has(householdKey)) {
        householdMap.set(householdKey, {
          representative: householdKey,
          totalAmount: 0,
          count: 0,
          months: new Set(),
        });
      }
      const household = householdMap.get(householdKey)!;
      household.totalAmount += r.amount;
      household.count += 1;
      household.months.add(month);
    });

    // 금액 분포 계산 (익명 통계)
    const amountRanges = [
      { label: '10만 미만', min: 0, max: 100000, count: 0, totalAmount: 0 },
      { label: '10~30만', min: 100000, max: 300000, count: 0, totalAmount: 0 },
      { label: '30~50만', min: 300000, max: 500000, count: 0, totalAmount: 0 },
      { label: '50~100만', min: 500000, max: 1000000, count: 0, totalAmount: 0 },
      { label: '100만 이상', min: 1000000, max: Infinity, count: 0, totalAmount: 0 },
    ];

    householdMap.forEach(household => {
      const avgPerMonth = household.totalAmount / 12;
      for (const range of amountRanges) {
        if (avgPerMonth >= range.min && avgPerMonth < range.max) {
          range.count += 1;
          range.totalAmount += household.totalAmount;
          break;
        }
      }
    });

    // 월별 헌금자 수 (고유 헌금자)
    const monthlyDonors: { month: number; count: number; amount: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthRecords = incomeRecords.filter(r => {
        const recordMonth = new Date(r.date).getMonth() + 1;
        return recordMonth === m;
      });

      const uniqueDonors = new Set(monthRecords.map(r => r.representative || r.donor_name));
      const totalAmount = monthRecords.reduce((sum, r) => sum + r.amount, 0);

      monthlyDonors.push({
        month: m,
        count: uniqueDonors.size,
        amount: totalAmount,
      });
    }

    // 헌금 빈도 분석
    const frequencyDistribution = [
      { label: '1~3회', min: 1, max: 3, count: 0 },
      { label: '4~6회', min: 4, max: 6, count: 0 },
      { label: '7~12회', min: 7, max: 12, count: 0 },
      { label: '13~24회', min: 13, max: 24, count: 0 },
      { label: '25회 이상', min: 25, max: Infinity, count: 0 },
    ];

    householdMap.forEach(household => {
      for (const freq of frequencyDistribution) {
        if (household.count >= freq.min && household.count <= freq.max) {
          freq.count += 1;
          break;
        }
      }
    });

    // 전년 대비 분석 (신규/이탈)
    const prevStartDate = `${year - 1}-01-01`;
    const prevEndDate = `${year - 1}-12-31`;
    const prevIncomeRecords = await getIncomeRecords(prevStartDate, prevEndDate);

    const prevDonorSet = new Set(prevIncomeRecords.map(r => r.representative || r.donor_name));
    const currDonorSet = new Set<string>();
    householdMap.forEach((_, key) => currDonorSet.add(key));

    // 신규 헌금자: 올해는 있지만 작년에는 없었던
    const newDonors = Array.from(currDonorSet).filter(d => !prevDonorSet.has(d));
    // 이탈 헌금자: 작년에는 있었지만 올해는 없는
    const lostDonors = Array.from(prevDonorSet).filter(d => !currDonorSet.has(d));
    // 유지 헌금자: 작년과 올해 모두 있는
    const retainedDonors = Array.from(currDonorSet).filter(d => prevDonorSet.has(d));

    // 요약
    const totalIndividuals = individualSet.size;  // 개인 수
    const totalHouseholds = householdMap.size;     // 가구 수
    const totalAmount = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const avgPerIndividual = totalIndividuals > 0 ? Math.round(totalAmount / totalIndividuals) : 0;
    const avgPerHousehold = totalHouseholds > 0 ? Math.round(totalAmount / totalHouseholds) : 0;

    return NextResponse.json({
      success: true,
      data: {
        year,
        summary: {
          totalDonors: totalIndividuals,           // 기존 호환성 (개인 수)
          totalHouseholds,                         // 가구 수
          totalAmount,
          avgPerDonor: avgPerIndividual,           // 기존 호환성 (인당 평균)
          avgPerHousehold,                         // 가구당 평균
          totalTransactions: incomeRecords.length,
        },
        amountDistribution: amountRanges.map(r => ({
          label: r.label,
          count: r.count,
          totalAmount: r.totalAmount,
          percentage: totalHouseholds > 0 ? Math.round((r.count / totalHouseholds) * 100) : 0,
        })),
        monthlyDonors,
        frequencyDistribution: frequencyDistribution.map(f => ({
          label: f.label,
          count: f.count,
          percentage: totalHouseholds > 0 ? Math.round((f.count / totalHouseholds) * 100) : 0,
        })),
        retention: {
          newDonors: newDonors.length,
          lostDonors: lostDonors.length,
          retainedDonors: retainedDonors.length,
          retentionRate: prevDonorSet.size > 0
            ? Math.round((retainedDonors.length / prevDonorSet.size) * 100)
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Donor analysis error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
