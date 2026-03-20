import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { getAllExpenseClaims, deleteExpenseClaimRow } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'expense-receipts';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { rowIndex, claimId } = await request.json() as { rowIndex: number; claimId?: string };

    if (!rowIndex || rowIndex < 2) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    // 해당 행 조회하여 권한 및 상태 확인
    const allClaims = await getAllExpenseClaims();
    const claim = allClaims.find(c => c.rowIndex === rowIndex);

    if (!claim) {
      return NextResponse.json({ error: '청구 건을 찾을 수 없습니다' }, { status: 404 });
    }

    // 권한 확인: 본인 건 또는 admin 이상
    const isAdmin = hasRole(session.finance_role, 'admin');
    if (!isAdmin && claim.claimant !== session.name) {
      return NextResponse.json({ error: '취소 권한이 없습니다' }, { status: 403 });
    }

    // 미처리 상태만 취소 가능
    if (claim.processedDate) {
      return NextResponse.json({ error: '이미 처리된 청구는 취소할 수 없습니다' }, { status: 400 });
    }

    // Supabase Storage 영수증 삭제 (쉼표 구분 복수 파일 지원)
    if (claim.receiptUrl && supabaseAdmin && !claim.receiptUrl.startsWith('http')) {
      const paths = claim.receiptUrl.split(',').map(p => p.trim()).filter(Boolean);
      if (paths.length > 0) {
        const { error: deleteFileError } = await supabaseAdmin.storage
          .from(BUCKET)
          .remove(paths);
        if (deleteFileError) {
          console.error('Receipt delete error:', deleteFileError);
          // 파일 삭제 실패는 경고만 (행 삭제는 진행)
        }
      }
    }

    // 시트에서 행 삭제
    await deleteExpenseClaimRow(rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Expense claim cancel API error:', error);
    return NextResponse.json(
      { error: '지출청구 취소 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
