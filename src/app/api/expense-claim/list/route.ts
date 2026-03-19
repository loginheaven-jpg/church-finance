import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { getAllExpenseClaims, getExpenseClaimsByClaimant } from '@/lib/google-sheets';

// 청구일 기준 경과한 일요일 횟수 계산
function countSundaysSince(claimDate: string): number {
  if (!claimDate) return 0;
  const start = new Date(claimDate);
  const now = new Date();
  if (isNaN(start.getTime())) return 0;
  let count = 0;
  const d = new Date(start);
  d.setDate(d.getDate() + 1); // 청구일 다음날부터 시작
  while (d <= now) {
    if (d.getDay() === 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getClaimStatus(processedDate: string, claimDate: string) {
  if (processedDate) return 'processed';
  const sundays = countSundaysSince(claimDate);
  if (sundays >= 2) return 'suspicious'; // 누락 의심
  return 'pending'; // 미처리 추정
}

export async function GET(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const isAdmin = hasRole(session.finance_role, 'admin');

    let claims;
    if (isAdmin) {
      claims = await getAllExpenseClaims({ startDate, endDate });
    } else {
      claims = await getExpenseClaimsByClaimant(session.name);
      // member는 날짜 필터 적용
      if (startDate) claims = claims.filter(c => c.claimDate >= startDate);
      if (endDate) claims = claims.filter(c => c.claimDate <= endDate);
    }

    const items = claims.map(claim => ({
      ...claim,
      status: getClaimStatus(claim.processedDate, claim.claimDate),
    }));

    return NextResponse.json({
      success: true,
      data: items,
      isAdmin,
    });
  } catch (error) {
    console.error('Expense claim list API error:', error);
    return NextResponse.json(
      { error: '지출청구 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
