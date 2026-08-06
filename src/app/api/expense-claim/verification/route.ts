import { NextRequest, NextResponse } from 'next/server';
import {
  getProcessedExpenseClaims,
  getExpenseRecords,
} from '@/lib/google-sheets';

// 날짜 정규화: "2026. 5. 24" → "2026-05-24", 이미 정규형이면 그대로
function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = String(d).trim();
  const m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

interface MatchedExpense {
  id: string;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  account_code: number;
  score: number;
}

type VerificationStatus = 'matched' | 'pending' | 'missing';

interface ClaimObj {
  rowIndex: number;
  claimDate: string;
  claimant: string;
  accountHolder: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountCode: string;
  description: string;
  processedDate: string;
}

interface VerificationItem {
  claim: ClaimObj;
  status: VerificationStatus;
  matchedExpenses: MatchedExpense[];
  matchScore: number;
  failReason?: string; // 매칭 실패 원인
}

// 내역 키워드 유사도 계산 (0~1)
function calculateTextSimilarity(claimDesc: string, expenseDesc: string, vendor: string): number {
  if (!claimDesc) return 0;
  const claimTokens = claimDesc.split(/[\s,./]+/).filter(t => t.length > 1);
  if (claimTokens.length === 0) return 0;

  const target = `${expenseDesc} ${vendor}`.toLowerCase();
  let matchCount = 0;
  for (const token of claimTokens) {
    if (target.includes(token.toLowerCase())) {
      matchCount++;
    }
  }
  return matchCount / claimTokens.length;
}

// 이름이 지출원장의 vendor 또는 description에 포함되는지 확인
function nameMatchScore(name: string, vendor: string, description: string): number {
  if (!name || name.length < 2) return 0;
  const target = `${vendor} ${description}`.toLowerCase();
  return target.includes(name.toLowerCase()) ? 1 : 0;
}

