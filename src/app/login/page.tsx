'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, AlertCircle, Heart, ArrowLeft, Building2, Globe, FileText, ExternalLink, Receipt } from 'lucide-react';
import { PledgeEntryModal, TaxInfoEntryModal } from '@/components/pledge';

type PageMode = 'choice' | 'login';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [mode, setMode] = useState<PageMode>('choice');
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showTaxInfoModal, setShowTaxInfoModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (!formData.password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        // 전체 페이지 새로고침으로 세션 상태 완전 반영
        window.location.href = redirectTo;
      } else {
        setError(data.error || '로그인에 실패했습니다');
        setFormData({ ...formData, password: '' });
      }
    } catch {
      setError('서버 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 선택 화면
  if (mode === 'choice') {
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
                  href="https://saint.yebom.org/login?redirect=https://finance.yebom.org/expense-claim"
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

                {/* 작정헌금 입력 버튼 */}
                <button
                  onClick={() => setShowPledgeModal(true)}
                  className="w-full p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left group"
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
                </button>

                {/* 연말정산 정보입력 버튼 */}
                <button
                  onClick={() => setShowTaxInfoModal(true)}
                  className="w-full p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all text-left group"
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
                </button>

                {/* 예봄성도 로그인 (교적부 SSO) */}
                <a
                  href={`https://saint.yebom.org/login?redirect=https://finance.yebom.org${redirectTo}`}
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

  // 로그인 폼 화면
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #2C3E50 0%, #1a2a3a 100%)',
      }}
    >
      <div className="w-full max-w-md px-4">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-8">
            {/* Back Button */}
            <button
              onClick={() => setMode('choice')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, #C9A962 0%, #D4B87A 100%)',
                  boxShadow: '0 4px 16px rgba(201, 169, 98, 0.3)'
                }}
              >
                ⛪
              </div>
              <h1 className="font-semibold text-xl text-[#2C3E50]">
                예봄교회 재정부
              </h1>
              <p className="text-gray-500 text-sm mt-1">로그인</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-[12px] text-gray-500">이메일</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  className="mt-1 border-gray-200"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label className="text-[12px] text-gray-500">비밀번호</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••"
                  className="mt-1 border-gray-200"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2C3E50] hover:bg-[#1a2a3a] text-white mt-6"
              >
                <LogIn className="w-4 h-4 mr-2" />
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <a
                href="https://saint.yebom.org/join?from=finance"
                className="text-sm text-gray-500 hover:text-[#2C3E50] flex items-center justify-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                예봄서비스 가입하기
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              * 가입 후 관리자 승인이 필요합니다
            </p>
          </CardContent>
        </Card>
      </div>
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
