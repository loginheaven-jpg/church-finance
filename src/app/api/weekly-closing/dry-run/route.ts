import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  getBankTransactions,
  getIncomeRecords,
  getExpenseRecords,
  getLastActiveClosing,
} from '@/lib/google-sheets';
import {
  classifyTransactions,
  detectClosingCandidate,
  getRecordedSundayForDatetime,
  computeClosingPlan,
} from '@/lib/weekly-closing';

// POST /api/weekly-closing/dry-run
// body: { closing_at?: 'YYYY-MM-DD HH:mm:ss' } - 안 주면 은행원장 max 자동 인식
//
// 응답:
//   { success: true, plan: ClosingPlan, summary: {...} }
//
// 안전: 시트 변경 없음. 보정 시뮬레이션만.
export async function POST(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let closingAt = (body.closing_at || '').trim();

    // 데이터 일괄 조회 (병렬)
    const [allBank, lastClosing, allIncome, allExpense] = await Promise.all([
      getBankTransactions(),
      getLastActiveClosing(),
      getIncomeRecords(),
      getExpenseRecords(),
    ]);

    const transactions = allBank.filter(tx => !tx.suppressed);

    // 후보 시각 자동 인식
    if (!closingAt) {
      const candidate = detectClosingCandidate(transactions);
      if (!candidate) {
        return NextResponse.json({
          success: false,
          error: '은행원장에 시각 정보가 있는 거래가 없습니다',
        }, { status: 400 });
      }
      closingAt = candidate;
    } else if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(closingAt)) {
      return NextResponse.json({
        error: 'closing_at 형식 오류 (YYYY-MM-DD HH:mm:ss)',
      }, { status: 400 });
    }

    const prevClosedAt = lastClosing?.closed_at || null;
    if (prevClosedAt && closingAt <= prevClosedAt) {
      return NextResponse.json({
        success: false,
        error: `후보 시각 ${closingAt}이 직전 마감 ${prevClosedAt}보다 이전이거나 같습니다`,
      }, { status: 400 });
    }

    const classification = classifyTransactions(transactions, prevClosedAt, closingAt);
    const targetSunday = getRecordedSundayForDatetime(closingAt);
    const plan = computeClosingPlan(
      classification.inThisCycle,
      targetSunday,
      closingAt,
      allIncome,
      allExpense,
    );

    return NextResponse.json({
      success: true,
      prevClosedAt,
      currClosingAt: closingAt,
      classificationSummary: {
        alreadyProcessed: classification.alreadyProcessed.length,
        inThisCycle: classification.inThisCycle.length,
        futureCycle: classification.futureCycle.length,
        noTime: classification.noTime.length,
      },
      plan,
      summary: {
        bankToUpdate: plan.bank.toUpdate.length,
        bankUnchanged: plan.bank.unchanged,
        incomeToUpdate: plan.income.toUpdate.length,
        incomeUnchanged: plan.income.unchanged,
        expenseToUpdate: plan.expense.toUpdate.length,
        expenseUnchanged: plan.expense.unchanged,
        totalToUpdate:
          plan.bank.toUpdate.length +
          plan.income.toUpdate.length +
          plan.expense.toUpdate.length,
      },
    });
  } catch (e) {
    console.error('[weekly-closing/dry-run]', e);
    return NextResponse.json({ error: '드라이런 실패' }, { status: 500 });
  }
}
