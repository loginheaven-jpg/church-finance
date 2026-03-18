'use client'

import { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstall() {
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [showPromotion, setShowPromotion] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [showAndroidGuide, setShowAndroidGuide] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // 0. 서비스 워커 등록 (beforeinstallprompt 요건 충족)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // 1. 인앱 브라우저 감지 & 리다이렉트
  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (!/KAKAOTALK|NAVER|Line\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|DaumApps/i.test(ua)) return

    if (/Android/i.test(ua)) {
      const url = location.href
      const sep = url.includes('?') ? '&' : '?'
      const targetUrl = url + sep + 'pwa=1'
      location.href = 'intent://' + targetUrl.replace(/^https?:\/\//, '') +
        '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
        encodeURIComponent(targetUrl) + ';end'
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      if (!sessionStorage.getItem('inapp-dismissed')) {
        if (confirm('앱 설치를 위해 Safari에서 여시겠습니까?')) {
          window.open(location.href, '_blank')
        } else {
          sessionStorage.setItem('inapp-dismissed', '1')
        }
      }
    }
  }, [])

  // 2. 설치 상태 체크 + beforeinstallprompt 캡처
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (isStandalone) return
    if (localStorage.getItem('pwa-installed') === '1') return

    // 설치 유도 팝업 표시 함수
    const showPromotionIfNeeded = () => {
      const params = new URLSearchParams(location.search)
      if (params.get('pwa') === '1') {
        const clean = new URL(location.href)
        clean.searchParams.delete('pwa')
        history.replaceState(null, '', clean.toString())
        setTimeout(() => setShowPromotion(true), 1000)
      } else if (!sessionStorage.getItem('pwa-prompt-shown')) {
        setTimeout(() => {
          setShowPromotion(true)
          sessionStorage.setItem('pwa-prompt-shown', '1')
        }, 2000)
      }
    }

    // Android/PC Chrome: beforeinstallprompt가 발동해야만 설치 가능
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShowInstallBtn(true)
      showPromotionIfNeeded()
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari: beforeinstallprompt 없음, 수동 가이드 제공
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('beforeinstallprompt' in window)
    if (isIOS) {
      setShowInstallBtn(true)
      showPromotionIfNeeded()
    }

    // 앱 설치 완료 이벤트
    const installedHandler = () => {
      localStorage.setItem('pwa-installed', '1')
      setShowInstallBtn(false)
      setShowPromotion(false)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      setShowIOSGuide(true)
      setShowPromotion(false)
      return
    }
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', '1')
        setShowInstallBtn(false)
        setShowPromotion(false)
      }
      deferredPrompt.current = null
    } else {
      setShowAndroidGuide(true)
      setShowPromotion(false)
    }
  }

  if (!showInstallBtn) return null

  return (
    <>
      {/* 고정 설치 버튼 (화면 하단 우측) */}
      <button
        onClick={handleInstall}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[#1e40af] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#1e3a8a] active:scale-95"
      >
        <Download className="h-4 w-4" />
        앱 설치
      </button>

      {/* 설치 권유 팝업 */}
      {showPromotion && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center bg-black/60" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="w-full max-w-[420px] rounded-t-3xl bg-white px-6 py-7 text-center shadow-2xl" style={{ animation: 'pwa-slide-up 0.3s ease' }}>
            <div className="mb-3 text-4xl">💰</div>
            <div className="mb-2 text-lg font-bold text-gray-900">예봄재정 앱으로 이용하세요</div>
            <div className="mb-5 text-sm leading-relaxed text-gray-500">
              홈 화면에 추가하면 앱처럼 빠르게 실행되고<br />더 편리하게 사용할 수 있습니다.
            </div>
            <button
              onClick={handleInstall}
              className="mb-3 w-full rounded-xl bg-[#1e40af] py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              홈 화면에 추가하기
            </button>
            <button
              onClick={() => setShowPromotion(false)}
              className="w-full border-none bg-transparent py-1.5 text-xs text-gray-400"
            >
              나중에 할게요
            </button>
          </div>
        </div>
      )}

      {/* iOS 가이드 모달 */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60">
          <div className="w-[300px] rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="mb-3 text-base font-bold text-gray-900">홈 화면에 추가</h3>
            <p className="mb-2 text-sm leading-relaxed text-gray-500">
              Safari 하단의 <strong className="text-gray-700">공유 버튼</strong> (⬆) 을 탭한 후<br />
              <strong className="text-gray-700">&quot;홈 화면에 추가&quot;</strong>를 선택하세요.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-3 rounded-lg bg-[#1e40af] px-5 py-2 text-sm text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Android 설치 가이드 오버레이 */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-[9999] bg-black/85" onClick={() => setShowAndroidGuide(false)}>
          <div className="fixed right-[38px] top-[6px] z-[10000] animate-bounce">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <path d="M24 4 L24 32 M14 22 L24 32 L34 22" stroke="#C9A962" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="fixed left-1/2 top-1/2 z-[10000] w-[280px] -translate-x-1/2 -translate-y-1/2 text-center" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A962] to-[#b08d4a] text-base font-extrabold text-[#1e40af]">1</div>
              <div className="text-[15px] leading-relaxed text-white">
                화면 오른쪽 위<br /><span className="inline-block rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-2xl font-black tracking-widest text-[#C9A962]">⋮</span> 을 누르세요
              </div>
            </div>
            <div className="mb-5 flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A962] to-[#b08d4a] text-base font-extrabold text-[#1e40af]">2</div>
              <div className="text-[15px] leading-relaxed text-white">
                <b className="font-bold text-[#C9A962]">&quot;홈 화면에 추가&quot;</b> 또는<br /><b className="font-bold text-[#C9A962]">&quot;앱 설치&quot;</b>를 선택하세요
              </div>
            </div>
            <div className="mb-5 flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A962] to-[#b08d4a] text-base font-extrabold text-[#1e40af]">3</div>
              <div className="text-[15px] leading-relaxed text-white">
                <b className="font-bold text-[#C9A962]">&quot;설치&quot;</b>를 누르면 완료!
              </div>
            </div>
            <button
              onClick={() => setShowAndroidGuide(false)}
              className="mt-6 rounded-xl border border-white/20 bg-white/10 px-9 py-3 text-sm text-white"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
