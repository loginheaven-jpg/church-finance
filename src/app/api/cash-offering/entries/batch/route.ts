import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  addCashOfferingEntry,
  getIncomeCodes,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';

interface BatchRow {
  donor_name: string;
  amount: number;
  code: number;
  note?: string;
}

// POST: 여러 헌금함 행을 일괄 추가 (부분 실패 허용)
// 응답: { success, savedCount, failed: [{index, error}] }
// 시트 자동 생성은 addCashOfferingEntry 내부에서 처리됨
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { date, rows } = body as { date: string; rows: BatchRow[] };
    if (!date || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'date와 rows 필요' }, { status: 400 });
    }

    // 코드 매핑은 한 번만 조회 (item/category_code 자동 채우기용)
    const codes = await getIncomeCodes();
    const failed: { index: number; error: string }[] = [];
    let savedCount = 0;

    // 순차 처리: appendToSheet 동시 호출 시 행 순서 보장 불가 + Google Sheets quota
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.donor_name || !row.amount || row.amount <= 0) {
          failed.push({ index: i, error: '필수 항목 누락 (헌금자/금액)' });
          continue;
        }
        const codeNum = Number(row.code) || 11;
        const codeInfo = codes.find(c => c.code === codeNum);
        const id = generateId('CASH');
        await addCashOfferingEntry({
          id,
          date,
          donor_name: row.donor_name.trim(),
          amount: Number(row.amount),
          code: codeNum,
          item: codeInfo?.item || '주일헌금',
          category_code: codeInfo?.category_code || 10,
          note: row.note || '',
          created_at: getKSTDateTime(),
          created_by: session.name,
          status: 'pending',
        });
        savedCount++;
      } catch (e) {
        console.error(`[cash-offering/entries/batch] row ${i} 실패:`, e);
        failed.push({ index: i, error: String((e as Error).message || e).slice(0, 200) });
      }
    }

    return NextResponse.json({ success: true, savedCount, failed });
  } catch (e) {
    console.error('[cash-offering/entries/batch POST]', e);
    return NextResponse.json({ error: '배치 저장 실패' }, { status: 500 });
  }
}
