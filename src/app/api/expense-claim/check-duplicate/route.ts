import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { getAllExpenseClaims } from '@/lib/google-sheets';

// 근접 날짜 판정 창 (일). 청구일 기준 ± 이 값 이내면 "근접"으로 본다.
const WINDOW_DAYS = 14;

function diffDays(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return Infinity;
  return Math.abs((da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000));
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 이름 비교 정규화 (공백/표기차 흡수) — 시트 저장값이 trim 안 돼 있을 수 있음
const normName = (s: string) => String(s || '').replace(/\s+/g, '');

// POST: 제출 전 중복 상신 사전 점검
//   같은 청구자 + 동일 금액 + 청구일 근접(±WINDOW_DAYS) 기존 청구건을 반환.
//   (경고용 — 실패해도 제출을 막지 않도록 항상 success 반환)
export async function POST(request: NextRequest) {
  try {
    const session = await getFinanceSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const claimant = String(body.claimant || '').trim();
    const claimDate = String(body.claimDate || '').trim();
    const amounts: number[] = Array.isArray(body.amounts)
      ? body.amounts.map((n: unknown) => Number(n) || 0).filter((n: number) => n > 0)
      : [];

    if (!claimant || !claimDate || amounts.length === 0) {
      return NextResponse.json({ success: true, duplicates: [] });
    }

    // 제출 경로 지연 최소화: 청구일 ±30일로 조회범위를 좁혀 시트 스캔/계좌 lookup 축소
    const cd = new Date(claimDate);
    let existing;
    if (isNaN(cd.getTime())) {
      existing = await getAllExpenseClaims();
    } else {
      const ws = new Date(cd); ws.setDate(ws.getDate() - 30);
      const we = new Date(cd); we.setDate(we.getDate() + 30);
      existing = await getAllExpenseClaims({ startDate: fmtDate(ws), endDate: fmtDate(we) });
    }

    const amountSet = new Set(amounts);
    const claimantNorm = normName(claimant);

    const duplicates = existing
      .filter(c => normName(c.claimant) === claimantNorm && amountSet.has(c.amount) && diffDays(c.claimDate, claimDate) <= WINDOW_DAYS)
      .map(c => ({
        amount: c.amount,
        claimDate: c.claimDate,
        description: c.description,
        accountCode: c.accountCode,
        processedDate: c.processedDate,
      }))
      .sort((a, b) => (a.claimDate < b.claimDate ? 1 : -1)); // 최신 청구일 우선

    return NextResponse.json({ success: true, duplicates });
  } catch (error) {
    console.error('중복 상신 점검 오류:', error);
    // 점검 실패가 제출을 막지 않도록 빈 결과 반환
    return NextResponse.json({ success: true, duplicates: [] });
  }
}
