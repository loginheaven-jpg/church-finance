import { NextRequest, NextResponse } from 'next/server';
import {
  addIncomeRecords,
  addExpenseRecords,
  updateBankTransaction,
} from '@/lib/google-sheets';
import { incrementRuleUsage } from '@/lib/matching-engine';
import type { BankTransaction, IncomeRecord, ExpenseRecord, MatchingRule } from '@/types';

interface MatchedIncomeItem {
  transaction: BankTransaction;
  record: IncomeRecord;
  match: MatchingRule | null;
}

interface MatchedExpenseItem {
  transaction: BankTransaction;
  record: ExpenseRecord;
  match: MatchingRule | null;
}

// 배치 확정 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      income,
      expense,
      suppressed,
    } = body as {
      income: MatchedIncomeItem[];
      expense: MatchedExpenseItem[];
      suppressed: BankTransaction[];
    };

    // 디버깅: 수신된 데이터 확인
    console.log('[match/confirm] 수신 데이터:', {
      incomeCount: income?.length || 0,
      expenseCount: expense?.length || 0,
      suppressedCount: suppressed?.length || 0,
      expenseRecords: expense?.map(e => ({
        id: e.record?.id,
        vendor: e.record?.vendor,
        amount: e.record?.amount,
        account_code: e.record?.account_code
      }))
    });

    let incomeCount = 0;
    let expenseCount = 0;
    let suppressedCount = 0;

    // 수입 레코드 저장
    if (income && income.length > 0) {
      const incomeRecords = income.map(item => item.record);
      await addIncomeRecords(incomeRecords);

      // 은행 거래 상태 업데이트 및 규칙 사용 횟수 증가
      for (const item of income) {
        await updateBankTransaction(item.transaction.id, {
          matched_status: 'matched',
          matched_type: 'income_detail',
          matched_ids: item.record.id,
        });

        if (item.match?.id) {
          await incrementRuleUsage(item.match.id);
        }
      }

      incomeCount = incomeRecords.length;
    }

    // 지출 레코드 저장
    if (expense && expense.length > 0) {
      const expenseRecords = expense.map(item => item.record);
      console.log('[match/confirm] 지출 레코드 저장 시작:', expenseRecords.length, '건');
      await addExpenseRecords(expenseRecords);
      console.log('[match/confirm] 지출 레코드 저장 완료');

      // 은행 거래 상태 업데이트 및 규칙 사용 횟수 증가
      for (const item of expense) {
        await updateBankTransaction(item.transaction.id, {
          matched_status: 'matched',
          matched_type: 'expense_detail',
          matched_ids: item.record.id,
        });

        if (item.match?.id) {
          await incrementRuleUsage(item.match.id);
        }
      }

      expenseCount = expenseRecords.length;
    } else {
      console.log('[match/confirm] 지출 데이터 없음 - expense:', expense);
    }

    // 말소 처리
    if (suppressed && suppressed.length > 0) {
      for (const tx of suppressed) {
        await updateBankTransaction(tx.id, {
          matched_status: 'suppressed',
          suppressed: true,
          suppressed_reason: tx.suppressed_reason || '자동 말소',
        });
      }

      suppressedCount = suppressed.length;
    }

    return NextResponse.json({
      success: true,
      incomeCount,
      expenseCount,
      suppressedCount,
      message: `수입 ${incomeCount}건, 지출 ${expenseCount}건, 말소 ${suppressedCount}건 반영 완료`,
    });
  } catch (error) {
    console.error('Match confirm error:', error);
    return NextResponse.json(
      { success: false, error: '반영 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
