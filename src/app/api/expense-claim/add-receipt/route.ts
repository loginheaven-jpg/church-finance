import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { getAllExpenseClaims, updateExpenseClaim } from '@/lib/google-sheets';

// PUT: 영수증 사후첨부 (admin 전체 / 본인 청구만)
// body: { rowIndex, newPaths: string[] }
export async function PUT(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session?.name) {
      return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    }
    const isAdmin = hasRole(session.finance_role, 'admin');

    const { rowIndex, newPaths } = await request.json() as {
      rowIndex: number;
      newPaths: string[];
    };
    if (!rowIndex || typeof rowIndex !== 'number' || !Array.isArray(newPaths) || newPaths.length === 0) {
      return NextResponse.json({ success: false, error: '필수 항목 누락' }, { status: 400 });
    }

    // 대상 청구 조회
    const all = await getAllExpenseClaims();
    const target = all.find(c => c.rowIndex === rowIndex);
    if (!target) {
      return NextResponse.json({ success: false, error: '대상 청구를 찾을 수 없습니다' }, { status: 404 });
    }

    // 본인이 아니고 admin도 아니면 거부
    if (!isAdmin && target.claimant !== session.name) {
      return NextResponse.json({ success: false, error: '본인 청구건만 영수증을 추가할 수 있습니다' }, { status: 403 });
    }

    // 기존 영수증 + 새 영수증 합치기
    const existing = (target.receiptUrl || '').split(',').map(s => s.trim()).filter(Boolean);
    const merged = [...existing, ...newPaths.map(p => p.trim()).filter(Boolean)];
    const newReceiptUrl = merged.join(',');

    // 사후첨부 태그를 description에 추가 (없으면)
    let newDescription = target.description || '';
    if (!newDescription.includes('※사후첨부')) {
      newDescription += ' (※사후첨부)';
    }

    await updateExpenseClaim(rowIndex, {
      receiptUrl: newReceiptUrl,
      description: newDescription,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('영수증 사후첨부 오류:', error);
    return NextResponse.json(
      { success: false, error: '영수증 추가 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
