import { NextRequest, NextResponse } from 'next/server';
import {
  addIncomeRecords,
  addExpenseRecords,
  updateBankTransactionsBatch,
  getBankTransactions,
} from '@/lib/google-sheets';
import { incrementRuleUsage } from '@/lib/matching-engine';
import { getServerSession, hasRole } from '@/lib/auth/finance-permissions';
import { invalidateYearCache } from '@/lib/redis';
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

// 배치 확정 API - 수입/지출을 독립적으로 처리하여 부분 성공 허용 (admin 이상)
export async function POST(request: NextRequest) {
  // 권한 확인 (admin 이상)
  const session = await getServerSession();
  if (!session || !hasRole(session.finance_role, 'admin')) {
    return NextResponse.json(
      { success: false, error: '권한이 없습니다' },
      { status: 403 }
    );
  }

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

  // 중복 반영 방지: 서버에서 실제 은행원장 상태만 조회 (수입/지출 전체 조회 제거로 성능 개선)
  let bankStatusMap = new Map<string, string>();

  try {
    const bankTransactions = await getBankTransactions();
    bankStatusMap = new Map(bankTransactions.map(tx => [tx.id, tx.matched_status || 'pending']));
  } catch (error) {
    console.error('[match/confirm] 은행원장 상태 조회 실패:', error);
    // 조회 실패 시 계속 진행 (클라이언트 상태 기준으로 처리)
  }

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
      // 중복 반영 방지: 서버의 실제 은행원장 상태 기준으로 필터링
      const newIncomeItems = income.filter(item => {
        const serverStatus = bankStatusMap.get(item.transaction.id) || item.transaction.matched_status;
        if (serverStatus === 'matched' || serverStatus === 'suppressed') {
          console.warn('[match/confirm] 이미 반영된 수입 거래 스킵:', item.transaction.id, '상태:', serverStatus);
          return false;
        }
        return true;
      });

      if (newIncomeItems.length === 0) {
        incomeSuccess = true;
        incomeCount = 0;
      } else {
        // 배치 업데이트로 은행거래 상태 일괄 업데이트 (API 호출 1회)
        const batchUpdates = newIncomeItems.map(item => ({
          id: item.transaction.id,
          matched_status: 'matched' as const,
          matched_type: 'income_detail',
          matched_ids: item.record.id,
        }));

        const batchResult = await updateBankTransactionsBatch(batchUpdates);

        // 성공한 항목만 수입부에 추가
        const successIdSet = new Set(batchResult.success);
        const successfulItems = newIncomeItems.filter(item => successIdSet.has(item.transaction.id));

        if (successfulItems.length > 0) {
          const incomeRecords = successfulItems.map(item => item.record);
          await addIncomeRecords(incomeRecords);
          incomeCount = incomeRecords.length;

          // 규칙 사용 횟수 증가 (병렬 처리 - 실패해도 무방)
          const ruleIds = successfulItems.filter(item => item.match?.id).map(item => item.match!.id);
          if (ruleIds.length > 0) {
            await Promise.allSettled(ruleIds.map(id => incrementRuleUsage(id).catch(() => {})));
          }
        }

        if (batchResult.failed.length > 0) {
          console.warn('[match/confirm] 수입 은행거래 상태 업데이트 실패:', batchResult.failed.length, '건');
          if (successfulItems.length === 0) {
            incomeSuccess = false;
            incomeError = `은행원장 상태 업데이트 실패 ${batchResult.failed.length}건`;
          }
        }
      }
    } catch (error) {
      incomeSuccess = false;
      console.error('[match/confirm] 수입 레코드 저장 실패:', error);
      incomeError = '수입 레코드 저장 중 오류가 발생했습니다';
    }
  }

  // 지출 레코드 저장 (독립적 처리)
  if (expense && expense.length > 0) {
    try {
      // undefined record 필터링, 유효성 검사, 중복 반영 방지 (서버 상태 기준)
      const validExpenseItems = expense.filter(item => {
        // 중복 반영 방지: 서버의 실제 은행원장 상태 기준으로 필터링
        const serverStatus = bankStatusMap.get(item.transaction.id) || item.transaction.matched_status;
        if (serverStatus === 'matched' || serverStatus === 'suppressed') {
          console.warn('[match/confirm] 이미 반영된 지출 거래 스킵:', item.transaction.id, '상태:', serverStatus);
          return false;
        }
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
        // 배치 업데이트로 은행거래 상태 일괄 업데이트 (API 호출 1회)
        const batchUpdates = validExpenseItems.map(item => ({
          id: item.transaction.id,
          matched_status: 'matched' as const,
          matched_type: 'expense_detail',
          matched_ids: item.record.id,
        }));

        const batchResult = await updateBankTransactionsBatch(batchUpdates);

        // 성공한 항목만 지출부에 추가
        const successIdSet = new Set(batchResult.success);
        const successfulItems = validExpenseItems.filter(item => successIdSet.has(item.transaction.id));

        if (successfulItems.length > 0) {
          const expenseRecords = successfulItems.map(item => item.record);
          await addExpenseRecords(expenseRecords);
          expenseCount = expenseRecords.length;

          // 규칙 사용 횟수 증가 (병렬 처리 - 실패해도 무방)
          const ruleIds = successfulItems.filter(item => item.match?.id).map(item => item.match!.id);
          if (ruleIds.length > 0) {
            await Promise.allSettled(ruleIds.map(id => incrementRuleUsage(id).catch(() => {})));
          }
        }

        if (batchResult.failed.length > 0) {
          console.warn('[match/confirm] 지출 은행거래 상태 업데이트 실패:', batchResult.failed.length, '건');
          if (successfulItems.length === 0) {
            expenseSuccess = false;
            expenseError = `은행원장 상태 업데이트 실패 ${batchResult.failed.length}건`;
          }
        }
      }
    } catch (error) {
      expenseSuccess = false;
      console.error('[match/confirm] 지출 레코드 저장 실패:', error);
      expenseError = '지출 레코드 저장 중 오류가 발생했습니다';
    }
  }

  // 말소 처리 (배치 업데이트, 서버 상태 기준으로 중복 방지)
  if (suppressed && suppressed.length > 0) {
    try {
      // 중복 필터링
      const newSuppressed = suppressed.filter(tx => {
        const serverStatus = bankStatusMap.get(tx.id) || tx.matched_status;
        if (serverStatus === 'suppressed' || serverStatus === 'matched') {
          console.warn('[match/confirm] 이미 처리된 말소 거래 스킵:', tx.id, '상태:', serverStatus);
          return false;
        }
        return true;
      });

      // 배치 업데이트로 말소 처리 (API 호출 1회)
      if (newSuppressed.length > 0) {
        const batchUpdates = newSuppressed.map(tx => ({
          id: tx.id,
          matched_status: 'suppressed' as const,
          suppressed: true,
          suppressed_reason: tx.suppressed_reason || '자동 말소',
        }));

        const batchResult = await updateBankTransactionsBatch(batchUpdates);

        suppressedCount = batchResult.success.length;

        if (batchResult.failed.length > 0) {
          console.warn('[match/confirm] 말소 처리 실패:', batchResult.failed.length, '건');
          if (suppressedCount === 0) {
            suppressedSuccess = false;
          }
        }
      }
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

  // 캐시 무효화 (데이터 변경 반영)
  if (hasAnySuccess) {
    const year = new Date().getFullYear();
    await invalidateYearCache(year);
  }

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
