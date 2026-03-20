import { NextRequest, NextResponse } from 'next/server';
import {
  getProcessedExpenseClaims,
  getExpenseRecords,
} from '@/lib/google-sheets';

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

interface VerificationItem {
  claim: {
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
  };
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

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    const claimDates = filteredClaims.map(c => c.claimDate).sort();
    const processedDates = filteredClaims.map(c => c.processedDate).sort();

    const expenseStart = new Date(claimDates[0]);
    expenseStart.setDate(expenseStart.getDate() - 7);
    const expenseEnd = new Date(processedDates[processedDates.length - 1]);
    expenseEnd.setDate(expenseEnd.getDate() + 14);

    const expenseRecords = await getExpenseRecords(
      formatDate(expenseStart),
      formatDate(expenseEnd)
    );

    // 오늘 날짜 (KST)
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = formatDate(kstNow);

    // 매칭 수행
    const items: VerificationItem[] = [];

    for (const claim of filteredClaims) {
      const holderName = claim.accountHolder || claim.claimant;

      // 검색 범위: claimDate - 7일 ~ processedDate + 14일
      const rangeStart = new Date(claim.claimDate);
      rangeStart.setDate(rangeStart.getDate() - 7);
      const rangeEnd = new Date(claim.processedDate || claim.claimDate);
      rangeEnd.setDate(rangeEnd.getDate() + 14);

      // 1단계: 금액 완전일치 + 날짜 범위 필터
      const amountMatches = expenseRecords.filter(e => {
        if (e.amount !== claim.amount) return false;
        const expDate = new Date(e.date);
        return expDate >= rangeStart && expDate <= rangeEnd;
      });

      const claimObj = {
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
      };

      if (amountMatches.length === 0) {
        // 금액 일치 후보 없음
        const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
        const rangeStr = `${formatDate(rangeStart)}~${formatDate(rangeEnd)}`;
        // 전체 지출부에서 금액 일치 건 수 (범위 밖 포함)
        const totalAmountHits = expenseRecords.filter(e => e.amount === claim.amount).length;
        let failReason = `금액 ${claim.amount.toLocaleString()}원 후보 0건 (검색범위: ${rangeStr})`;
        if (totalAmountHits > 0) {
          failReason += ` — 범위 밖에 ${totalAmountHits}건 존재`;
        }
        items.push({
          claim: claimObj,
          status: sundays >= 2 ? 'missing' : 'pending',
          matchedExpenses: [],
          matchScore: 0,
          failReason,
        });
        continue;
      }

      // 2단계: 점수 부여
      // 금액일치(40) + 이름매칭(25) + 날짜근접(25) + 내역유사(10) = 100
      const scored: MatchedExpense[] = amountMatches.map(e => {
        let score = 40;

        // 이름 매칭 (25점) — 청구자 또는 예금주
        const claimantScore = nameMatchScore(claim.claimant, e.vendor, e.description);
        const holderScore = holderName !== claim.claimant
          ? nameMatchScore(holderName, e.vendor, e.description)
          : 0;
        score += Math.max(claimantScore, holderScore) * 25;

        // 날짜 근접도 (25점) - 청구일 기준
        const baseDate = new Date(claim.claimDate);
        const expenseDate = new Date(e.date);
        const diffDays = Math.abs(
          (baseDate.getTime() - expenseDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diffDays <= 7) score += 25;
        else if (diffDays <= 14) score += 12;

        // 내역 유사도 (10점)
        const textSim = calculateTextSimilarity(claim.description, e.description, e.vendor);
        score += Math.round(textSim * 10);

        return {
          id: e.id,
          date: e.date,
          vendor: e.vendor,
          description: e.description,
          amount: e.amount,
          account_code: e.account_code,
          score,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const topCandidates = scored.slice(0, 3);
      const bestCandidate = topCandidates[0];
      const bestScore = bestCandidate.score;

      // 이름 매칭 여부 (청구자 또는 예금주)
      const claimantMatched = nameMatchScore(claim.claimant, bestCandidate.vendor, bestCandidate.description) > 0;
      const holderMatched = holderName !== claim.claimant
        ? nameMatchScore(holderName, bestCandidate.vendor, bestCandidate.description) > 0
        : false;
      const anyNameMatched = claimantMatched || holderMatched;

      let status: VerificationStatus;
      let failReason: string | undefined;

      if (bestScore >= 65 && anyNameMatched) {
        status = 'matched';
      } else {
        const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
        status = sundays >= 2 ? 'missing' : 'pending';

        // 실패 원인 생성
        const reasons: string[] = [];
        if (!anyNameMatched) {
          const vendorNames = [...new Set(topCandidates.map(c => c.vendor))].join(', ');
          if (holderName !== claim.claimant) {
            reasons.push(`이름 불일치 — 지출부: ${vendorNames} / 청구자: ${claim.claimant} / 예금주: ${holderName}`);
          } else {
            reasons.push(`이름 불일치 — 지출부: ${vendorNames} / 청구자: ${claim.claimant}`);
          }
        }
        if (bestScore < 65) {
          reasons.push(`점수 부족 (${bestScore}/65)`);
        }
        failReason = `금액 ${claim.amount.toLocaleString()}원 후보 ${amountMatches.length}건 — ${reasons.join(', ')}`;
      }

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
