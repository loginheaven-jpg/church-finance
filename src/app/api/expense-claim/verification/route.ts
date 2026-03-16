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

// 청구자명이 지출원장의 vendor 또는 description에 포함되는지 확인
function claimantMatchScore(claimant: string, vendor: string, description: string): number {
  if (!claimant || claimant.length < 2) return 0;
  const target = `${vendor} ${description}`.toLowerCase();
  return target.includes(claimant.toLowerCase()) ? 1 : 0;
}

// 두 날짜 사이의 일요일 횟수 계산
function countSundaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // 시작일 다음날부터
  while (current <= end) {
    if (current.getDay() === 0) count++; // 일요일 = 0
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// GET: 처리완료 지출청구 ↔ 지출원장 교차대조
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const claimantFilter = searchParams.get('claimant') || '';

    // 처리완료된 청구건 조회
    const claims = await getProcessedExpenseClaims(startDate, endDate);

    // 청구자명 필터
    const filteredClaims = claimantFilter
      ? claims.filter(c => c.claimant.includes(claimantFilter))
      : claims;

    if (filteredClaims.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          summary: {
            total: 0,
            matched: 0,
            pending: 0,
            missing: 0,
            totalAmount: 0,
            unmatchedAmount: 0,
          },
        },
      });
    }

    // 지출원장 조회 범위: 처리일 전후 21일 확장
    const processedDates = filteredClaims.map(c => c.processedDate).sort();
    const earliestDate = processedDates[0];
    const latestDate = processedDates[processedDates.length - 1];

    const expenseStart = new Date(earliestDate);
    expenseStart.setDate(expenseStart.getDate() - 21);
    const expenseEnd = new Date(latestDate);
    expenseEnd.setDate(expenseEnd.getDate() + 21);

    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
      // 1단계: 금액 완전일치 후보 필터
      const amountMatches = expenseRecords.filter(e => e.amount === claim.amount);

      const claimObj = {
        rowIndex: claim.rowIndex,
        claimDate: claim.claimDate,
        claimant: claim.claimant,
        amount: claim.amount,
        bankName: claim.bankName,
        accountNumber: claim.accountNumber,
        accountCode: claim.accountCode,
        description: claim.description,
        processedDate: claim.processedDate,
      };

      if (amountMatches.length === 0) {
        // 매칭 후보 없음 → 일요일 횟수로 상태 판정
        const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
        items.push({
          claim: claimObj,
          status: sundays >= 2 ? 'missing' : 'pending',
          matchedExpenses: [],
          matchScore: 0,
        });
        continue;
      }

      // 2단계: 각 후보에 점수 부여
      // 금액일치(40) + 청구자명매칭(25) + 날짜근접(25) + 내역유사(10) = 100
      const scored: MatchedExpense[] = amountMatches.map(e => {
        let score = 40; // 금액 일치 기본 40점

        // 청구자명 매칭 (25점)
        score += claimantMatchScore(claim.claimant, e.vendor, e.description) * 25;

        // 날짜 근접도 (25점) - 처리일 기준
        const baseDate = new Date(claim.processedDate || claim.claimDate);
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

      // 점수 내림차순 정렬, 상위 3개
      scored.sort((a, b) => b.score - a.score);
      const topCandidates = scored.slice(0, 3);
      const bestScore = topCandidates[0].score;

      let status: VerificationStatus;
      if (bestScore >= 65) {
        status = 'matched';
      } else {
        // 후보는 있지만 확신 부족 → 일요일 횟수로 판정
        const sundays = countSundaysBetween(claim.processedDate || claim.claimDate, todayStr);
        status = sundays >= 2 ? 'missing' : 'pending';
      }

      items.push({
        claim: claimObj,
        status,
        matchedExpenses: topCandidates,
        matchScore: bestScore,
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
