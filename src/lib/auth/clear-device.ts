/**
 * 명시적 로그아웃 시 이 기기(이 사이트)의 브라우저 저장소를 모두 지운다.
 *
 * 서버 로그아웃 응답의 Clear-Site-Data 헤더를 지원하지 않는 브라우저(일부 사파리 등)를 위한 보완이며,
 * 지원하는 브라우저에서도 한 번 더 확실히 지운다.
 * - localStorage / sessionStorage
 * - Cache Storage
 * - 서비스워커(푸시 알림 포함) — 로그아웃한 기기로 앞 사람의 알림이 오지 않도록
 * - IndexedDB (Firebase 푸시 토큰 등)
 *
 * yebom_returning(재방문 표시)은 개인정보가 아니므로 다시 남겨,
 * 로그인 화면이 첫 방문자용 화면으로 바뀌지 않게 한다.
 *
 * ※ 교적부 src/lib/auth/clear-device.ts 를 그대로 복사 이식한 것이다(단일 출처).
 *   수정이 필요하면 교적부 원본을 먼저 고치고 다시 복사할 것.
 *   재정부에서 지워지는 개인 데이터 예: cash-offering-draft:*(헌금자 이름·금액 초안),
 *   pledge_bulk_*(작정헌금 대량입력) — 모두 localStorage.clear()로 커버된다.
 */
export async function clearDeviceData(): Promise<void> {
  if (typeof window === 'undefined') return

  try { localStorage.clear() } catch { /* 저장소 접근 불가 — 무시 */ }
  try { sessionStorage.clear() } catch { /* 무시 */ }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch { /* 무시 */ }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch { /* 무시 */ }

  try {
    if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
      const databases = await indexedDB.databases()
      await Promise.all(databases.map((db) => new Promise<void>((resolve) => {
        if (!db.name) { resolve(); return }
        const request = indexedDB.deleteDatabase(db.name)
        // 열려 있는 연결이 있으면 blocked — 페이지를 떠나면 마저 삭제되므로 기다리지 않는다
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })))
    }
  } catch { /* 무시 */ }

  try { localStorage.setItem('yebom_returning', '1') } catch { /* 무시 */ }
}
