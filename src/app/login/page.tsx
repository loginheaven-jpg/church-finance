'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, AlertCircle, Heart, ArrowLeft, Building2, Globe } from 'lucide-react';
import { PledgeEntryModal } from '@/components/pledge';

type PageMode = 'choice' | 'login';

export default function LoginPage() {
  const [mode, setMode] = useState<PageMode>('choice');
  const [showPledgeModal, setShowPledgeModal] = useState(false);
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
        window.location.href = '/dashboard';
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
              <div className="text-center py-8 bg-gradient-to-br from-[#f8f6f0] to-[#f0ebe0]">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #C9A962 0%, #D4B87A 100%)',
                    boxShadow: '0 4px 16px rgba(201, 169, 98, 0.3)'
                  }}
                >
                  ⛪
                </div>
                <h1 className="font-semibold text-2xl text-[#2C3E50]">
                  예봄교회 재정시스템
                </h1>
                <p className="text-gray-500 text-sm mt-2">
                  무엇을 도와드릴까요?
                </p>
              </div>

              {/* Choice Buttons */}
              <div className="p-6 space-y-4">
                {/* 작정헌금 입력 버튼 */}
                <button
                  onClick={() => setShowPledgeModal(true)}
                  className="w-full p-5 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-green-800">
                        작정헌금 입력
                      </h3>
                      <p className="text-sm text-green-600 mt-1">
                        성전봉헌, 선교헌금 작정
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                          <Building2 className="w-3 h-3" />
                          건축
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                          <Globe className="w-3 h-3" />
                          선교
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 재정시스템 로그인 버튼 */}
                <button
                  onClick={() => setMode('login')}
                  className="w-full p-5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#2C3E50] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <LogIn className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-800">
                        재정시스템 로그인
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        재정부 관계자 전용
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 작정헌금 입력 모달 */}
        <PledgeEntryModal
          open={showPledgeModal}
          onOpenChange={setShowPledgeModal}
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
              <Link
                href="/register"
                className="text-sm text-gray-500 hover:text-[#2C3E50] flex items-center justify-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                가입 신청하기
              </Link>
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
