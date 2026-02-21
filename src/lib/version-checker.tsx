'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_COOLDOWN = 30_000 // 30초 쿨다운

/**
 * 자동 버전 갱신 컴포넌트
 *
 * B전략: 페이지 이동(navigation) 시 버전 체크 → 변경 시 silent reload
 * C전략: 탭 복귀(visibilitychange) 시 버전 체크 → 토스트 안내 후 reload
 */
export function VersionChecker() {
  const pathname = usePathname()
  const lastCheckRef = useRef(0)
  const initialLoadRef = useRef(true)

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      return
    }
    checkVersion('navigation')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        checkVersion('visibility')
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkVersion(mode: 'navigation' | 'visibility') {
    const now = Date.now()
    if (now - lastCheckRef.current < CHECK_COOLDOWN) return
    lastCheckRef.current = now

    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return
      const { buildId } = await res.json()
      if (!buildId || !CLIENT_BUILD_ID || buildId === CLIENT_BUILD_ID) return

      if (mode === 'navigation') {
        window.location.reload()
      } else {
        toast.info('새 버전으로 업데이트합니다...')
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      // 네트워크 오류 무시
    }
  }

  return null
}
