import { NextRequest, NextResponse } from 'next/server';
import { getMemberByName } from '@/lib/supabase';
import { getDonorInfo } from '@/lib/google-sheets';

// GET: 이름으로 교인 정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요' },
        { status: 400 }
      );
    }

    // 1. Supabase 교적부에서 조회
    const memberInfo = await getMemberByName(name);

    if (memberInfo) {
      return NextResponse.json({
        success: true,
        data: {
          name: memberInfo.name,
          address: memberInfo.address || '',
          resident_id: memberInfo.resident_id || '',
          source: 'supabase',
        },
      });
    }

    // 2. Supabase에 없으면 Google Sheets 헌금자정보에서 조회
    const donorInfos = await getDonorInfo();
    const donorInfo = donorInfos.find(
      (d) => d.representative === name || d.donor_name === name
    );

    if (donorInfo) {
      return NextResponse.json({
        success: true,
        data: {
          name: donorInfo.representative || donorInfo.donor_name,
          address: donorInfo.address || '',
          resident_id: donorInfo.registration_number || '',
          source: 'google_sheets',
        },
      });
    }

    // 3. 둘 다 없으면 빈 데이터 반환 (신규 입력 가능)
    return NextResponse.json({
      success: true,
      data: {
        name: name,
        address: '',
        resident_id: '',
        source: 'not_found',
      },
    });
  } catch (error) {
    console.error('Member lookup error:', error);
    return NextResponse.json(
      { success: false, error: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
