import { NextRequest, NextResponse } from 'next/server';
import {
  getPledges,
  createPledge,
  initializePledgeSheets,
  getChurchPledgeStats,
  recalculateAllPledgesFulfillment,
  getKSTDateTime,
} from '@/lib/google-sheets';
import { getServerSession, hasRole } from '@/lib/auth/finance-permissions';
import type {
  OfferingType,
  PledgePeriod,
  PledgeStatus,
  OFFERING_CODE_MAP,
} from '@/types';

// 헌금 종류별 수입코드 매핑
const OFFERING_CODE_MAP_LOCAL: Record<string, number> = {
  building: 501,
  mission: 21,
  weekly: 11,
};

/**
 * 작정헌금 목록 조회 (로그인 필요)
 * GET /api/pledges?year=2026&donor_name=홍길동&representative=홍길동&offering_type=building
 * representative 파라미터 사용 시 가족 단위 조회 (권장)
 */
export async function GET(request: NextRequest) {
  try {
    // 로그인 확인
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const donor_name = searchParams.get('donor_name') || undefined;
    const representative = searchParams.get('representative') || undefined;
    const offering_type = searchParams.get('offering_type') as OfferingType | undefined;
    const status = searchParams.get('status') as PledgeStatus | undefined;
    const stats = searchParams.get('stats') === 'true';
    const recalculate = searchParams.get('recalculate') === 'true';

    // 교회 전체 통계 요청 (admin 이상 권한 필요)
    if (stats && year) {
      if (!hasRole(session.finance_role, 'admin')) {
        return NextResponse.json(
          { success: false, error: '권한이 없습니다' },
          { status: 403 }
        );
      }
      const churchStats = await getChurchPledgeStats(year);
      return NextResponse.json({
        success: true,
        data: { stats: churchStats },
      });
    }

    const pledges = await getPledges({
      year,
      donor_name,
      representative,
      offering_type,
      status,
    });

    // 조회 시 누계 재계산 옵션 (recalculate=true)
    if (recalculate && pledges.length > 0 && year) {
      // 해당 연도만 1회 재계산 (기존: 각 pledge마다 전체 재계산 - O(n²) 문제)
      await recalculateAllPledgesFulfillment(year);
      // 재계산 후 다시 조회
      const updatedPledges = await getPledges({
        year,
        donor_name,
        representative,
        offering_type,
        status,
      });
      return NextResponse.json({
        success: true,
        data: { pledges: updatedPledges, count: updatedPledges.length, recalculated: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: { pledges, count: pledges.length },
    });
  } catch (error) {
    console.error('Pledges GET error:', error);
    return NextResponse.json(
      { success: false, error: '작정헌금 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 작정헌금 생성 (로그인 필요)
 * POST /api/pledges
 */
export async function POST(request: NextRequest) {
  try {
    // 로그인 확인
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      donor_name,
      representative,
      offering_type,
      pledge_period,
      amount,
      year,
      start_month = 1,
      end_month = 12,
      memo,
    } = body;

    // 필수 필드 검증
    if (!donor_name || !offering_type || !pledge_period || !amount || !year) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다' },
        { status: 400 }
      );
    }

    // 유효성 검증
    if (!['building', 'mission', 'weekly'].includes(offering_type)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 헌금 종류입니다' },
        { status: 400 }
      );
    }

    if (!['weekly', 'monthly', 'yearly'].includes(pledge_period)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 작정 주기입니다' },
        { status: 400 }
      );
    }

    // 연간 환산 금액 계산
    let yearly_amount = amount;
    if (pledge_period === 'weekly') {
      yearly_amount = amount * 52;
    } else if (pledge_period === 'monthly') {
      const months = end_month - start_month + 1;
      yearly_amount = amount * months;
    }

    // 수입코드 매핑
    const offering_code = OFFERING_CODE_MAP_LOCAL[offering_type];

    // 중복 체크
    const existing = await getPledges({
      year,
      donor_name,
      offering_type,
      status: 'active',
    });

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '이미 해당 연도에 같은 종류의 작정이 있습니다' },
        { status: 400 }
      );
    }

    // 시트 초기화 (헤더 없으면 생성)
    await initializePledgeSheets();

    const now = getKSTDateTime();

    // 작정 생성
    const pledgeId = await createPledge({
      donor_name,
      representative: representative || donor_name,
      offering_type,
      offering_code,
      pledge_period,
      amount,
      yearly_amount,
      year,
      start_month,
      end_month,
      memo,
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      data: { pledgeId },
      message: '작정이 등록되었습니다',
    });
  } catch (error) {
    console.error('Pledges POST error:', error);
    return NextResponse.json(
      { success: false, error: '작정헌금 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 작정 누계 재계산 (admin 이상)
 * PUT /api/pledges?recalculate=true&year=2026
 */
export async function PUT(request: NextRequest) {
  try {
    // 권한 확인 (admin 이상)
    const session = await getServerSession();
    if (!session || !hasRole(session.finance_role, 'admin')) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const recalculate = searchParams.get('recalculate') === 'true';
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;

    if (!recalculate) {
      return NextResponse.json(
        { success: false, error: 'recalculate=true 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const updatedCount = await recalculateAllPledgesFulfillment(year);

    return NextResponse.json({
      success: true,
      data: { updatedCount },
      message: `${updatedCount}개의 작정 누계가 재계산되었습니다`,
    });
  } catch (error) {
    console.error('Pledges PUT error:', error);
    return NextResponse.json(
      { success: false, error: '작정 누계 재계산 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
