/**
 * 개인식별정보(PII) 마스킹 — 주민등록번호 (§4-7)
 *
 * 클라이언트로는 주민번호 전문을 절대 내려보내지 않는다. 앞 6자리(생년월일)만 노출하고
 * 뒷 7자리는 `*`로 가린다. 전문이 필요한 곳은 서버측 영수증 생성 경로뿐이며,
 * 거기서는 DB/시트 원본을 직접 읽는다.
 *
 * 연말정산 모달들은 이미 앞 6자리만 사용하고 뒷자리는 사용자가 재입력하므로(보안),
 * 마스킹해도 기존 UX가 그대로 유지된다.
 */

const MASK_TAIL = '*******'; // 뒷 7자리

/** 주민번호를 앞 6자리 + 마스킹으로 변환. 빈 값/6자리 미만은 그대로 둔다. */
export function maskResidentId(rid: string | null | undefined): string {
  if (!rid) return '';
  const digits = String(rid).replace(/[^0-9]/g, '');
  if (digits.length < 7) return String(rid); // 주민번호로 보이지 않으면 손대지 않음
  return `${digits.substring(0, 6)}-${MASK_TAIL}`;
}

/** 값이 마스킹된 주민번호인지(= 사용자가 수정 없이 되돌려보낸 값인지) 판별 */
export function isMaskedResidentId(rid: string | null | undefined): boolean {
  return !!rid && rid.includes('*');
}
