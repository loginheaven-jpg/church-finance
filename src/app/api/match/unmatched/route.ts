import { NextResponse } from 'next/server';
import { getUnmatchedBankTransactions, getUnmatchedCardTransactions, getMatchingRules } from '@/lib/google-sheets';
import { requireSession } from '@/lib/auth/require-session';

export async function GET() {
  try {
    // 매칭(admin)과 카드통합(member) 양쪽에서 호출 → 최소 공통인 로그인만 요구
    const guard = await requireSession();
    if (guard.response) return guard.response;

    const [bankTransactions, cardTransactions, rules] = await Promise.all([
      getUnmatchedBankTransactions(),
      getUnmatchedCardTransactions(),
      getMatchingRules(),
    ]);

    // 각 거래에 대해 매칭 제안 추가
    const bankWithSuggestions = bankTransactions.map(tx => {
      const searchText = `${tx.description || ''} ${tx.detail || ''} ${tx.memo || ''}`.toLowerCase();
      const suggestions = rules
        .filter(rule => {
          const pattern = rule.pattern.toLowerCase();
          return searchText.includes(pattern) ||
            pattern.split(' ').some(word => searchText.includes(word));
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      return { ...tx, suggestions };
    });

    return NextResponse.json({
      success: true,
      bank: bankWithSuggestions,
      card: cardTransactions,
      total: bankTransactions.length + cardTransactions.length,
    });
  } catch (error) {
    console.error('Get unmatched error:', error);
    return NextResponse.json(
      { success: false, error: '미매칭 거래 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
