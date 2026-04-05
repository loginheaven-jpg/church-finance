'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

type Step = 'form' | 'complete';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!formData.email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (formData.password.length < 8 || !/\d/.test(formData.password)) {
      setError('비밀번호는 8자 이상, 숫자를 포함해야 합니다.');
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('complete');
      } else {
        setError(data.error || '가입 신청 중 오류가 발생했습니다.');
      }
    } catch {
      setError('서버 오류가 발생했습니다.');
    }

    setIsLoading(false);
  };

  // 완료 화면
  if (step === 'complete') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(180deg, #2C3E50 0%, #1a2a3a 100%)',
        }}
      >
        <div className="w-full max-w-md px-4">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-semibold text-xl text-[#2C3E50] mb-2">
                가입 신청 완료
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 text-sm font-medium">
                  {formData.name}님의 가입 신청이 접수되었습니다
                </p>
              </div>

              <p className="text-gray-500 text-sm mb-6">
                관리자 승인 후 로그인이 가능합니다.<br />
                승인까지 다소 시간이 걸릴 수 있습니다.
              </p>

              <Button
                onClick={() => router.push('/login')}
                className="bg-[#2C3E50] hover:bg-[#1a2a3a] text-white"
              >
                로그인 페이지로 이동
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 가입 폼
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
              <p className="text-gray-500 text-sm mt-1">가입 신청</p>
            </div>

            {/* 안내 메시지 */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              <p className="font-medium mb-1">📌 안내</p>
              <p className="text-xs">
                가입 신청 후 관리자 승인이 필요합니다.<br />
                승인 시 재정 역할이 부여됩니다.
              </p>
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
                <Label className="text-[12px] text-gray-500">이름 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="이름"
                  className="mt-1 border-gray-200"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label className="text-[12px] text-gray-500">이메일 *</Label>
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
                <Label className="text-[12px] text-gray-500">비밀번호 * (8자 이상, 숫자 포함)</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••"
                  className="mt-1 border-gray-200"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label className="text-[12px] text-gray-500">비밀번호 확인 *</Label>
                <Input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
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
                <UserPlus className="w-4 h-4 mr-2" />
                {isLoading ? '신청 중...' : '가입 신청'}
              </Button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-[#2C3E50] flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                로그인으로 돌아가기
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
