import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { setExpenseClaimManualConfirm } from '@/lib/google-sheets';

// 오늘 날짜 (KST, YYYY-MM-DD)
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

// POST: 수동확인 표시/취소 (M컬럼)
//   자동 대조로 못 잡는 잔여 건을 admin이 수동 확인. 감사기록 "YYYY-MM-DD|사용자".
//   body: { rowIndices: number[], cancel?: boolean }
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session?.name) {
      return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    }
    if (!hasRole(session.finance_role, 'admin')) {
      return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 });
    }

    const { rowIndices, cancel } = await request.json();
    if (!Array.isArray(rowIndices) || rowIndices.length === 0) {
      return NextResponse.json({ success: false, error: '행 번호가 필요합니다' }, { status: 400 });
    }
    const rows = rowIndices
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n > 1); // 헤더(1행) 보호
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '유효한 행 번호가 없습니다' }, { status: 400 });
    }

    const value = cancel ? '' : `${todayKST()}|${session.name}`;
    await setExpenseClaimManualConfirm(rows, value);

    return NextResponse.json({
      success: true,
      message: cancel ? `${rows.length}건 수동확인 취소됨` : `${rows.length}건 수동확인 처리됨`,
    });
  } catch (error) {
    console.error('수동확인 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: '수동확인 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
