'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Heart, CheckCircle2, LogIn, UserPlus, X, Edit3, Plus, Building2, Globe, Calendar, ArrowLeft, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PledgeModal } from './PledgeModal';
import type { DonorInfo, Pledge, OfferingType } from '@/types';

const OFFERING_ICONS: Record<OfferingType, React.ReactNode> = {
  building: <Building2 className="h-4 w-4" />,
  mission: <Globe className="h-4 w-4" />,
  weekly: <Calendar className="h-4 w-4" />,
};

const OFFERING_LABELS: Record<OfferingType, string> = {
  building: '성전봉헌',
  mission: '선교',
  weekly: '주정',
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: '주정',
  monthly: '월정',
  yearly: '연간',
};

interface PledgeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 로그인 사용자의 이름 (자동 선택) */
  loggedInName?: string;
  onSuccess?: () => void;
}

export function PledgeEntryModal({
  open,
  onOpenChange,
  loggedInName,
  onSuccess,
}: PledgeEntryModalProps) {
  const [step, setStep] = useState<'select' | 'existing' | 'pledge' | 'complete'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDonor, setSelectedDonor] = useState<DonorInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [existingPledges, setExistingPledges] = useState<Pledge[]>([]);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [isCheckingPledges, setIsCheckingPledges] = useState(false);

  // 로그인 사용자의 경우 자동으로 이름 검색
  useEffect(() => {
    if (open && loggedInName) {
      setSearchQuery(loggedInName);
      handleSearch(loggedInName);
    }
  }, [open, loggedInName]);

  // 이름 검색 함수
  const handleSearch = async (nameToSearch?: string) => {
    const name = nameToSearch || searchQuery.trim();
    if (!name) {
      setSearchError('이름을 입력해주세요');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/donors/public?search=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.success && data.data) {
        // 정확히 일치하는 이름 찾기
        const exactMatch = data.data.find(
          (d: DonorInfo) => d.donor_name === name || d.representative === name
        );

        if (exactMatch) {
          handleDonorSelect(exactMatch);
        } else {
          setSearchError('교적부에서 성함이 발견되지 않습니다. 먼저 등록해 주시기 바랍니다.');
        }
      } else {
        setSearchError('교적부에서 성함이 발견되지 않습니다. 먼저 등록해 주시기 바랍니다.');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('검색 중 오류가 발생했습니다');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDonorSelect = async (donor: DonorInfo) => {
    setSelectedDonor(donor);
    setIsCheckingPledges(true);

    try {
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/pledges?donor_name=${encodeURIComponent(donor.donor_name)}&year=${currentYear}`);
      const result = await res.json();

      if (result.success && result.data?.pledges && result.data.pledges.length > 0) {
        // 기존 작정이 있음
        setExistingPledges(result.data.pledges);
        setStep('existing');
      } else {
        // 기존 작정이 없음 → 바로 새 작정 입력
        setStep('pledge');
      }
    } catch (error) {
      console.error('Failed to check existing pledges:', error);
      // 에러 시에도 새 작정 입력으로 진행
      setStep('pledge');
    } finally {
      setIsCheckingPledges(false);
    }
  };

  const handlePledgeSuccess = () => {
    setStep('complete');
    onSuccess?.();
  };

  const handleClose = () => {
    setStep('select');
    setSelectedDonor(null);
    setSearchQuery('');
    setSearchError(null);
    setExistingPledges([]);
    setEditingPledge(null);
    onOpenChange(false);
  };

  const handleEditPledge = (pledge: Pledge) => {
    setEditingPledge(pledge);
    setStep('pledge');
  };

  const handleAddNewPledge = () => {
    setEditingPledge(null);
    setStep('pledge');
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedDonor(null);
    setSearchError(null);
    setExistingPledges([]);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 기존 작정 내역 화면
  if (step === 'existing' && selectedDonor) {
    const currentYear = new Date().getFullYear();

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
          <DialogHeader>
            <button
              onClick={handleBackToSelect}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              다른 이름 선택
            </button>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Heart className="h-5 w-5 text-rose-500" />
              작정하신 내용이 있습니다
            </DialogTitle>
            <DialogDescription>
              {selectedDonor.donor_name}님의 {currentYear}년 작정 내역입니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 기존 작정 목록 */}
            <div className="space-y-3">
              {existingPledges.map((pledge) => (
                <div
                  key={pledge.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border rounded-lg bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      pledge.offering_type === 'building'
                        ? 'bg-amber-100 text-amber-600'
                        : pledge.offering_type === 'mission'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {OFFERING_ICONS[pledge.offering_type]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {OFFERING_LABELS[pledge.offering_type]}
                      </p>
                      <p className="text-sm text-slate-500">
                        {PERIOD_LABELS[pledge.pledge_period]} {formatAmount(pledge.amount)}원
                      </p>
                      <p className="text-xs text-slate-400">
                        {pledge.start_month}월 ~ {pledge.end_month}월
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPledge(pledge)}
                    className="flex items-center gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    수정
                  </Button>
                </div>
              ))}
            </div>

            {/* 새 작정 추가 버튼 */}
            <Button
              onClick={handleAddNewPledge}
              variant="outline"
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              다른 종류 작정 추가
            </Button>

            {/* 종료 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="flex-1 text-slate-500"
              >
                닫기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 작정 모달로 전환 시
  if (step === 'pledge' && selectedDonor) {
    return (
      <PledgeModal
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose();
          }
        }}
        donorName={selectedDonor.donor_name}
        representative={selectedDonor.representative}
        existingPledge={editingPledge}
        onSuccess={handlePledgeSuccess}
      />
    );
  }

  // 완료 화면
  if (step === 'complete') {
    // 비로그인 사용자: 선택 옵션 표시
    const isNonLoggedIn = !loggedInName;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[400px]">
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              작정이 등록되었습니다!
            </h3>
            <p className="text-slate-600 mb-6">
              감사합니다. 귀한 헌금으로 하나님 나라를 세워갑니다.
            </p>

            {isNonLoggedIn ? (
              <div className="space-y-3">
                <Link href="/login" className="block">
                  <Button className="w-full bg-[#2C3E50] hover:bg-[#1a2a3a]">
                    <LogIn className="w-4 h-4 mr-2" />
                    재정시스템 로그인
                  </Button>
                </Link>
                <Link href="/register" className="block">
                  <Button variant="outline" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    회원가입
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="w-full text-slate-500"
                >
                  <X className="w-4 h-4 mr-2" />
                  종료
                </Button>
              </div>
            ) : (
              <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                확인
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 이름 검색 화면
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-rose-500" />
            작정헌금 입력
          </DialogTitle>
          <DialogDescription>
            이름을 입력하고 검색해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 이름 검색 입력 */}
          <div className="space-y-2">
            <Label>이름</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="이름을 입력하세요"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                disabled={isSearching}
              />
              <Button
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-rose-500 hover:bg-rose-600"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {searchError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{searchError}</p>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            ※ 교적부에 등록된 이름으로 검색해주세요
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
