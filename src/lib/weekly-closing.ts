/**
 * 주간 마감 (weekly closing) 분류 모듈 — Phase 1
 *
 * 기능:
 * - 은행원장 거래의 transaction_date + time → 단일 datetime 결합
 * - 두 시점(prev/curr) 기준으로 거래 분류 (이미 처리됨 / 이번 사이클 / 다음 사이클)
 *
 * 주의: 기존 시트/거래 데이터를 변경하지 않는다.
 * 순수 분류 함수만 제공 — Phase 2/3에서 UI/적용 시점에 사용.
 */

import type { BankTransaction } from '@/types';

// 'YYYY-MM-DD' + 'HH:mm:ss' (또는 빈문자열) → 'YYYY-MM-DD HH:mm:ss'
// time이 비어있으면 '23:59:59' 사용 (보수적 — 같은 날짜 데이터를 마감에 누락시키지 않음)
// 단, 마감 후보 datetime을 자동 인식할 때는 빈 time 행은 정렬에서 무시 가능.
export function combineDatetime(date: string, time?: string): string {
  const d = (date || '').trim();
  if (!d) return '';
  const t = (time || '').trim() || '23:59:59';
  // time이 'HH:mm' 형식이면 ':00' 보충
  const normalizedTime = t.length === 5 ? `${t}:00` : t;
  return `${d} ${normalizedTime}`;
}

// 빈 datetime은 정렬 시 가장 뒤로 (영향 최소화)
function dtCompare(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

// 거래들의 최대 datetime을 자동 인식 → "이번 주 마감 후보"
// 시각 정보가 있는 거래만 후보로 (시각 없는 거래는 신뢰도 낮음).
export function detectClosingCandidate(transactions: BankTransaction[]): string | null {
  const withTime = transactions
    .filter(tx => tx.transaction_date && tx.time)
    .map(tx => combineDatetime(tx.transaction_date, tx.time));
  if (withTime.length === 0) return null;
  withTime.sort(dtCompare);
  return withTime[withTime.length - 1];
}

export interface ClosingClassification {
  alreadyProcessed: BankTransaction[]; // datetime <= prevClosedAt
  inThisCycle: BankTransaction[];      // prevClosedAt < datetime <= currClosingAt
  futureCycle: BankTransaction[];      // datetime > currClosingAt
  noTime: BankTransaction[];           // datetime 정보 부족 (수동 결정 필요)
}

/**
 * 거래들을 두 시점(prev/curr) 기준으로 분류.
 *
 * @param transactions 분류 대상 (이미 시트에 있는 행 — suppressed 제외 권장)
 * @param prevClosedAt 직전 활성 마감 시각 ('YYYY-MM-DD HH:mm:ss'). 첫 마감이면 null.
 * @param currClosingAt 이번 마감 후보 시각.
 */
export function classifyTransactions(
  transactions: BankTransaction[],
  prevClosedAt: string | null,
  currClosingAt: string,
): ClosingClassification {
  const result: ClosingClassification = {
    alreadyProcessed: [],
    inThisCycle: [],
    futureCycle: [],
    noTime: [],
  };
  for (const tx of transactions) {
    if (!tx.transaction_date) {
      result.noTime.push(tx);
      continue;
    }
    const dt = combineDatetime(tx.transaction_date, tx.time);
    if (prevClosedAt && dtCompare(dt, prevClosedAt) <= 0) {
      result.alreadyProcessed.push(tx);
    } else if (dtCompare(dt, currClosingAt) <= 0) {
      result.inThisCycle.push(tx);
    } else {
      result.futureCycle.push(tx);
    }
  }
  return result;
}

// 주어진 datetime이 속하는 주의 일요일 (회계 인식일).
// 예: '2026-06-07 16:44:24' → '2026-06-07'
//     '2026-06-10 10:00:00' → '2026-06-14' (다음 일요일)
//     '2026-06-08 09:00:00' → '2026-06-14' (그 주의 일요일)
export function getRecordedSundayForDatetime(datetime: string): string {
  if (!datetime) return '';
  const datePart = datetime.split(' ')[0];
  if (!datePart) return '';
  const d = new Date(`${datePart}T00:00:00+09:00`); // KST 가정
  const dayOfWeek = d.getUTCDay(); // 0=일, 1=월, ..., 6=토 (UTC 기준이지만 +09:00 적용했으므로 KST의 요일)
  if (dayOfWeek === 0) return datePart; // 이미 일요일
  // 다음 일요일 = 7 - dayOfWeek 일 후
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + (7 - dayOfWeek));
  return next.toISOString().slice(0, 10);
}
