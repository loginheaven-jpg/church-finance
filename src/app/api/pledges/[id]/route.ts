import { NextRequest, NextResponse } from 'next/server';
import {
  getPledgeById,
  updatePledge,
  deletePledge,
  getDonorMilestones,
  getPledgeHistory,
} from '@/lib/google-sheets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 작정헌금 단일 조회
 * GET /api/pledges/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('history') === 'true';
    const includeMilestones = searchParams.get('milestones') === 'true';

    const pledge = await getPledgeById(id);

    if (!pledge) {
      return NextResponse.json(
        { success: false, error: '작정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const result: Record<string, unknown> = {
      success: true,
      pledge,
    };

    // 이력 포함
    if (includeHistory) {
      result.history = await getPledgeHistory(id);
    }

    // 마일스톤 포함
    if (includeMilestones) {
      result.milestones = await getDonorMilestones(pledge.donor_name);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pledge GET error:', error);
    return NextResponse.json(
      { success: false, error: '작정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 작정헌금 수정
 * PUT /api/pledges/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const pledge = await getPledgeById(id);
    if (!pledge) {
      return NextResponse.json(
        { success: false, error: '작정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 수정 가능한 필드만 추출
    const allowedFields = [
      'amount',
      'yearly_amount',
      'start_month',
      'end_month',
      'memo',
      'status',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // 금액이 변경되면 연간 환산 금액도 재계산
    if (body.amount !== undefined && body.pledge_period) {
      let yearly_amount = body.amount;
      const start_month = body.start_month || pledge.start_month;
      const end_month = body.end_month || pledge.end_month;

      if (body.pledge_period === 'weekly') {
        yearly_amount = body.amount * 52;
      } else if (body.pledge_period === 'monthly') {
        const months = end_month - start_month + 1;
        yearly_amount = body.amount * months;
      }
      updates.yearly_amount = yearly_amount;
    }

    await updatePledge(id, updates);

    return NextResponse.json({
      success: true,
      message: '작정이 수정되었습니다',
    });
  } catch (error) {
    console.error('Pledge PUT error:', error);
    return NextResponse.json(
      { success: false, error: '작정 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 작정헌금 삭제 (soft delete)
 * DELETE /api/pledges/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const pledge = await getPledgeById(id);
    if (!pledge) {
      return NextResponse.json(
        { success: false, error: '작정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    await deletePledge(id);

    return NextResponse.json({
      success: true,
      message: '작정이 삭제되었습니다',
    });
  } catch (error) {
    console.error('Pledge DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '작정 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
