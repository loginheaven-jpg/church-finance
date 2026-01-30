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
import { Loader2, Search, User, Heart, CheckCircle2, LogIn, UserPlus, X, Edit3, Plus, Building2, Globe, Calendar, ArrowLeft } from 'lucide-react';
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
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<DonorInfo[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<DonorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [existingPledges, setExistingPledges] = useState<Pledge[]>([]);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [isCheckingPledges, setIsCheckingPledges] = useState(false);

  // 헌금자 목록 조회
  useEffect(() => {
    if (open) {
      fetchDonors();
    }
  }, [open]);

  // 로그인 사용자의 경우 자동으로 이름 선택
  useEffect(() => {
    if (loggedInName && donors.length > 0) {
      const found = donors.find(
        d => d.donor_name === loggedInName || d.representative === loggedInName
      );
      if (found) {
        setSelectedDonor(found);
        setStep('pledge');
      }
    }
  }, [loggedInName, donors]);

  // 검색어 필터링
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredDonors(
        donors.filter(
          d =>
            d.donor_name.toLowerCase().includes(query) ||
            d.representative.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredDonors(donors);
    }
  }, [searchQuery, donors]);

  const fetchDonors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/donors');
      const data = await res.json();
      if (data.success) {
        // 중복 제거된 대표자 + 헌금자 목록
        const uniqueNames = new Map<string, DonorInfo>();
        for (const d of data.data) {
          if (!uniqueNames.has(d.donor_name)) {
            uniqueNames.set(d.donor_name, d);
          }
        }
        setDonors(Array.from(uniqueNames.values()));
      }
    } catch (error) {
      console.error('Failed to fetch donors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDonorSelect = async (donor: DonorInfo) => {
    setSelectedDonor(donor);
    setIsCheckingPledges(true);

    try {
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/pledges?donor_name=${encodeURIComponent(donor.donor_name)}&year=${currentYear}`);
      const data = await res.json();

      if (data.success && data.pledges && data.pledges.length > 0) {
        // 기존 작정이 있음
        setExistingPledges(data.pledges);
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
        <DialogContent className="sm:max-w-[460px]">
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
                  className="flex items-center justify-between p-4 border rounded-lg bg-slate-50"
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
        <DialogContent className="sm:max-w-[400px]">
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

  // 이름 선택 화면
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-rose-500" />
            작정헌금 입력
          </DialogTitle>
          <DialogDescription>
            이름을 선택해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 검색 입력 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 헌금자 목록 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="h-[300px] border rounded-lg overflow-y-auto">
              {filteredDonors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? '검색 결과가 없습니다' : '등록된 헌금자가 없습니다'}
                </div>
              ) : (
                <div className="p-2">
                  {filteredDonors.map((donor, index) => (
                    <button
                      key={`${donor.donor_name}-${index}`}
                      onClick={() => handleDonorSelect(donor)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{donor.donor_name}</p>
                        {donor.representative !== donor.donor_name && (
                          <p className="text-xs text-slate-500">
                            대표: {donor.representative}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            ※ 목록에 이름이 없으면 재정부에 문의해주세요
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
