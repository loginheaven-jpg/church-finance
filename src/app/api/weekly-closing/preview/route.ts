import { NextRequest, NextResponse } from 'next/server';
import { getFinanceSession } from '@/lib/auth/finance-session';
import { hasRole } from '@/lib/auth/finance-permissions';
import {
  getBankTransactions,
  getLastActiveClosing,
} from '@/lib/google-sheets';
import {
  classifyTransactions,
  detectClosingCandidate,
  getRecordedSundayForDatetime,
} from '@/lib/weekly-closing';

// GET ?closingAt=YYYY-MM-DD HH:mm:ss
//   - closingAt 주어지면 그 시점 기준으로 분류
//   - 안 주어지면 현재 은행원장 데이터의 max datetime 자동 인식 → 후보 시점
//
// 응답:
//   - prevClosedAt: 직전 활성 마감 시각 (또는 null)
//   - currClosingAt: 사용된 후보 시각
//   - candidateRecordedSunday: 이번 사이클 거래가 들어갈 주일 (계산값)
//   - summary: alreadyProcessed/inThisCycle/futureCycle/noTime 건수
//   - sample: 각 카테고리 상위 N건 (UI 미리보기용)
//
// 안전: 거래 시트를 변경하지 않음. 분류는 메모리에서만.
export async function GET(request: NextRequest) {
  const session = await getFinanceSession();
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });
  if (!hasRole(session.finance_role, 'admin')) {
    return NextResponse.json({ error: 'admin 권한 필요' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let closingAt = (searchParams.get('closingAt') || '').trim();

    // 모든 은행 거래 (suppressed 제외 — 이미 무효 처리된 것은 분류 제외)
    const allTransactions = await getBankTransactions();
    const transactions = allTransactions.filter(tx => !tx.suppressed);

    // 후보 시각 자동 인식
    if (!closingAt) {
      const candidate = detectClosingCandidate(transactions);
      if (!candidate) {
        return NextResponse.json({
          success: false,
          error: '은행원장에 시각 정보가 있는 거래가 없습니다. 먼저 은행원장을 업로드하세요.',
        }, { status: 400 });
      }
      closingAt = candidate;
    } else {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(closingAt)) {
        return NextResponse.json({
          error: 'closingAt 형식 오류 (YYYY-MM-DD HH:mm:ss)',
        }, { status: 400 });
      }
    }

    const lastClosing = await getLastActiveClosing();
    const prevClosedAt = lastClosing?.closed_at || null;

    // closingAt이 prev보다 미래가 아니면 거부
    if (prevClosedAt && closingAt <= prevClosedAt) {
      return NextResponse.json({
        success: false,
        error: `후보 시각 ${closingAt}이 직전 마감 ${prevClosedAt}보다 이전이거나 같습니다`,
      }, { status: 400 });
    }

    const classification = classifyTransactions(transactions, prevClosedAt, closingAt);

    const sample = (list: typeof transactions, n = 5) =>
      list.slice(0, n).map(tx => ({
        id: tx.id,
        transaction_date: tx.transaction_date,
        time: tx.time,
        deposit: tx.deposit,
        withdrawal: tx.withdrawal,
        description: tx.description,
        detail: tx.detail,
      }));

    const sumDeposit = (list: typeof transactions) =>
      list.reduce((s, tx) => s + (tx.deposit || 0), 0);
    const sumWithdrawal = (list: typeof transactions) =>
      list.reduce((s, tx) => s + (tx.withdrawal || 0), 0);

    return NextResponse.json({
      success: true,
      prevClosedAt,
      currClosingAt: closingAt,
      candidateRecordedSunday: getRecordedSundayForDatetime(closingAt),
      summary: {
        alreadyProcessed: {
          count: classification.alreadyProcessed.length,
          deposit: sumDeposit(classification.alreadyProcessed),
          withdrawal: sumWithdrawal(classification.alreadyProcessed),
        },
        inThisCycle: {
          count: classification.inThisCycle.length,
          deposit: sumDeposit(classification.inThisCycle),
          withdrawal: sumWithdrawal(classification.inThisCycle),
        },
        futureCycle: {
          count: classification.futureCycle.length,
          deposit: sumDeposit(classification.futureCycle),
          withdrawal: sumWithdrawal(classification.futureCycle),
        },
        noTime: {
          count: classification.noTime.length,
          deposit: sumDeposit(classification.noTime),
          withdrawal: sumWithdrawal(classification.noTime),
        },
      },
      sample: {
        inThisCycle: sample(classification.inThisCycle),
        futureCycle: sample(classification.futureCycle),
        noTime: sample(classification.noTime, 3),
      },
    });
  } catch (e) {
    console.error('[weekly-closing/preview GET]', e);
    return NextResponse.json({ error: '미리보기 실패' }, { status: 500 });
  }
}
