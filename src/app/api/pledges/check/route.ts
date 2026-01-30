import { NextRequest, NextResponse } from 'next/server';
import { getPledges } from '@/lib/google-sheets';

/**
 * 작정 여부 확인 API
 * GET /api/pledges/check?name=홍길동&year=2025
 *
 * 응답:
 * - hasBuildingPledge: 건축헌금 작정 여부
 * - hasMissionPledge: 선교헌금 작정 여부
 * - isComplete: 둘 다 있으면 true
 * - missingTypes: 미작정 종류 배열
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear();

    if (!name) {
      return NextResponse.json(
        { success: false, error: '이름이 필요합니다' },
        { status: 400 }
      );
    }

    // representative 또는 donor_name으로 조회
    const pledges = await getPledges({
      year,
      representative: name,
      status: 'active',
    });

    // donor_name으로도 추가 조회 (representative와 다를 경우)
    const pledgesByDonorName = await getPledges({
      year,
      donor_name: name,
      status: 'active',
    });

    // 중복 제거 후 병합
    const allPledges = [...pledges];
    for (const p of pledgesByDonorName) {
      if (!allPledges.some(existing => existing.id === p.id)) {
        allPledges.push(p);
      }
    }

    const hasBuildingPledge = allPledges.some(p => p.offering_type === 'building');
    const hasMissionPledge = allPledges.some(p => p.offering_type === 'mission');
    const isComplete = hasBuildingPledge && hasMissionPledge;

    // 미작정 종류 목록
    const missingTypes: string[] = [];
    if (!hasBuildingPledge) missingTypes.push('건축헌금');
    if (!hasMissionPledge) missingTypes.push('선교헌금');

    return NextResponse.json({
      success: true,
      year,
      name,
      hasBuildingPledge,
      hasMissionPledge,
      isComplete,
      missingTypes,
      pledgeCount: allPledges.length,
    });
  } catch (error) {
    console.error('Pledges check error:', error);
    return NextResponse.json(
      { success: false, error: '작정 여부 확인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
