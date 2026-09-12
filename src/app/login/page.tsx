'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { LogIn, UserPlus, Heart, FileText, Receipt } from 'lucide-react';
import { PledgeEntryModal, TaxInfoEntryModal } from '@/components/pledge';
import { saintLoginUrl, saintJoinUrl } from '@/lib/auth/saint-sso';

// 재정부 배포 주소 — 교적부가 허용하는 redirect 는 https://*.yebom.org 형태여야 한다(§2-5).
const FINANCE_BASE_URL = 'https://finance.yebom.org';

/**
 * 재정부 로그인 화면 — 선택 화면만 존재한다.
 *
 * 비밀번호 입력은 오직 교적부에서만 이뤄진다(§2-1). 예전에는 여기에 이메일·비밀번호 폼이
 * 있었으나 setMode('login') 호출부가 없어 UI 로는 도달 불가한 죽은 코드였고,
 * 그 폼이 부르던 POST /api/auth/verify 는 410 으로 폐기했다(§4-2, §9-2).
 *
 * 작정헌금·연말정산은 로그인 필수(§4-7 (ii))다. 각 버튼은 익명으로 모달을 열지 않고
 * 교적부 로그인을 거치며(→ 401 실패 버튼 방지), 인증 후 이 화면으로 돌아오면
 * `?open=pledge|taxinfo` 파라미터로 해당 모달을 자동으로 연다.
 */
function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const openTarget = searchParams.get('open'); // 인증 후 복귀 시 열 모달
  const [showPledgeModal, setShowPledgeModal] = useState(openTarget === 'pledge');
  const [showTaxInfoModal, setShowTaxInfoModal] = useState(openTarget === 'taxinfo');

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #2C3E50 0%, #1a2a3a 100%)',
      }}
    >
      <div className="w-full max-w-md px-4">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="text-center py-4 bg-gradient-to-br from-[#f8f6f0] to-[#f0ebe0]">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2"
                style={{
                  background: 'linear-gradient(135deg, #C9A962 0%, #D4B87A 100%)',
                  boxShadow: '0 4px 16px rgba(201, 169, 98, 0.3)'
                }}
              >
                ⛪
              </div>
              <h1 className="font-semibold text-xl text-[#2C3E50]">
                예봄교회 재정시스템
              </h1>
            </div>

            {/* Choice Buttons */}
            <div className="p-3 space-y-2">
              {/* 지출청구 버튼 */}
              <a
                href={saintLoginUrl(`${FINANCE_BASE_URL}/expense-claim`)}
                className="w-full p-3 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-purple-800">
                      지출청구
                    </h3>
                    <p className="text-xs text-purple-500">
                      로그인 후 지출청구로 이동합니다
                    </p>
                  </div>
                </div>
              </a>

              {/* 작정헌금 입력 — 로그인 필수(§4-7). 교적부 로그인 경유 후 ?open=pledge 로 복귀 */}
              <a
                href={saintLoginUrl(`${FINANCE_BASE_URL}/login?open=pledge`)}
                className="w-full p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-green-800">
                      작정헌금 입력
                    </h3>
                    <p className="text-xs text-green-600">
                      성전봉헌, 선교헌금
                    </p>
                  </div>
                </div>
              </a>

              {/* 연말정산 정보입력 — 로그인 필수(§4-7). 교적부 로그인 경유 후 ?open=taxinfo 로 복귀 */}
              <a
                href={saintLoginUrl(`${FINANCE_BASE_URL}/login?open=taxinfo`)}
                className="w-full p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-blue-800">
                      연말정산 정보입력
                    </h3>
                    <p className="text-xs text-blue-500">
                      수집정보: 주민번호, 주민등록 주소
                    </p>
                  </div>
                </div>
              </a>

              {/* 예봄성도 로그인 (교적부 SSO) */}
              <a
                href={saintLoginUrl(`${FINANCE_BASE_URL}${redirectTo}`)}
                className="w-full p-3 rounded-xl border-2 border-[#C9A962]/30 bg-[#faf8f3] hover:bg-[#f5f0e5] hover:border-[#C9A962]/50 transition-all text-left group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #C9A962 0%, #D4B87A 100%)' }}
                  >
                    <LogIn className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-[#2C3E50]">
                      예봄성도 로그인
                    </h3>
                    <p className="text-xs text-slate-500">
                      카카오톡 또는 교적부 계정
                    </p>
                  </div>
                </div>
              </a>

              {/* 가입은 교적부에서 */}
              <div className="pt-1 text-center">
                <a
                  href={saintJoinUrl()}
                  className="text-sm text-gray-500 hover:text-[#2C3E50] flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  예봄서비스 가입하기
                </a>
                <p className="text-xs text-gray-400 mt-1">
                  * 가입 후 관리자 승인이 필요합니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 작정헌금 입력 모달 */}
      <PledgeEntryModal
        open={showPledgeModal}
        onOpenChange={setShowPledgeModal}
      />

      {/* 연말정산 정보입력 모달 */}
      <TaxInfoEntryModal
        open={showTaxInfoModal}
        onOpenChange={setShowTaxInfoModal}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
