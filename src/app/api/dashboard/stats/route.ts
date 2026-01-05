import { NextResponse } from 'next/server';
import {
  getIncomeRecords,
  getExpenseRecords,
  getUnmatchedBankTransactions,
  getUnmatchedCardTransactions,
  getBankTransactions,
} from '@/lib/google-sheets';

export async function GET() {
  try {
    // 이번 주 날짜 범위 계산 (월요일 ~ 일요일)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kst.getDay();
    const monday = new Date(kst);
    monday.setDate(kst.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split('T')[0];
    const endDate = sunday.toISOString().split('T')[0];

    // 데이터 조회
    const [incomeRecords, expenseRecords, unmatchedBank, unmatchedCard, bankTransactions] = await Promise.all([
      getIncomeRecords(startDate, endDate),
      getExpenseRecords(startDate, endDate),
      getUnmatchedBankTransactions(),
      getUnmatchedCardTransactions(),
      getBankTransactions(),
    ]);

    // 주간 수입/지출 합계
    const weeklyIncome = incomeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const weeklyExpense = expenseRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 현재 잔액 (은행원장의 마지막 잔액)
    const sortedBank = bankTransactions
      .filter(t => t.balance > 0)
      .sort((a, b) => {
        if (a.transaction_date === b.transaction_date) {
          return (b.time || '').localeCompare(a.time || '');
        }
        return b.transaction_date.localeCompare(a.transaction_date);
      });
    const balance = sortedBank[0]?.balance || 0;

    // 미분류 거래 수
    const unmatchedCount = unmatchedBank.length + unmatchedCard.length;

    return NextResponse.json({
      weeklyIncome,
      weeklyExpense,
      balance,
      unmatchedCount,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({
      weeklyIncome: 0,
      weeklyExpense: 0,
      balance: 0,
      unmatchedCount: 0,
    });
  }
}
