import { NextRequest, NextResponse } from 'next/server';
import { getDonorInfo } from '@/lib/google-sheets';

// GET: 헌금자 목록 조회 (공개 - 로그인 불필요, 이름만 반환)
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

    // 보안을 위해 이름 정보만 반환 (주민번호, 주소 등 민감정보 제외)
    const publicDonors = donors.map(d => ({
      representative: d.representative,
      donor_name: d.donor_name,
    }));

    return NextResponse.json({
      success: true,
      data: publicDonors,
    });
  } catch (error) {
    console.error('Get public donors error:', error);
    return NextResponse.json(
      { success: false, error: '헌금자 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
