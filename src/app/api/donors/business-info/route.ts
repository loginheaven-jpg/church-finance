import { NextRequest, NextResponse } from 'next/server';
import { getAllBusinessInfo, getBusinessInfoByName, searchBusinessInfo } from '@/lib/google-sheets';

// GET: 사업자정보 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('company_name');
    const keyword = searchParams.get('keyword');

    // 상호로 정확히 검색
    if (companyName) {
      const info = await getBusinessInfoByName(companyName);
      return NextResponse.json({
        success: true,
        data: info,
      });
    }

    // 키워드로 부분 검색 (자동완성)
    if (keyword !== null) {
      const results = await searchBusinessInfo(keyword);
      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    // 전체 목록
    const allInfo = await getAllBusinessInfo();
    return NextResponse.json({
      success: true,
      data: allInfo,
    });
  } catch (error) {
    console.error('Business info query error:', error);
    return NextResponse.json(
      { success: false, error: '사업자정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
