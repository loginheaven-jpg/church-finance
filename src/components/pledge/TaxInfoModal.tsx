'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface TaxInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onSuccess: () => void;
}

interface TaxInfoData {
  name: string;
  residentId1: string; // 주민번호 앞자리 (6자리)
  residentId2: string; // 주민번호 뒷자리 (7자리)
  address: string;
}

export function TaxInfoModal({
  open,
  onOpenChange,
  userName,
  onSuccess,
}: TaxInfoModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResidentId2, setShowResidentId2] = useState(true); // 입력 중에는 보이기
  const [formData, setFormData] = useState<TaxInfoData>({
    name: userName,
    residentId1: '',
    residentId2: '',
    address: '',
  });

  const residentId2Ref = useRef<HTMLInputElement>(null);

  // 기존 데이터 로드
  useEffect(() => {
    if (open && userName) {
      loadExistingData();
    }
  }, [open, userName]);

  const loadExistingData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/donors/lookup?name=${encodeURIComponent(userName)}`);
      const result = await res.json();

      if (result.success && result.data) {
        const { resident_id, address } = result.data;

        // 주민번호 분리 - 앞 6자리만 표시, 뒷자리는 빈칸으로 (재입력 필요)
        if (resident_id) {
          const parts = resident_id.replace(/\s/g, '').split('-');
          if (parts.length === 2) {
            setFormData(prev => ({
              ...prev,
              residentId1: parts[0],
              residentId2: '', // 뒷자리는 보안상 빈칸으로 재입력
              address: address || '',
            }));
          } else if (resident_id.length >= 6) {
            // 하이픈 없이 저장된 경우
            setFormData(prev => ({
              ...prev,
              residentId1: resident_id.substring(0, 6),
              residentId2: '', // 뒷자리는 보안상 빈칸으로 재입력
              address: address || '',
            }));
          }
        } else {
          setFormData(prev => ({
            ...prev,
            address: address || '',
          }));
        }
      }
    } catch (error) {
      console.error('Load tax info error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResidentId1Change = (value: string) => {
    // 숫자만 허용, 최대 6자리
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, residentId1: numericValue }));

    // 6자리 입력 완료 시 뒷자리로 포커스 이동
    if (numericValue.length === 6) {
      residentId2Ref.current?.focus();
    }
  };

  const handleResidentId2Change = (value: string) => {
    // 숫자만 허용, 최대 7자리
    const numericValue = value.replace(/\D/g, '').slice(0, 7);
    setFormData(prev => ({ ...prev, residentId2: numericValue }));
  };

  const validateForm = () => {
    if (formData.residentId1.length !== 6) {
      toast.error('주민번호 앞자리 6자리를 입력해주세요');
      return false;
    }
    if (formData.residentId2.length !== 7) {
      toast.error('주민번호 뒷자리 7자리를 입력해주세요');
      return false;
    }
    if (!formData.address.trim()) {
      toast.error('주소를 입력해주세요');
      return false;
    }
    return true;
  };

  const handleSaveClick = () => {
    if (!validateForm()) return;
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);

    try {
      const residentId = `${formData.residentId1}-${formData.residentId2}`;

      const res = await fetch('/api/members/tax-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          resident_id: residentId,
          address: formData.address.trim(),
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success('연말정산 정보가 저장되었습니다');
        onSuccess();
      } else {
        toast.error(result.error || '저장 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error('Save tax info error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // 확인 팝업용 주민번호 표시 (전체 숫자 노출)
  const getFullResidentId = () => {
    const front = formData.residentId1 || '______';
    const back = formData.residentId2 || '_______';
    return `${front}-${back}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              연말정산 정보입력
            </DialogTitle>
            <DialogDescription>
              기부금영수증 자동발행을 위한 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* 이름 (읽기 전용) */}
              <div className="space-y-2">
                <Label>이름</Label>
                <Input
                  value={userName}
                  disabled
                  className="bg-slate-50"
                />
              </div>

              {/* 주민등록번호 */}
              <div className="space-y-2">
                <Label>주민등록번호</Label>
                <div className="grid grid-cols-[6fr_auto_7fr] items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={formData.residentId1}
                    onChange={(e) => handleResidentId1Change(e.target.value)}
                    className="text-center tracking-wider"
                    maxLength={6}
                  />
                  <span className="text-xl text-slate-400">-</span>
                  <div className="relative">
                    <Input
                      ref={residentId2Ref}
                      type={showResidentId2 ? "text" : "password"}
                      inputMode="numeric"
                      placeholder="0000000"
                      value={formData.residentId2}
                      onChange={(e) => handleResidentId2Change(e.target.value)}
                      onFocus={() => setShowResidentId2(true)}
                      onBlur={() => setShowResidentId2(false)}
                      className="text-center tracking-wider pr-10"
                      maxLength={7}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResidentId2(!showResidentId2)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showResidentId2 ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  주민등록번호는 암호화되어 안전하게 보관됩니다.
                </p>
              </div>

              {/* 주소 */}
              <div className="space-y-2">
                <Label>주민등록 주소</Label>
                <Input
                  type="text"
                  placeholder="주민등록상 주소를 입력해주세요"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={saving}
            >
              취소
            </Button>
            <Button
              onClick={handleSaveClick}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={loading || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 확인 팝업 */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              입력 정보 확인
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-slate-600">입력하신 정보가 정확한지 확인해주세요.</p>
                <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">이름</span>
                    <span className="font-medium text-slate-800">{userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">주민등록번호</span>
                    <span className="font-medium text-slate-800 font-mono">
                      {getFullResidentId()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500">주소</span>
                    <span className="font-medium text-slate-800 break-all">
                      {formData.address}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-blue-600">
                  정보가 정확하십니까?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>아니오</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-blue-600 hover:bg-blue-700"
            >
              예
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
