import { NextResponse } from 'next/server';
import { getIncomeCodes } from '@/lib/google-sheets';

export async function GET() {
  try {
    const codes = await getIncomeCodes();

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error('Get income codes error:', error);
    return NextResponse.json(
      { success: false, error: '수입부 코드 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
