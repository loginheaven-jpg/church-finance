import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { getAccountInfoByNamePublic } from '@/lib/google-sheets';

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
