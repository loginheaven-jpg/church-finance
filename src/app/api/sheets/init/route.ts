import { NextResponse } from 'next/server';
import { initializeSheets } from '@/lib/google-sheets';

export async function POST() {
  try {
    await initializeSheets();

    return NextResponse.json({
      success: true,
      message: '시트가 초기화되었습니다',
    });
  } catch (error) {
    console.error('Sheets init error:', error);
    return NextResponse.json(
      { success: false, error: '시트 초기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
