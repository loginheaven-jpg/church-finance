'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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
        router.push('/dashboard');
        router.refresh();
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
