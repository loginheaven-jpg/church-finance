import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  getCashOfferingEntries,
  addCashOfferingEntry,
  updateCashOfferingEntry,
  deleteCashOfferingEntry,
  getIncomeCodes,
  updateIncomeRecord,
  deleteIncomeRecord,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';

// GET ?date=YYYY-MM-DD : 해당 주일 입력 내역
export async function GET(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;
  try {
    const entries = await getCashOfferingEntries({ date });
    return NextResponse.json({ success: true, entries });
  } catch (e) {
    console.error('[cash-offering/entries GET]', e);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

// POST: 신규 행 추가
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { date, donor_name, amount, code, note } = body;
    if (!date || !donor_name || !amount || amount <= 0) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }
    const codes = await getIncomeCodes();
    const codeInfo = codes.find(c => c.code === Number(code));
    const id = generateId('CASH');
    await addCashOfferingEntry({
      id,
      date,
      donor_name: donor_name.trim(),
      amount: Number(amount),
      code: Number(code) || 11,
      item: codeInfo?.item || '주일헌금',
      category_code: codeInfo?.category_code || 10,
      note: note || '',
      created_at: getKSTDateTime(),
      created_by: session.name,
      status: 'pending',
    });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('[cash-offering/entries POST]', e);
    return NextResponse.json({ error: '추가 실패' }, { status: 500 });
  }
}

// PATCH: 수정 (synced이면 수입부 INC도 동시 수정)
export async function PATCH(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { rowIndex, ...updates } = body;
    if (!rowIndex) return NextResponse.json({ error: 'rowIndex 필요' }, { status: 400 });

    // 기존 항목 조회 (synced 여부 + INC ID)
    const allEntries = await getCashOfferingEntries();
    const target = allEntries.find(e => e.rowIndex === rowIndex);
    if (!target) return NextResponse.json({ error: '대상 없음' }, { status: 404 });

    // 코드 변경 시 item/category_code 자동 갱신
    let finalUpdates = { ...updates };
    if (updates.code !== undefined) {
      const codes = await getIncomeCodes();
      const codeInfo = codes.find(c => c.code === Number(updates.code));
      if (codeInfo) {
        finalUpdates = {
          ...finalUpdates,
          item: codeInfo.item,
          category_code: codeInfo.category_code,
        };
      }
    }
    finalUpdates.updated_at = getKSTDateTime();

    await updateCashOfferingEntry(rowIndex, finalUpdates);

    // synced이면 수입부도 동시 수정
    let syncedIncUpdated = false;
    if (target.status === 'synced' && target.synced_to_inc_id) {
      try {
        const incUpdates: Record<string, unknown> = {};
        if (finalUpdates.donor_name !== undefined) incUpdates.donor_name = finalUpdates.donor_name;
        if (finalUpdates.amount !== undefined) incUpdates.amount = Number(finalUpdates.amount);
        if (finalUpdates.code !== undefined) incUpdates.offering_code = Number(finalUpdates.code);
        if (finalUpdates.note !== undefined) incUpdates.note = finalUpdates.note;
        if (Object.keys(incUpdates).length > 0) {
          await updateIncomeRecord(target.synced_to_inc_id, incUpdates);
          syncedIncUpdated = true;
        }
      } catch (incErr) {
        console.error('[cash-offering/entries PATCH] INC 수정 실패:', incErr);
      }
    }
    return NextResponse.json({ success: true, syncedIncUpdated });
  } catch (e) {
    console.error('[cash-offering/entries PATCH]', e);
    return NextResponse.json({ error: '수정 실패' }, { status: 500 });
  }
}

// DELETE ?rowIndex=N : 삭제 (synced이면 수입부 INC도 동시 삭제)
export async function DELETE(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const rowIndex = parseInt(searchParams.get('rowIndex') || '0');
    if (!rowIndex) return NextResponse.json({ error: 'rowIndex 필요' }, { status: 400 });

    const allEntries = await getCashOfferingEntries();
    const target = allEntries.find(e => e.rowIndex === rowIndex);
    if (!target) return NextResponse.json({ error: '대상 없음' }, { status: 404 });

    await deleteCashOfferingEntry(rowIndex);

    let syncedIncDeleted = false;
    if (target.status === 'synced' && target.synced_to_inc_id) {
      try {
        await deleteIncomeRecord(target.synced_to_inc_id);
        syncedIncDeleted = true;
      } catch (incErr) {
        console.error('[cash-offering/entries DELETE] INC 삭제 실패:', incErr);
      }
    }
    return NextResponse.json({ success: true, syncedIncDeleted });
  } catch (e) {
    console.error('[cash-offering/entries DELETE]', e);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}
