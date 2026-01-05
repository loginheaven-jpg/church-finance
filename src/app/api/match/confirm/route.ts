import { NextRequest, NextResponse } from 'next/server';
import {
  addIncomeRecords,
  addExpenseRecords,
  updateBankTransaction,
  generateId,
  getKSTDateTime,
} from '@/lib/google-sheets';
import { learnFromManualMatch } from '@/lib/matching-engine';
import type { BankTransaction, IncomeRecord, ExpenseRecord } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactionId,
      transaction,
      classification,
    } = body as {
      transactionId: string;
      transaction: BankTransaction;
      classification: {
        type: 'income' | 'expense';
        code: number;
        name: string;
        category_code?: number;
        category_name?: string;
        donor_name?: string;
        vendor?: string;
        description?: string;
        note?: string;
      };
    };

    if (!transactionId || !classification) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    const now = getKSTDateTime();
    let recordId = '';

    if (classification.type === 'income') {
      const incomeRecord: IncomeRecord = {
        id: generateId('INC'),
        date: transaction.transaction_date,
        source: '계좌이체',
        offering_code: classification.code,
        donor_name: classification.donor_name || transaction.detail || '',
        representative: classification.donor_name || transaction.detail || '',
        amount: transaction.deposit,
        note: classification.note || `${transaction.description} | ${transaction.detail}`,
        input_method: '수동매칭',
        created_at: now,
        created_by: 'manual_matcher',
      };

      await addIncomeRecords([incomeRecord]);
      recordId = incomeRecord.id;
    } else {
      const expenseRecord: ExpenseRecord = {
        id: generateId('EXP'),
        date: transaction.transaction_date,
        payment_method: '계좌이체',
        vendor: classification.vendor || transaction.detail || transaction.description || '',
        description: classification.description || transaction.description || '',
        amount: transaction.withdrawal,
        account_code: classification.code,
        category_code: classification.category_code || Math.floor(classification.code / 10) * 10,
        note: classification.note || '',
        created_at: now,
        created_by: 'manual_matcher',
      };

      await addExpenseRecords([expenseRecord]);
      recordId = expenseRecord.id;
    }

    // 은행 거래 상태 업데이트
    await updateBankTransaction(transactionId, {
      matched_status: 'matched',
      matched_type: classification.type === 'income' ? 'income_detail' : 'expense_detail',
      matched_ids: recordId,
    });

    // 학습 기능 실행
    await learnFromManualMatch(transaction, {
      type: classification.type,
      code: classification.code,
      name: classification.name,
    });

    return NextResponse.json({
      success: true,
      recordId,
      message: '거래가 분류되었습니다',
    });
  } catch (error) {
    console.error('Match confirm error:', error);
    return NextResponse.json(
      { success: false, error: '거래 분류 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
