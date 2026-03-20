import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { addExpenseClaim } from '@/lib/google-sheets';

interface GroupData {
  accountCode: string;
  amount: number;
  description: string;
  receiptPaths?: string[];  // 클라이언트에서 Supabase에 직접 업로드한 경로들
}

/**
 * 지출청구 제출 API
 * 파일은 클라이언트에서 Supabase에 직접 업로드 (signed URL 방식)
 * 이 API는 JSON body로 시트 기록만 처리
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const {
      claimDate,
      bankName,
      accountNumber: rawAccountNumber,
      accountHolder: rawAccountHolder,
      groups,
    } = body as {
      claimDate: string;
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      groups: GroupData[];
    };

    const accountNumber = (rawAccountNumber || '').replace(/[^0-9]/g, '');
    const accountHolder = (rawAccountHolder || session.name).trim();

    if (!claimDate || !bankName || !accountNumber) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요' }, { status: 400 });
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      return NextResponse.json({ error: '청구 항목이 없습니다' }, { status: 400 });
    }

    const claimIds: string[] = [];

    for (const group of groups) {
      if (!group.accountCode || !group.amount || group.amount <= 0) continue;

      const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 영수증 경로: 클라이언트에서 이미 업로드됨, 경로만 쉼표 구분으로 저장
      const receiptUrl = group.receiptPaths && group.receiptPaths.length > 0
        ? group.receiptPaths.join(',')
        : undefined;

      await addExpenseClaim({
        claimId,
        claimDate,
        claimant: session.name,
        accountCode: group.accountCode,
        amount: group.amount,
        description: group.description,
        accountNumber,
        accountHolder,
        bankName,
        receiptUrl,
      });

      claimIds.push(claimId);
    }

    return NextResponse.json({ success: true, claimIds });
  } catch (error) {
    console.error('Expense claim submit API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '지출청구 등록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