// 두 날짜 사이의 일요일 횟수 계산
function countSundaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1);
  while (current <= end) {
    if (current.getDay() === 0) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// 지출부 거래일과 기준일(들) 사이 최소 일수 차 (청구일/처리일 중 가까운 쪽)
function minDiffDays(expDateStr: string, bases: (string | undefined | null)[]): number {
  const exp = new Date(normalizeDateStr(expDateStr));
  if (isNaN(exp.getTime())) return Infinity;
  let min = Infinity;
  for (const b of bases) {
    if (!b) continue;
    const bd = new Date(normalizeDateStr(b));
    if (isNaN(bd.getTime())) continue;
    const d = Math.abs((exp.getTime() - bd.getTime()) / (24 * 60 * 60 * 1000));
    if (d < min) min = d;
  }
  return min;
}

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 매칭 임계 점수 (금액 40 + 이름 25 + 날짜 20 + 내역 15 = 100)
//   금액+이름 = 65(임계) 유지로 기존 매칭 회귀 방지. 내역 가중은 10→15로 상향(동일금액 구분력).
const MATCH_THRESHOLD = 65;

// GET: 처리완료 지출청구 ↔ 지출원장 교차대조
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const claimantFilter = searchParams.get('claimant') || '';

    // 처리완료된 청구건 조회
    const claims = await getProcessedExpenseClaims(startDate, endDate);

    const filteredClaims = claimantFilter
      ? claims.filter(c => c.claimant.includes(claimantFilter))
      : claims;

    if (filteredClaims.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          summary: { total: 0, matched: 0, pending: 0, missing: 0, totalAmount: 0, unmatchedAmount: 0 },
        },
      });
    }

    // 지출원장 조회 범위: 청구일(가장 빠른) - 7일 ~ 처리일(가장 늦은) + 14일
    // (안 2026-08) 비정상/빈 날짜는 제외하고 min/max — 한 건의 잘못된 날짜가 배치 전체 조회범위를 깨지 않도록.
    const toValidMs = (d: string) => {
      const t = new Date(normalizeDateStr(d)).getTime();
      return isNaN(t) ? null : t;
    };
    const validClaimMs = filteredClaims
      .map(c => toValidMs(c.claimDate))
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);
    const validProcessedMs = filteredClaims
      .map(c => toValidMs(c.processedDate))
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);

    const kstNowMs = Date.now() + 9 * 60 * 60 * 1000;
    const earliestClaimMs = validClaimMs.length
      ? validClaimMs[0]
      : (validProcessedMs.length ? validProcessedMs[0] : kstNowMs);
    const latestProcessedMs = validProcessedMs.length
      ? validProcessedMs[validProcessedMs.length - 1]
      : (validClaimMs.length ? validClaimMs[validClaimMs.length - 1] : kstNowMs);

    const expenseStart = new Date(earliestClaimMs);
    expenseStart.setDate(expenseStart.getDate() - 7);
    const expenseEnd = new Date(latestProcessedMs);
    expenseEnd.setDate(expenseEnd.getDate() + 14);

    const expenseRecords = await getExpenseRecords(
      formatDate(expenseStart),
      formatDate(expenseEnd)
    );

    // 오늘 날짜 (KST)
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = formatDate(kstNow);

    // === 매칭: 2단계 (후보 점수화 → 전역 1:1 배정) ===
    // 안 (2026-08): 지출부 1건이 여러 청구에 중복 매칭되던 문제(같은 청구자·금액 근접일 → 8/6이 8/3 기록을
    //   빌려 최종확인 오표시)를 전역 1:1 배정으로 해소. 지출부 레코드는 청구 1건에만 소비된다.
    //   또한 내역 가중 상향(10→20) + 날짜 판별을 청구일/처리일 최근접으로 강화해 동일금액 건 구분력 향상.

    interface ClaimCandidate {
      expenseIdx: number;
      matched: MatchedExpense;
      nameMatched: boolean;
      dd: number; // 지출부 거래일 ~ 청구일/처리일 최소 일수차 (동점 tie-break용)
    }

    // 1단계: 청구별 후보 점수화
    const claimObjs: ClaimObj[] = [];
    const claimCandidates: ClaimCandidate[][] = [];

    for (const claim of filteredClaims) {
      const holderName = claim.accountHolder || claim.claimant;
      const rangeStart = new Date(normalizeDateStr(claim.claimDate));
      rangeStart.setDate(rangeStart.getDate() - 7);
      const rangeEnd = new Date(normalizeDateStr(claim.processedDate || claim.claimDate));
      rangeEnd.setDate(rangeEnd.getDate() + 14);

      claimObjs.push({
        rowIndex: claim.rowIndex,
        claimDate: claim.claimDate,
        claimant: claim.claimant,
        accountHolder: holderName,
        amount: claim.amount,
        bankName: claim.bankName,
        accountNumber: claim.accountNumber,
        accountCode: claim.accountCode,
        description: claim.description,
        processedDate: claim.processedDate,
      });

      const cands: ClaimCandidate[] = [];
      expenseRecords.forEach((e, idx) => {
        if (e.amount !== claim.amount) return;
        const expDate = new Date(normalizeDateStr(e.date));
        if (isNaN(expDate.getTime())) return;
        if (expDate < rangeStart || expDate > rangeEnd) return;

        // 점수: 금액 40 + 이름 25 + 날짜 20 + 내역 15 = 100
        let score = 40;
        const claimantScore = nameMatchScore(claim.claimant, e.vendor, e.description);
        const holderScore = holderName !== claim.claimant
          ? nameMatchScore(holderName, e.vendor, e.description)
          : 0;
        const nameScore = Math.max(claimantScore, holderScore);
        score += nameScore * 25;

        // 날짜 근접도 — 지출부 실제 거래일(txd, 없으면 주일 date)과 청구일/처리일 중 가까운 쪽.
        //   연속 함수(20-일수)로 계산해 ±7일 내부에서도 구분력 확보(동일금액·근접 청구 판별).
        const dd = minDiffDays(e.transaction_date || e.date, [claim.claimDate, claim.processedDate]);
        const dateScore = dd === Infinity ? 0 : Math.max(0, 20 - Math.round(dd));
        score += dateScore;

        // 내역 유사도 (가중 상향 10→15) — 내역이 다르면 오매칭 억제, greedy에서 올바른 짝 우선
        const textSim = calculateTextSimilarity(claim.description, e.description, e.vendor);
        score += Math.round(textSim * 15);

        cands.push({
          expenseIdx: idx,
          nameMatched: nameScore > 0,
          dd,
          matched: {
            id: e.id,
            date: e.date,
            vendor: e.vendor,
            description: e.description,
            amount: e.amount,
            account_code: e.account_code,
            score,
          },
        });
      });
      cands.sort((a, b) => b.matched.score - a.matched.score);
      claimCandidates.push(cands);
    }

    // 2단계: 전역 1:1 배정 (임계 통과 + 이름일치 쌍만, 점수 내림차순 greedy)
    interface Pair { ci: number; expenseIdx: number; score: number; dd: number; matched: MatchedExpense; }
    const pairs: Pair[] = [];
    claimCandidates.forEach((cands, ci) => {
      for (const c of cands) {
        if (c.matched.score >= MATCH_THRESHOLD && c.nameMatched) {
          pairs.push({ ci, expenseIdx: c.expenseIdx, score: c.matched.score, dd: c.dd, matched: c.matched });
        }
      }
    });
    // 점수 내림차순 → 동점 시 날짜 근접(dd) 오름차순 → 청구 인덱스 오름차순. 결정성 + 근접 청구 우선.
    pairs.sort((a, b) => (b.score - a.score) || (a.dd - b.dd) || (a.ci - b.ci));
    const assignedClaim = new Map<number, Pair>();
    const usedExpense = new Set<number>();
    for (const p of pairs) {
      if (assignedClaim.has(p.ci) || usedExpense.has(p.expenseIdx)) continue;
      assignedClaim.set(p.ci, p);
      usedExpense.add(p.expenseIdx);
    }
    // 2차 패스: greedy가 남긴 미배정 청구를 아직 미사용인 자기 후보 지출부에 재시도.
    //   (청구별 날짜창 비대칭으로 최대매칭을 놓치는 경우 근사 보정 — 배정을 놓쳐 정상 청구가 pending 되는 것 방지)
    for (let ci = 0; ci < claimCandidates.length; ci++) {
      if (assignedClaim.has(ci)) continue;
      for (const c of claimCandidates[ci]) {
        if (c.matched.score >= MATCH_THRESHOLD && c.nameMatched && !usedExpense.has(c.expenseIdx)) {
          assignedClaim.set(ci, { ci, expenseIdx: c.expenseIdx, score: c.matched.score, dd: c.dd, matched: c.matched });
          usedExpense.add(c.expenseIdx);
          break;
        }
      }
    }

    // 3단계: 결과 조립
    const items: VerificationItem[] = [];
    for (let ci = 0; ci < filteredClaims.length; ci++) {
      const claim = filteredClaims[ci];
      const claimObj = claimObjs[ci];
      const cands = claimCandidates[ci];
      const topCandidates = cands.slice(0, 3).map(c => c.matched);

      const assigned = assignedClaim.get(ci);
      if (assigned) {
        // 배정된 지출부를 최상단으로 정렬
        const ordered = [
          assigned.matched,
          ...topCandidates.filter(m => m.id !== assigned.matched.id),
        ].slice(0, 3);
        items.push({
          claim: claimObj,
          status: 'matched',
          matchedExpenses: ordered,
          matchScore: assigned.score,
        });
        continue;
      }

      // 미배정 → 사유 산출
      if (cands.length === 0) {
        const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
        const rangeStart = new Date(normalizeDateStr(claim.claimDate));
        rangeStart.setDate(rangeStart.getDate() - 7);
        const rangeEnd = new Date(normalizeDateStr(claim.processedDate || claim.claimDate));
        rangeEnd.setDate(rangeEnd.getDate() + 14);
        const rangeStr = `${formatDate(rangeStart)}~${formatDate(rangeEnd)}`;
        const totalAmountHits = expenseRecords.filter(e => e.amount === claim.amount).length;
        let failReason = `금액 ${claim.amount.toLocaleString()}원 후보 0건 (검색범위: ${rangeStr})`;
        if (totalAmountHits > 0) failReason += ` — 범위 밖에 ${totalAmountHits}건 존재`;
        items.push({
          claim: claimObj,
          status: sundays >= 2 ? 'missing' : 'pending',
          matchedExpenses: [],
          matchScore: 0,
          failReason,
        });
        continue;
      }

      const best = cands[0];
      const bestScore = best.matched.score;
      const bestNameMatched = best.nameMatched;
      // 임계(65)+이름일치 후보가 하나라도 있었는가 → 있으면 그 지출부가 다른 청구에 선점된 것(중복 상신 의심)
      const hadQualifying = cands.some(c => c.matched.score >= MATCH_THRESHOLD && c.nameMatched);
      const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
      const status: VerificationStatus = sundays >= 2 ? 'missing' : 'pending';

      const reasons: string[] = [];
      if (hadQualifying) {
        // 임계 통과 후보가 있었으나 지출부가 다른 청구에 우선 배정됨 = 중복 상신 의심
        reasons.push('동일 금액이 근접한 다른 청구건에 우선 배정됨 (중복 상신 여부 확인)');
      } else {
        if (!bestNameMatched) {
          const vendorNames = [...new Set(topCandidates.map(c => c.vendor))].join(', ');
          reasons.push(
            claimObj.accountHolder !== claim.claimant
              ? `이름 불일치 — 지출부: ${vendorNames} / 청구자: ${claim.claimant} / 예금주: ${claimObj.accountHolder}`
              : `이름 불일치 — 지출부: ${vendorNames} / 청구자: ${claim.claimant}`
          );
        }
        if (bestScore < MATCH_THRESHOLD) {
          reasons.push(`점수 부족 (${bestScore}/${MATCH_THRESHOLD})`);
        }
      }
      const failReason = `금액 ${claim.amount.toLocaleString()}원 후보 ${cands.length}건 — ${reasons.join(', ')}`;
      items.push({
        claim: claimObj,
        status,
        matchedExpenses: topCandidates,
        matchScore: bestScore,
        failReason,
      });
    }

    // 요약
    const matched = items.filter(i => i.status === 'matched').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const missing = items.filter(i => i.status === 'missing').length;
    const totalAmount = items.reduce((sum, i) => sum + i.claim.amount, 0);
    const unmatchedAmount = items
      .filter(i => i.status !== 'matched')
      .reduce((sum, i) => sum + i.claim.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary: {
          total: items.length,
          matched,
          pending,
          missing,
          totalAmount,
          unmatchedAmount,
        },
      },
    });
  } catch (error) {
    console.error('처리내역 점검 오류:', error);
    return NextResponse.json(
      { success: false, error: '처리내역 점검 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
