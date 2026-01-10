import { NextRequest, NextResponse } from 'next/server';
import {
  getPledgeDonations,
  addPledgeDonation,
  updatePledgeDonation,
  deletePledgeDonation,
  getIncomeRecords,
  getKSTDateTime,
} from '@/lib/google-sheets';

// 헌금 종류별 수입 코드 범위
const PLEDGE_TYPE_CODE_RANGE = {
  '건축헌금': { min: 500, max: 600 },  // 500번대
  '선교헌금': { min: 30, max: 40 },    // 30번대
} as const;

// GET: 작정헌금 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const type = searchParams.get('type') as '건축헌금' | '선교헌금' | null;
    const withFulfillment = searchParams.get('withFulfillment') === 'true';

    let pledges = year
      ? await getPledgeDonations(Number(year))
      : await getPledgeDonations();

    // type 필터 적용 (기존 데이터 호환: type이 없으면 '건축헌금'으로 간주)
    if (type) {
      pledges = pledges.filter(p => (p.type || '건축헌금') === type);
    }

    if (withFulfillment && year) {
      // 실행금액 계산
      const incomeRecords = await getIncomeRecords(`${year}-01-01`, `${year}-12-31`);

      const pledgesWithFulfillment = pledges.map(pledge => {
        const pledgeType = pledge.type || '건축헌금';
        const codeRange = PLEDGE_TYPE_CODE_RANGE[pledgeType];

        // 해당 헌금자의 해당 종류 헌금 합계
        const fulfilled = incomeRecords
          .filter(r =>
            (r.representative === pledge.representative || r.donor_name === pledge.donor_name) &&
            r.offering_code >= codeRange.min &&
            r.offering_code < codeRange.max
          )
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        return {
          ...pledge,
          type: pledgeType,
          fulfilled_amount: fulfilled,
          fulfillment_rate: pledge.pledged_amount > 0
            ? Math.round((fulfilled / pledge.pledged_amount) * 100)
            : 0,
        };
      });

      return NextResponse.json({
        success: true,
        data: pledgesWithFulfillment,
      });
    }

    // type이 없는 기존 데이터에 기본값 추가
    const pledgesWithType = pledges.map(p => ({
      ...p,
      type: p.type || '건축헌금',
    }));

    return NextResponse.json({
      success: true,
      data: pledgesWithType,
    });
  } catch (error) {
    console.error('Pledge fetch error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 작정헌금 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, type, donor_name, representative, pledged_amount, note } = body;

    if (!year || !donor_name || !pledged_amount) {
      return NextResponse.json(
        { success: false, error: '연도, 작정자명, 작정금액은 필수입니다' },
        { status: 400 }
      );
    }

    // type 유효성 검사
    const validTypes = ['건축헌금', '선교헌금'];
    const pledgeType = validTypes.includes(type) ? type : '건축헌금';

    const now = getKSTDateTime();
    const id = await addPledgeDonation({
      year: Number(year),
      type: pledgeType,
      donor_name,
      representative: representative || donor_name,
      pledged_amount: Number(pledged_amount),
      note: note || '',
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      message: '작정헌금이 등록되었습니다',
      data: { id },
    });
  } catch (error) {
    console.error('Pledge add error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// PATCH: 작정헌금 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, pledged_amount, note } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID는 필수입니다' },
        { status: 400 }
      );
    }

    await updatePledgeDonation(id, {
      pledged_amount: Number(pledged_amount),
      note: note || '',
      updated_at: getKSTDateTime(),
    });

    return NextResponse.json({
      success: true,
      message: '작정헌금이 수정되었습니다',
    });
  } catch (error) {
    console.error('Pledge update error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// DELETE: 작정헌금 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID는 필수입니다' },
        { status: 400 }
      );
    }

    await deletePledgeDonation(id);

    return NextResponse.json({
      success: true,
      message: '작정헌금이 삭제되었습니다',
    });
  } catch (error) {
    console.error('Pledge delete error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
