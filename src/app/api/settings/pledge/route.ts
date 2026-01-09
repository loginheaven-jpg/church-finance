import { NextRequest, NextResponse } from 'next/server';
import {
  getPledgeDonations,
  addPledgeDonation,
  updatePledgeDonation,
  deletePledgeDonation,
  getIncomeRecords,
  getKSTDateTime,
} from '@/lib/google-sheets';

// GET: 작정헌금 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const withFulfillment = searchParams.get('withFulfillment') === 'true';

    const pledges = year
      ? await getPledgeDonations(Number(year))
      : await getPledgeDonations();

    if (withFulfillment && year) {
      // 실행금액 계산
      const incomeRecords = await getIncomeRecords(`${year}-01-01`, `${year}-12-31`);

      const pledgesWithFulfillment = pledges.map(pledge => {
        // 해당 헌금자의 헌금 합계 (십일조 제외, 작정헌금 대상 코드만)
        const fulfilled = incomeRecords
          .filter(r =>
            (r.representative === pledge.representative || r.donor_name === pledge.donor_name) &&
            r.offering_code !== 12 // 십일조 제외
          )
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        return {
          ...pledge,
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

    return NextResponse.json({
      success: true,
      data: pledges,
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
    const { year, donor_name, representative, pledged_amount, note } = body;

    if (!year || !donor_name || !pledged_amount) {
      return NextResponse.json(
        { success: false, error: '연도, 작정자명, 작정금액은 필수입니다' },
        { status: 400 }
      );
    }

    const now = getKSTDateTime();
    const id = await addPledgeDonation({
      year: Number(year),
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
