import { NextRequest, NextResponse } from 'next/server';
import {
  getDonorInfo,
  addDonorInfo,
  updateDonorInfo,
  deleteDonorInfo,
} from '@/lib/google-sheets';
import type { DonorInfo } from '@/types';

// GET: 헌금자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase();

    let donors = await getDonorInfo();

    // 검색 필터
    if (search) {
      donors = donors.filter(
        (d) =>
          d.representative.toLowerCase().includes(search) ||
          d.donor_name.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: donors,
    });
  } catch (error) {
    console.error('Get donors error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: 헌금자 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const donor: DonorInfo = {
      representative: body.representative,
      donor_name: body.donor_name,
      relationship: body.relationship || '',
      registration_number: body.registration_number || '',
      address: body.address || '',
      phone: body.phone || '',
      email: body.email || '',
      note: body.note || '',
      created_at: new Date().toISOString(),
    };

    if (!donor.representative || !donor.donor_name) {
      return NextResponse.json(
        { success: false, error: '대표자명과 헌금자명은 필수입니다' },
        { status: 400 }
      );
    }

    await addDonorInfo(donor);

    return NextResponse.json({
      success: true,
      message: '헌금자가 추가되었습니다',
    });
  } catch (error) {
    console.error('Add donor error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PUT: 헌금자 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { representative, donor_name, updates } = body;

    if (!representative || !donor_name) {
      return NextResponse.json(
        { success: false, error: '대표자명과 헌금자명은 필수입니다' },
        { status: 400 }
      );
    }

    await updateDonorInfo(representative, donor_name, updates);

    return NextResponse.json({
      success: true,
      message: '헌금자 정보가 수정되었습니다',
    });
  } catch (error) {
    console.error('Update donor error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE: 헌금자 삭제
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const representative = searchParams.get('representative');
    const donor_name = searchParams.get('donor_name');

    if (!representative || !donor_name) {
      return NextResponse.json(
        { success: false, error: '대표자명과 헌금자명은 필수입니다' },
        { status: 400 }
      );
    }

    await deleteDonorInfo(representative, donor_name);

    return NextResponse.json({
      success: true,
      message: '헌금자가 삭제되었습니다',
    });
  } catch (error) {
    console.error('Delete donor error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
