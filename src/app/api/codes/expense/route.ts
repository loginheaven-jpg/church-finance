import { NextResponse } from 'next/server';
import { getExpenseCodes } from '@/lib/google-sheets';

export async function GET() {
  try {
    const codes = await getExpenseCodes();

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error('Get expense codes error:', error);
    return NextResponse.json(
      { success: false, error: '지출부 코드 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
