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

interface VerificationItem {
  claim: {
    rowIndex: number;
    claimant: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountCode: string;
    description: string;
    processedDate: string;
  };
  status: 'matched' | 'unmatched' | 'ambiguous';
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
            unmatched: 0,
            ambiguous: 0,
            totalAmount: 0,
            unmatchedAmount: 0,
          },
        },
      });
    }

    // 지출원장 조회 범위: 처리일 전후 14일 확장
    const processedDates = filteredClaims.map(c => c.processedDate).sort();
    const earliestDate = processedDates[0];
    const latestDate = processedDates[processedDates.length - 1];

    const expenseStart = new Date(earliestDate);
    expenseStart.setDate(expenseStart.getDate() - 14);
    const expenseEnd = new Date(latestDate);
    expenseEnd.setDate(expenseEnd.getDate() + 14);

    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const expenseRecords = await getExpenseRecords(
      formatDate(expenseStart),
      formatDate(expenseEnd)
    );

    // 매칭 수행
    const items: VerificationItem[] = [];

    for (const claim of filteredClaims) {
      // 1단계: 금액 완전일치 후보 필터
      const amountMatches = expenseRecords.filter(e => e.amount === claim.amount);

      if (amountMatches.length === 0) {
        items.push({
          claim: {
            rowIndex: claim.rowIndex,
            claimant: claim.claimant,
            amount: claim.amount,
            bankName: claim.bankName,
            accountNumber: claim.accountNumber,
            accountCode: claim.accountCode,
            description: claim.description,
            processedDate: claim.processedDate,
          },
          status: 'unmatched',
          matchedExpenses: [],
          matchScore: 0,
        });
        continue;
      }

      // 2단계: 각 후보에 점수 부여
      const scored: MatchedExpense[] = amountMatches.map(e => {
        let score = 50; // 금액 일치 기본 50점

        // 날짜 근접도 (30점)
        const claimDate = new Date(claim.processedDate);
        const expenseDate = new Date(e.date);
        const diffDays = Math.abs(
          (claimDate.getTime() - expenseDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diffDays <= 7) score += 30;
        else if (diffDays <= 14) score += 15;

        // 내역 유사도 (20점)
        const textSim = calculateTextSimilarity(claim.description, e.description, e.vendor);
        score += Math.round(textSim * 20);

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

      let status: 'matched' | 'unmatched' | 'ambiguous';
      if (bestScore >= 70) {
        status = 'matched';
      } else {
        status = 'ambiguous';
      }

      items.push({
        claim: {
          rowIndex: claim.rowIndex,
          claimant: claim.claimant,
          amount: claim.amount,
          bankName: claim.bankName,
          accountNumber: claim.accountNumber,
          accountCode: claim.accountCode,
          description: claim.description,
          processedDate: claim.processedDate,
        },
        status,
        matchedExpenses: topCandidates,
        matchScore: bestScore,
      });
    }

    // 요약
    const matched = items.filter(i => i.status === 'matched').length;
    const unmatched = items.filter(i => i.status === 'unmatched').length;
    const ambiguous = items.filter(i => i.status === 'ambiguous').length;
    const totalAmount = items.reduce((sum, i) => sum + i.claim.amount, 0);
    const unmatchedAmount = items
      .filter(i => i.status === 'unmatched')
      .reduce((sum, i) => sum + i.claim.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary: {
          total: items.length,
          matched,
          unmatched,
          ambiguous,
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
