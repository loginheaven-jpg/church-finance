import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  getBankTransactions,
  getIncomeRecords,
  getExpenseRecords,
  getLastActiveClosing,
  bulkUpdateRecordDates,
  addWeeklyClosing,
  readSheet,
  FINANCE_CONFIG,
  getKSTDateTime,
} from '@/lib/google-sheets';
import {
  classifyTransactions,
  getRecordedSundayForDatetime,
  computeClosingPlan,
} from '@/lib/weekly-closing';
import { invalidateYearCache } from '@/lib/redis';

// POST /api/weekly-closing/apply
// body: { closing_at: 'YYYY-MM-DD HH:mm:ss', closing_week?: 'YYYY-MM-DD', note?: string }
//
// 동작:
//   1) plan 재계산 (드라이런과 동일 로직)
//   2) bank/income/expense 시트의 date 컬럼을 plan에 따라 보정 (bulkUpdateRecordDates)
//   3) 주간마감 시트에 마감 행 추가 + applied_plan에 plan JSON 저장 (취소 원복용)
//   4) 캐시 무효화
//
// 권한: super_admin
// 멱등성: 같은 closing_at으로 두 번 호출하면 단조 증가 가드로 두 번째 거부.
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'super_admin')) {
    return NextResponse.json({ error: 'super_admin 권한 필요' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const closingAt = (body.closing_at || '').trim();
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(closingAt)) {
      return NextResponse.json({ error: 'closing_at 형식 오류 (YYYY-MM-DD HH:mm:ss)' }, { status: 400 });
    }

    const targetSunday = (body.closing_week || '').trim() || getRecordedSundayForDatetime(closingAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetSunday)) {
      return NextResponse.json({ error: 'closing_week 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
    }

    // 단조 증가 검증
    const lastClosing = await getLastActiveClosing();
    if (lastClosing && closingAt <= lastClosing.closed_at) {
      return NextResponse.json({
        error: `closing_at(${closingAt})이 직전 마감(${lastClosing.closed_at})보다 이전이거나 같습니다`,
      }, { status: 400 });
    }

    // 데이터 로드
    const [allBank, allIncome, allExpense] = await Promise.all([
      getBankTransactions(),
      getIncomeRecords(),
      getExpenseRecords(),
    ]);
    const transactions = allBank.filter(tx => !tx.suppressed);

    // 분류 + plan 계산
    const classification = classifyTransactions(
      transactions,
      lastClosing?.closed_at || null,
      closingAt,
    );
    const plan = computeClosingPlan(
      classification.inThisCycle,
      targetSunday,
      closingAt,
      allIncome,
      allExpense,
    );

    // id → rowIndex 매핑을 위해 시트 raw 읽기 (각 시트 1회씩)
    // BankTransaction/IncomeRecord/ExpenseRecord는 인터페이스에 rowIndex가 없음
    const findRowIndex = async (sheetName: string, id: string): Promise<number | null> => {
      const rows = await readSheet(sheetName);
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) return i + 1;
      }
      return null;
    };

    // bank 보정
    let bankApplied = 0;
    if (plan.bank.toUpdate.length > 0) {
      const updates: Array<{ rowIndex: number; date: string }> = [];
      for (const r of plan.bank.toUpdate) {
        const ri = await findRowIndex(FINANCE_CONFIG.sheets.bank, r.id);
        if (ri) updates.push({ rowIndex: ri, date: r.after_date });
      }
      if (updates.length > 0) {
        await bulkUpdateRecordDates(FINANCE_CONFIG.sheets.bank, updates);
        bankApplied = updates.length;
      }
    }

    // income 보정
    let incomeApplied = 0;
    if (plan.income.toUpdate.length > 0) {
      const updates: Array<{ rowIndex: number; date: string }> = [];
      for (const r of plan.income.toUpdate) {
        const ri = await findRowIndex(FINANCE_CONFIG.sheets.income, r.id);
        if (ri) updates.push({ rowIndex: ri, date: r.after_date });
      }
      if (updates.length > 0) {
        await bulkUpdateRecordDates(FINANCE_CONFIG.sheets.income, updates);
        incomeApplied = updates.length;
      }
    }

    // expense 보정
    let expenseApplied = 0;
    if (plan.expense.toUpdate.length > 0) {
      const updates: Array<{ rowIndex: number; date: string }> = [];
      for (const r of plan.expense.toUpdate) {
        const ri = await findRowIndex(FINANCE_CONFIG.sheets.expense, r.id);
        if (ri) updates.push({ rowIndex: ri, date: r.after_date });
      }
      if (updates.length > 0) {
        await bulkUpdateRecordDates(FINANCE_CONFIG.sheets.expense, updates);
        expenseApplied = updates.length;
      }
    }

    // 주간마감 시트에 마감 행 추가 + applied_plan JSON 저장
    const planJson = JSON.stringify(plan);
    await addWeeklyClosing({
      closing_week: targetSunday,
      closed_at: closingAt,
      closed_by: session.name,
      note: (body.note || '') + ` [bank:${bankApplied} inc:${incomeApplied} exp:${expenseApplied}]`,
      applied_plan: planJson,
    });

    // 캐시 무효화 (변경된 연도)
    const year = parseInt(targetSunday.substring(0, 4), 10);
    await invalidateYearCache(year);

    return NextResponse.json({
      success: true,
      closing_week: targetSunday,
      closed_at: closingAt,
      applied: {
        bank: bankApplied,
        income: incomeApplied,
        expense: expenseApplied,
        total: bankApplied + incomeApplied + expenseApplied,
      },
      kstAppliedAt: getKSTDateTime(),
    });
  } catch (e) {
    console.error('[weekly-closing/apply]', e);
    return NextResponse.json({ error: `적용 실패: ${(e as Error).message}` }, { status: 500 });
  }
}
