import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { getAccountInfoByNamePublic, updateAccountInfo } from '@/lib/google-sheets';

export async function GET() {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const accountInfo = await getAccountInfoByNamePublic(session.name);

    return NextResponse.json({
      success: true,
      data: accountInfo
        ? { bankName: accountInfo.bankName, accountNumber: accountInfo.accountNumber }
        : { bankName: '', accountNumber: '' },
    });
  } catch (error) {
    console.error('Account info API error:', error);
    return NextResponse.json(
      { error: '계좌 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PUT: 기본계좌 변경
export async function PUT(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { bankName, accountNumber } = await request.json();
    if (!bankName || !accountNumber) {
      return NextResponse.json({ error: '은행명과 계좌번호가 필요합니다' }, { status: 400 });
    }

    const updated = await updateAccountInfo(session.name, bankName, accountNumber);
    if (!updated) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account info update error:', error);
    return NextResponse.json(
      { error: '계좌 정보 변경 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
