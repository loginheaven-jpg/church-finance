'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { PledgeEntryModal } from './PledgeEntryModal';

interface PledgePromptPopupProps {
  /** 사용자 이름 */
  userName: string;
  /** 건축헌금 작정 여부 */
  hasBuildingPledge: boolean;
  /** 선교헌금 작정 여부 */
  hasMissionPledge: boolean;
  /** 팝업 닫힘 콜백 */
  onDismiss: () => void;
}

const DISMISS_KEY = 'pledge_prompt_dismiss_date';

export function PledgePromptPopup({
  userName,
  hasBuildingPledge,
  hasMissionPledge,
  onDismiss,
}: PledgePromptPopupProps) {
  const [open, setOpen] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);

  // 둘 다 있으면 팝업 표시 안함
  const isComplete = hasBuildingPledge && hasMissionPledge;

  // 오늘 닫음 여부 체크
  useEffect(() => {
    if (isComplete) {
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
  }, [isComplete, onDismiss]);

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

  const handlePledgeSuccess = () => {
    setShowPledgeModal(false);
    onDismiss();
  };

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

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleLater()}>
      <AlertDialogContent className="sm:max-w-[380px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-lg">
            🙏 작정헌금 안내
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base pt-2">
            성전봉헌과 선교를 위해<br />
            작정헌금을 입력하시겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={handleLater}
            className="flex-1"
          >
            다음에
          </Button>
          <Button
            onClick={handlePledgeClick}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            지금 입력
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
