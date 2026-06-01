import { NextRequest, NextResponse } from 'next/server';
import { getCashOfferingEntries, getDonorInfo, getIncomeRecords } from '@/lib/google-sheets';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';

// 중복 체크용 키 생성: date + donor_name + amount
function getDuplicateKey(date: string, donorName: string, amount: number): string {
  return `${date}|${donorName}|${amount}`;
}

// 헌금함입력 시트(신규)의 pending entries를 가져와 미리보기
// 기존 외부 구글시트 의존 제거 — '헌금함입력' 시트가 단일 원본
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '시작일과 종료일을 입력하세요' },
        { status: 400 }
      );
    }

    // 헌금함입력 시트에서 기간 + pending 필터
    const allEntries = await getCashOfferingEntries({ startDate, endDate });
    const pendingEntries = allEntries.filter(e => e.status === 'pending');

    if (pendingEntries.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        donorMap: {},
        existingKeys: [],
        message: '해당 기간에 원장 미반영 헌금함 입력이 없습니다',
      });
    }

    // CashOffering 호환 + rowIndex (sync 후 status 업데이트용)
    const cashOfferings = pendingEntries.map(e => ({
      rowIndex: e.rowIndex,
      date: e.date,
      source: '헌금함',
      donor_name: e.donor_name,
      amount: e.amount,
      code: e.code,
      item: e.item,
      category_code: e.category_code,
      note: e.note,
    }));

    // 헌금자정보 매핑 (donor_name → representative)
    const donorInfoList = await getDonorInfo();
    const donorMap: Record<string, string> = {};
    for (const info of donorInfoList) {
      if (info.donor_name && info.representative) {
        donorMap[info.donor_name] = info.representative;
      }
    }

    // 기존 수입부에서 헌금함 데이터 조회 (중복 체크용 — synced된 적 있는 동일 키 필터링)
    const existingIncomeRecords = await getIncomeRecords(startDate, endDate);
    const existingCashOfferings = existingIncomeRecords.filter(r => r.source === '헌금함');

    const existingKeys = new Set<string>();
    for (const record of existingCashOfferings) {
      const recordDate = record.transaction_date || record.date;
      const key = getDuplicateKey(recordDate, record.donor_name, record.amount);
      existingKeys.add(key);
    }

    return NextResponse.json({
      success: true,
      data: cashOfferings,
      donorMap,
      existingKeys: Array.from(existingKeys),
      message: `${cashOfferings.length}건의 미반영 헌금함 입력을 불러왔습니다`,
    });
  } catch (error) {
    console.error('Cash offering preview error:', error);
    return NextResponse.json(
      { success: false, error: '미리보기 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
