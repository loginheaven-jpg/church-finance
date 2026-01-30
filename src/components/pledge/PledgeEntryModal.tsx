'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, User, Heart, CheckCircle2 } from 'lucide-react';
import { PledgeModal } from './PledgeModal';
import type { DonorInfo } from '@/types';

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
  const [step, setStep] = useState<'select' | 'pledge' | 'complete'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<DonorInfo[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<DonorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);

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

  const handleDonorSelect = (donor: DonorInfo) => {
    setSelectedDonor(donor);
    setStep('pledge');
  };

  const handlePledgeSuccess = () => {
    setStep('complete');
    onSuccess?.();
  };

  const handleClose = () => {
    setStep('select');
    setSelectedDonor(null);
    setSearchQuery('');
    onOpenChange(false);
  };

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
        onSuccess={handlePledgeSuccess}
      />
    );
  }

  // 완료 화면
  if (step === 'complete') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              작정이 등록되었습니다!
            </h3>
            <p className="text-slate-600 mb-6">
              감사합니다. 귀한 헌금으로 하나님 나라를 세워갑니다.
            </p>
            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
              확인
            </Button>
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
