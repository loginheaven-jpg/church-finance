// 은행원장 중복 판정 공용 키 (클라이언트 BankUpload + 서버 check-duplicates 공유)
//
// 2026-07-13 개편 (안 β⁶): 기존 키 `transaction_date|deposit|withdrawal|balance` 는
//   - withdrawal 오염(입금행에 유령 출금 주입)이나 balance 체인 밀림에 취약 → 재업로드 중복 미검출.
//   - 실제 사고: 7/5 전우윤 550,000 입금행의 출금칸에 유령 46,209 가 주입되어
//     저장키(…|550000|46209|…) ≠ 재업로드키(…|550000|0|…) → 중복 미인식 → 이중기록.
//
// 새 키 = transaction_date | time(HH:MM:SS) | signedAmount | detail
//   - signedAmount = deposit>0 ? +deposit : -withdrawal  → 입금행의 유령 출금 무시(입금액만 사용)
//   - balance 제외 → 재처리로 잔액체인이 밀려도 동일 거래를 정확히 중복 인식
//   - time 으로 "같은 날 동일액·동일적요 2건"을 구분 (기존엔 balance 로 구분하던 역할 대체)

export interface BankDedupFields {
  transaction_date: string;
  time?: string;
  deposit: number | string;
  withdrawal: number | string;
  detail?: string;
}

function toNum(v: number | string | undefined | null): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// "9:16:58" → "09:16:58", "11:16" → "11:16:00"
function normTime(t?: string): string {
  if (!t) return '';
  const parts = String(t).trim().split(':');
  const h = (parts[0] || '0').padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function getBankDuplicateKey(tx: BankDedupFields): string {
  const dep = toNum(tx.deposit);
  const wit = toNum(tx.withdrawal);
  const signed = dep > 0 ? dep : -wit;
  const detail = String(tx.detail || '').trim();
  return `${tx.transaction_date}|${normTime(tx.time)}|${signed}|${detail}`;
}
