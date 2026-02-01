'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { PledgeEntryModal } from './PledgeEntryModal';
import { TaxInfoModal } from './TaxInfoModal';
import { Church, FileText, CheckCircle2 } from 'lucide-react';

interface PledgePromptPopupProps {
  /** 사용자 이름 */
  userName: string;
  /** 건축헌금 작정 여부 */
  hasBuildingPledge: boolean;
  /** 선교헌금 작정 여부 */
  hasMissionPledge: boolean;
  /** 연말정산 정보 입력 여부 */
  hasTaxInfo: boolean;
  /** 팝업 닫힘 콜백 */
  onDismiss: () => void;
}

const DISMISS_KEY = 'member_prompt_dismiss_date';

export function PledgePromptPopup({
  userName,
  hasBuildingPledge,
  hasMissionPledge,
  hasTaxInfo,
  onDismiss,
}: PledgePromptPopupProps) {
  const [open, setOpen] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showTaxInfoModal, setShowTaxInfoModal] = useState(false);

  // 모든 항목이 완료되었으면 팝업 표시 안함
  const isPledgeComplete = hasBuildingPledge && hasMissionPledge;
  const isAllComplete = isPledgeComplete && hasTaxInfo;

  // 오늘 닫음 여부 체크
  useEffect(() => {
    if (isAllComplete) {
      onDismiss();
      return;
    }

    const dismissDate = localStorage.getItem(DISMISS_KEY);
    const today = new Date().toISOString().split('T')[0];

    if (dismissDate === today) {
      // 오늘 이미 닫았으면 표시 안함
      onDismiss();
    } else {
      setOpen(true);
    }
  }, [isAllComplete, onDismiss]);

  const handleLater = () => {
    // 오늘 하루 닫기
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(DISMISS_KEY, today);
    setOpen(false);
    onDismiss();
  };

  const handlePledgeClick = () => {
    setOpen(false);
    setShowPledgeModal(true);
  };

  const handleTaxInfoClick = () => {
    setOpen(false);
    setShowTaxInfoModal(true);
  };

  const handlePledgeSuccess = () => {
    setShowPledgeModal(false);
    onDismiss();
  };

  const handleTaxInfoSuccess = () => {
    setShowTaxInfoModal(false);
    onDismiss();
  };

  // 작정헌금 모달 표시
  if (showPledgeModal) {
    return (
      <PledgeEntryModal
        open={showPledgeModal}
        onOpenChange={(isOpen) => {
          setShowPledgeModal(isOpen);
          if (!isOpen) {
            onDismiss();
          }
        }}
        loggedInName={userName}
        onSuccess={handlePledgeSuccess}
      />
    );
  }

  // 연말정산 정보 모달 표시
  if (showTaxInfoModal) {
    return (
      <TaxInfoModal
        open={showTaxInfoModal}
        onOpenChange={(isOpen) => {
          setShowTaxInfoModal(isOpen);
          if (!isOpen) {
            onDismiss();
          }
        }}
        userName={userName}
        onSuccess={handleTaxInfoSuccess}
      />
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleLater()}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-lg">
            📋 정보 입력 안내
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* 카드 선택 영역 */}
        <div className="space-y-3 py-2">
          {/* 작정헌금 카드 */}
          <button
            onClick={handlePledgeClick}
            disabled={isPledgeComplete}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              isPledgeComplete
                ? 'border-green-200 bg-green-50 cursor-default'
                : 'border-slate-200 hover:border-green-500 hover:bg-green-50 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${isPledgeComplete ? 'bg-green-100' : 'bg-amber-100'}`}>
                {isPledgeComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Church className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">작정헌금 입력</span>
                  {isPledgeComplete && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">완료</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  성전봉헌과 선교를 위한 작정헌금을 입력합니다.
                </p>
              </div>
            </div>
          </button>

          {/* 연말정산 정보 카드 */}
          <button
            onClick={handleTaxInfoClick}
            disabled={hasTaxInfo}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              hasTaxInfo
                ? 'border-green-200 bg-green-50 cursor-default'
                : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${hasTaxInfo ? 'bg-green-100' : 'bg-blue-100'}`}>
                {hasTaxInfo ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <FileText className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">연말정산 정보입력</span>
                  {hasTaxInfo && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">완료</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  기부금영수증 자동발행을 원하시는 분은 입력하십시오.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  수집정보: 주민번호, 주민등록 주소
                </p>
              </div>
            </div>
          </button>
        </div>

        <AlertDialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={handleLater}
            className="w-full"
          >
            다음에 하기
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
