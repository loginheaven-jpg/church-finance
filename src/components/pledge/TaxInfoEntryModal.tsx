'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Search, FileText, CheckCircle2, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface TaxInfoEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 로그인 사용자의 이름 (자동 선택) */
  loggedInName?: string;
  onSuccess?: () => void;
}

interface TaxInfoData {
  name: string;
  residentId1: string;
  residentId2: string;
  address: string;
}

export function TaxInfoEntryModal({
  open,
  onOpenChange,
  loggedInName,
  onSuccess,
}: TaxInfoEntryModalProps) {
  const [step, setStep] = useState<'select' | 'input' | 'complete'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResidentId2, setShowResidentId2] = useState(true); // 입력 중에는 보이기
  const [formData, setFormData] = useState<TaxInfoData>({
    name: '',
    residentId1: '',
    residentId2: '',
    address: '',
  });

  const residentId2Ref = useRef<HTMLInputElement>(null);

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
          (d: { donor_name: string; representative: string }) =>
            d.donor_name === name || d.representative === name
        );

        if (exactMatch) {
          handleNameSelect(exactMatch.donor_name);
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

  const handleNameSelect = async (name: string) => {
    setSelectedName(name);
    setFormData(prev => ({ ...prev, name }));

    // 본인 데이터만 로드 (보안: 다른 사람의 주민번호/주소 노출 방지)
    if (loggedInName && name === loggedInName) {
      try {
        const res = await fetch(`/api/donors/lookup?name=${encodeURIComponent(name)}`);
        const result = await res.json();

        if (result.success && result.data) {
          const { resident_id, address } = result.data;

          if (resident_id) {
            // 기존 주민번호가 있으면 앞 6자리만 표시, 뒷자리는 빈칸으로 (재입력 필요)
            const parts = resident_id.replace(/\s/g, '').split('-');
            if (parts.length === 2) {
              setFormData(prev => ({
                ...prev,
                residentId1: parts[0],
                residentId2: '', // 뒷자리는 보안상 빈칸으로 재입력
                address: address || '',
              }));
            } else if (resident_id.length >= 6) {
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
        console.error('Load existing data error:', error);
      }
    } else {
      // 다른 사람 이름 검색 시 빈칸으로 시작 (개인정보 보호)
      setFormData(prev => ({
        ...prev,
        residentId1: '',
        residentId2: '',
        address: '',
      }));
    }

    setStep('input');
  };

  const handleResidentId1Change = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, residentId1: numericValue }));
    if (numericValue.length === 6) {
      residentId2Ref.current?.focus();
    }
  };

  const handleResidentId2Change = (value: string) => {
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
          name: selectedName,
          resident_id: residentId,
          address: formData.address.trim(),
        }),
      });

      const result = await res.json();

      if (result.success) {
        setStep('complete');
        onSuccess?.();
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

  const handleClose = () => {
    setStep('select');
    setSelectedName(null);
    setSearchQuery('');
    setSearchError(null);
    setFormData({ name: '', residentId1: '', residentId2: '', address: '' });
    onOpenChange(false);
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedName(null);
    setSearchError(null);
  };

  // 확인 팝업용 주민번호 표시 (전체 숫자 노출)
  const getFullResidentId = () => {
    const front = formData.residentId1 || '______';
    const back = formData.residentId2 || '_______';
    return `${front}-${back}`;
  };

  // 완료 화면
  if (step === 'complete') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[400px]">
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              정보가 저장되었습니다!
            </h3>
            <p className="text-slate-600 mb-6">
              연말정산 기부금영수증 발행에 활용됩니다.
            </p>
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 정보 입력 화면
  if (step === 'input' && selectedName) {
    return (
      <>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
            <DialogHeader>
              <button
                onClick={handleBackToSelect}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                다른 이름 선택
              </button>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                연말정산 정보입력
              </DialogTitle>
              <DialogDescription>
                기부금영수증 자동발행을 위한 정보를 입력해주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* 이름 (읽기 전용) */}
              <div className="space-y-2">
                <Label>이름</Label>
                <Input
                  value={selectedName}
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

            {/* 버튼 영역 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={saving}
              >
                취소
              </Button>
              <Button
                onClick={handleSaveClick}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={saving}
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
                      <span className="font-medium text-slate-800">{selectedName}</span>
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

  // 이름 검색 화면
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-blue-600" />
            연말정산 정보입력
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
                className="bg-blue-600 hover:bg-blue-700"
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
