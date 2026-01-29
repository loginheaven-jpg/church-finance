import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getCardExpenseTemp,
  updateCardExpenseTempItem,
} from '@/lib/google-sheets';
import {
  FinanceSession,
  SESSION_COOKIE_NAME,
  hasRole,
} from '@/lib/auth/finance-permissions';
import type { CardExpenseTempRecord } from '@/types';

// 현재 세션 가져오기 헬퍼
async function getSession(): Promise<FinanceSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) return null;
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

// GET: 임시 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터에서 필터 조건 추출
    const { searchParams } = new URL(request.url);
    const vendorFilter = searchParams.get('vendor');
    const statusFilter = searchParams.get('status') || 'pending'; // 기본값 pending

    // 임시 데이터 조회
    let records = await getCardExpenseTemp();

    // 상태 필터 적용
    if (statusFilter !== 'all') {
      records = records.filter((r) => r.status === statusFilter);
    }

    // 권한별 데이터 필터링
    if (hasRole(session.finance_role, 'super_admin')) {
      // super_admin: 전체 데이터, 선택적 보유자 필터
      if (vendorFilter) {
        records = records.filter((r) => r.vendor === vendorFilter);
      }
    } else {
      // 그 외: 본인 카드만 (vendor === session.name)
      records = records.filter((r) => r.vendor === session.name);
    }

    // 매칭 정보 추출 (첫 번째 레코드에서)
    const matchingRecord = records.length > 0 && records[0].matching_record_id
      ? {
          id: records[0].matching_record_id,
          date: records[0].matching_record_date,
          amount: records[0].matching_record_amount,
        }
      : null;

    // 총액 계산
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

    // 보유자별 입력현황 (super_admin용)
    const vendorStats: Record<string, { total: number; completed: number }> = {};
    if (hasRole(session.finance_role, 'super_admin')) {
      const allPendingRecords = await getCardExpenseTemp();
      allPendingRecords
        .filter((r) => r.status === 'pending')
        .forEach((r) => {
          if (!vendorStats[r.vendor]) {
            vendorStats[r.vendor] = { total: 0, completed: 0 };
          }
          vendorStats[r.vendor].total++;
          if (r.description && r.account_code !== null) {
            vendorStats[r.vendor].completed++;
          }
        });
    }

    return NextResponse.json({
      success: true,
      records,
      matchingRecord,
      totalAmount,
      vendorStats: hasRole(session.finance_role, 'super_admin') ? vendorStats : undefined,
    });
  } catch (error) {
    console.error('Card expense temp GET error:', error);
    return NextResponse.json(
      { success: false, error: '임시 데이터 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PATCH: 임시 데이터 수정 (description, account_code)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tempId, description, account_code } = body;

    if (!tempId) {
      return NextResponse.json(
        { success: false, error: 'tempId가 필요합니다' },
        { status: 400 }
      );
    }

    // 해당 레코드 조회
    const records = await getCardExpenseTemp();
    const targetRecord = records.find((r) => r.tempId === tempId);

    if (!targetRecord) {
      return NextResponse.json(
        { success: false, error: '해당 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인: super_admin은 전체, 그 외는 본인 카드만
    if (!hasRole(session.finance_role, 'super_admin')) {
      if (targetRecord.vendor !== session.name) {
        return NextResponse.json(
          { success: false, error: '본인 카드 내역만 수정할 수 있습니다' },
          { status: 403 }
        );
      }
    }

    // 업데이트
    const updates: Partial<CardExpenseTempRecord> = {};
    if (description !== undefined) updates.description = description;
    if (account_code !== undefined) updates.account_code = account_code;

    await updateCardExpenseTempItem(tempId, updates);

    return NextResponse.json({
      success: true,
      message: '수정되었습니다',
    });
  } catch (error) {
    console.error('Card expense temp PATCH error:', error);
    return NextResponse.json(
      { success: false, error: '임시 데이터 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
