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

// 배치 확정 API - 수입/지출을 독립적으로 처리하여 부분 성공 허용
export async function POST(request: NextRequest) {
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
  });

  let incomeCount = 0;
  let expenseCount = 0;
  let suppressedCount = 0;
  let incomeSuccess = true;
  let expenseSuccess = true;
  let suppressedSuccess = true;
  let incomeError = '';
  let expenseError = '';

  // 수입 레코드 저장 (독립적 처리)
  if (income && income.length > 0) {
    try {
      const incomeRecords = income.map(item => item.record);
      await addIncomeRecords(incomeRecords);

      // 은행 거래 상태 업데이트 및 규칙 사용 횟수 증가 (실패해도 계속 진행)
      for (const item of income) {
        try {
          await updateBankTransaction(item.transaction.id, {
            matched_status: 'matched',
            matched_type: 'income_detail',
            matched_ids: item.record.id,
          });

          if (item.match?.id) {
            await incrementRuleUsage(item.match.id);
          }
        } catch (updateError) {
          console.warn('[match/confirm] 수입 은행거래 업데이트 실패 (무시):', item.transaction.id, updateError);
        }
      }

      incomeCount = incomeRecords.length;
      console.log('[match/confirm] 수입 레코드 저장 완료:', incomeCount, '건');
    } catch (error) {
      incomeSuccess = false;
      incomeError = error instanceof Error ? error.message : String(error);
      console.error('[match/confirm] 수입 레코드 저장 실패:', incomeError);
    }
  }

  // Google Sheets API 속도 제한 방지를 위한 딜레이
  if (income && income.length > 0 && expense && expense.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 지출 레코드 저장 (독립적 처리)
  if (expense && expense.length > 0) {
    try {
      // undefined record 필터링 및 유효성 검사
      const validExpenseItems = expense.filter(item => {
        if (!item.record) {
          console.warn('[match/confirm] record가 없는 지출 항목 스킵:', item.transaction?.id);
          return false;
        }
        if (!item.record.id || !item.record.date || typeof item.record.amount !== 'number') {
          console.warn('[match/confirm] 필수 필드 누락된 지출 항목 스킵:', item.record);
          return false;
        }
        return true;
      });

      if (validExpenseItems.length > 0) {
        const expenseRecords = validExpenseItems.map(item => item.record);
        console.log('[match/confirm] 지출 레코드 저장 시작:', expenseRecords.length, '건');

        await addExpenseRecords(expenseRecords);
        console.log('[match/confirm] 지출 레코드 저장 완료');

        // 은행 거래 상태 업데이트 및 규칙 사용 횟수 증가
        for (const item of validExpenseItems) {
          try {
            await updateBankTransaction(item.transaction.id, {
              matched_status: 'matched',
              matched_type: 'expense_detail',
              matched_ids: item.record.id,
            });

            if (item.match?.id) {
              await incrementRuleUsage(item.match.id);
            }
          } catch (updateError) {
            console.error('[match/confirm] 은행거래 업데이트 실패:', item.transaction.id, updateError);
          }
        }

        expenseCount = expenseRecords.length;
      }
    } catch (error) {
      expenseSuccess = false;
      expenseError = error instanceof Error ? error.message : String(error);
      console.error('[match/confirm] 지출 레코드 저장 실패:', expenseError);
    }
  }

  // Google Sheets API 속도 제한 방지를 위한 딜레이
  if ((income?.length > 0 || expense?.length > 0) && suppressed && suppressed.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 말소 처리 (독립적 처리)
  if (suppressed && suppressed.length > 0) {
    try {
      for (const tx of suppressed) {
        await updateBankTransaction(tx.id, {
          matched_status: 'suppressed',
          suppressed: true,
          suppressed_reason: tx.suppressed_reason || '자동 말소',
        });
      }
      suppressedCount = suppressed.length;
    } catch (error) {
      suppressedSuccess = false;
      console.error('[match/confirm] 말소 처리 실패:', error);
    }
  }

  // 부분 성공 메시지 생성
  const messages: string[] = [];
  if (incomeCount > 0) messages.push(`수입 ${incomeCount}건`);
  if (expenseCount > 0) messages.push(`지출 ${expenseCount}건`);
  if (suppressedCount > 0) messages.push(`말소 ${suppressedCount}건`);

  const errors: string[] = [];
  if (!incomeSuccess) errors.push(`수입 실패: ${incomeError}`);
  if (!expenseSuccess) errors.push(`지출 실패: ${expenseError}`);
  if (!suppressedSuccess) errors.push('말소 실패');

  // 하나라도 성공했으면 success: true (부분 성공 허용)
  const hasAnySuccess = incomeCount > 0 || expenseCount > 0 || suppressedCount > 0;
  const hasAnyFailure = !incomeSuccess || !expenseSuccess || !suppressedSuccess;

  return NextResponse.json({
    success: hasAnySuccess,
    incomeCount,
    expenseCount,
    suppressedCount,
    incomeSuccess,
    expenseSuccess,
    suppressedSuccess,
    message: messages.length > 0
      ? `${messages.join(', ')} 반영 완료${hasAnyFailure ? ` (일부 실패: ${errors.join(', ')})` : ''}`
      : '반영할 데이터가 없습니다',
    error: hasAnyFailure && !hasAnySuccess ? errors.join(', ') : undefined,
  });
}
