import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import { getAllExpenseClaims, getExpenseRecords, markExpenseClaimsAsProcessed } from '@/lib/google-sheets';

// "2026. 5. 24" → "2026-05-24" 정규화
function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = String(d).trim();
  const m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

function nameMatch(name: string, vendor: string, description: string): boolean {
  if (!name || name.length < 2) return false;
  const target = `${vendor} ${description}`.toLowerCase();
  return target.includes(name.toLowerCase());
}

/**
 * POST: 미처리 청구건 자동 매칭 + K컬럼(처리일) 자동 채움
 * 청구일 -7일 ~ 청구일 +30일 범위에서 지출부 검색
 * 금액 일치 + 이름 매칭(청구자 또는 예금주) → 자동 처리
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다' }, { status: 401 });
    }
    if (!hasRole(session.finance_role, 'admin')) {
      return NextResponse.json({ success: false, error: 'admin 권한 필요' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const startDate = body.startDate || undefined;
    const endDate = body.endDate || undefined;

    const allClaims = await getAllExpenseClaims({ startDate, endDate });
    // 처리일(K컬럼) 비어있는 청구건만 자동 처리 대상
    const unprocessedClaims = allClaims.filter(c => !c.processedDate);

    if (unprocessedClaims.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: '미처리 청구건이 없습니다',
      });
    }

    // 지출부 전체 조회 (청구일 범위 + 여유분)
    const expRecords = await getExpenseRecords();

    const toMark: { rowIndex: number; matchedDate: string }[] = [];
    const skipped: { rowIndex: number; reason: string }[] = [];

    for (const claim of unprocessedClaims) {
      const claimDateNorm = normalizeDateStr(claim.claimDate);
      const baseDate = new Date(claimDateNorm);
      if (isNaN(baseDate.getTime())) {
        skipped.push({ rowIndex: claim.rowIndex, reason: '청구일 파싱 실패' });
        continue;
      }
      const rangeStart = new Date(baseDate);
      rangeStart.setDate(rangeStart.getDate() - 7);
      const rangeEnd = new Date(baseDate);
      rangeEnd.setDate(rangeEnd.getDate() + 30);

      // 금액 일치 + 날짜 범위 내 지출부 검색
      const candidates = expRecords.filter(e => {
        if (e.amount !== claim.amount) return false;
        const eDate = new Date(normalizeDateStr(e.date));
        if (isNaN(eDate.getTime())) return false;
        return eDate >= rangeStart && eDate <= rangeEnd;
      });

      if (candidates.length === 0) {
        skipped.push({ rowIndex: claim.rowIndex, reason: '금액 일치 후보 없음' });
        continue;
      }

      // 이름 매칭 (청구자 또는 예금주)
      const holder = claim.accountHolder?.trim() || claim.claimant;
      const matched = candidates.find(e =>
        nameMatch(claim.claimant, e.vendor, e.description) ||
        (holder !== claim.claimant && nameMatch(holder, e.vendor, e.description))
      );

      if (!matched) {
        skipped.push({
          rowIndex: claim.rowIndex,
          reason: `이름 불일치 — 지출부: ${candidates.map(c => c.vendor).join(',')} / 청구자: ${claim.claimant}`,
        });
        continue;
      }

      toMark.push({
        rowIndex: claim.rowIndex,
        matchedDate: normalizeDateStr(matched.date),
      });
    }

    if (toMark.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        skipped: skipped.length,
        skippedDetails: skipped,
        message: '자동 처리 가능한 청구건이 없습니다',
      });
    }

    // K컬럼 일괄 업데이트 (매칭된 지출부 거래의 date 사용)
    // markExpenseClaimsAsProcessed는 단일 날짜만 받으므로 날짜별로 그룹화
    const byDate = new Map<string, number[]>();
    for (const item of toMark) {
      const arr = byDate.get(item.matchedDate) || [];
      arr.push(item.rowIndex);
      byDate.set(item.matchedDate, arr);
    }

    for (const [date, rowIndices] of byDate) {
      await markExpenseClaimsAsProcessed(rowIndices, date);
    }

    return NextResponse.json({
      success: true,
      processed: toMark.length,
      skipped: skipped.length,
      skippedDetails: skipped.slice(0, 20), // 너무 많으면 일부만
    });
  } catch (error) {
    console.error('[auto-mark]', error);
    return NextResponse.json(
      { success: false, error: '자동 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
