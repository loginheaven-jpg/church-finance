import { NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { getIncomeRecords, getManualReceiptHistory } from '@/lib/google-sheets';
import { getMembersByNames } from '@/lib/supabase';
import { getFamilyGroup } from '@/lib/family-group';

interface MemberDetail {
  name: string;
  isRepresentative: boolean;
  amount: number;
  resident_id: string | null;
  address: string | null;
}

interface ExistingIssue {
  issue_number: string;
  representative: string;
  amount: number;
  resident_id: string;
  address: string;
  issued_at: string;
}

// GET: 본인 영수증 발급 상태 + 가족 구성원 정보
export async function GET() {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const year = new Date().getFullYear() - 1; // 전년도만
    const userName = session.name;

    // 가족 그룹 결정
    const familyGroup = await getFamilyGroup(userName);
    const isRepresentative = familyGroup.representative === userName;

    if (!isRepresentative) {
      return NextResponse.json({
        success: true,
        year,
        isRepresentative: false,
        representative: familyGroup.representative,
        members: [],
        totalAmount: 0,
        existingIssues: [],
      });
    }

    // 전년도 헌금 합산 (가족 전체)
    const familyMemberNames = familyGroup.members.map(m => m.name);
    const incomeRecords = await getIncomeRecords(`${year}-01-01`, `${year}-12-31`);

    const memberAmounts = new Map<string, number>();
    familyMemberNames.forEach(n => memberAmounts.set(n, 0));

    let totalAmount = 0;
    for (const r of incomeRecords) {
      // 가족 구성원의 헌금만 포함 (대표자 기준)
      if (r.representative === userName || familyMemberNames.includes(r.donor_name)) {
        const amt = Number(r.amount) || 0;
        totalAmount += amt;
        const key = r.donor_name;
        if (memberAmounts.has(key)) {
          memberAmounts.set(key, (memberAmounts.get(key) || 0) + amt);
        }
      }
    }

    // 각 구성원의 세금정보 조회
    const taxInfoMap = await getMembersByNames(familyMemberNames);

    const members: MemberDetail[] = familyGroup.members.map(m => ({
      name: m.name,
      isRepresentative: m.isRepresentative,
      amount: memberAmounts.get(m.name) || 0,
      resident_id: taxInfoMap.get(m.name)?.resident_id || null,
      address: taxInfoMap.get(m.name)?.address || null,
    }));

    // 기존 발급 이력 조회 (대표자 또는 가족 구성원 명의)
    const allHistory = await getManualReceiptHistory(year);
    const existingIssues: ExistingIssue[] = allHistory
      .filter(h => familyMemberNames.includes(h.representative))
      .map(h => ({
        issue_number: h.issue_number,
        representative: h.representative,
        amount: h.amount,
        resident_id: h.resident_id,
        address: h.address,
        issued_at: h.issued_at,
      }));

    return NextResponse.json({
      success: true,
      year,
      isRepresentative: true,
      representative: familyGroup.representative,
      members,
      totalAmount,
      existingIssues,
    });
  } catch (error) {
    console.error('[my-offering/receipt-status]', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
