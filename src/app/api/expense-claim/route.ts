import { NextRequest, NextResponse } from 'next/server';
import {
  getUnprocessedExpenseClaims,
  markExpenseClaimsAsProcessed,
  getKSTDate,
} from '@/lib/google-sheets';

// GET: 미처리 지출청구 목록 조회
export async function GET() {
  try {
    const claims = await getUnprocessedExpenseClaims();

    return NextResponse.json({
      success: true,
      data: claims,
      count: claims.length,
    });
  } catch (error) {
    console.error('지출청구 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '지출청구 데이터를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST: 지출청구 처리 완료 (K컬럼에 날짜 기입)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowIndices } = body;

    if (!rowIndices || !Array.isArray(rowIndices) || rowIndices.length === 0) {
      return NextResponse.json(
        { success: false, error: '처리할 행 번호가 없습니다' },
        { status: 400 }
      );
    }

    // 오늘 날짜 (KST)
    const processedDate = getKSTDate();

    await markExpenseClaimsAsProcessed(rowIndices, processedDate);

    return NextResponse.json({
      success: true,
      message: `${rowIndices.length}건의 지출청구가 처리 완료되었습니다`,
      processedDate,
    });
  } catch (error) {
    console.error('지출청구 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '지출청구 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
