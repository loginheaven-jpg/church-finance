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
import { Loader2, Search, User, FileText, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { DonorInfo } from '@/types';

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
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<DonorInfo[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState<TaxInfoData>({
    name: '',
    residentId1: '',
    residentId2: '',
    address: '',
  });

  const residentId2Ref = useRef<HTMLInputElement>(null);

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
        handleNameSelect(found.donor_name);
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
      // 공개 API 사용 (로그인 불필요)
      const res = await fetch('/api/donors/public');
      const data = await res.json();
      if (data.success) {
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

  const handleNameSelect = async (name: string) => {
    setSelectedName(name);
    setFormData(prev => ({ ...prev, name }));

    // 기존 데이터 로드
    try {
      const res = await fetch(`/api/donors/lookup?name=${encodeURIComponent(name)}`);
      const result = await res.json();

      if (result.success && result.data) {
        const { resident_id, address } = result.data;

        if (resident_id) {
          const parts = resident_id.replace(/\s/g, '').split('-');
          if (parts.length === 2) {
            setFormData(prev => ({
              ...prev,
              residentId1: parts[0],
              residentId2: parts[1],
              address: address || '',
            }));
          } else if (resident_id.length >= 6) {
            setFormData(prev => ({
              ...prev,
              residentId1: resident_id.substring(0, 6),
              residentId2: resident_id.substring(6) || '',
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
    setFormData({ name: '', residentId1: '', residentId2: '', address: '' });
    onOpenChange(false);
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedName(null);
  };

  const getMaskedResidentId = () => {
    const front = formData.residentId1 || '______';
    const back = formData.residentId2
      ? formData.residentId2.charAt(0) + '******'
      : '_______';
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
                <div className="flex items-center gap-2">
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
                  <Input
                    ref={residentId2Ref}
                    type="password"
                    inputMode="numeric"
                    placeholder="0000000"
                    value={formData.residentId2}
                    onChange={(e) => handleResidentId2Change(e.target.value)}
                    className="text-center tracking-wider"
                    maxLength={7}
                  />
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
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">이름</span>
                      <span className="font-medium text-slate-800">{selectedName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">주민등록번호</span>
                      <span className="font-medium text-slate-800 font-mono">
                        {getMaskedResidentId()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">주소</span>
                      <span className="font-medium text-slate-800 text-right max-w-[200px] truncate">
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

  // 이름 선택 화면
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-blue-600" />
            연말정산 정보입력
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
            <div className="h-[200px] sm:h-[300px] border rounded-lg overflow-y-auto">
              {filteredDonors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? '검색 결과가 없습니다' : '등록된 헌금자가 없습니다'}
                </div>
              ) : (
                <div className="p-2">
                  {filteredDonors.map((donor, index) => (
                    <button
                      key={`${donor.donor_name}-${index}`}
                      onClick={() => handleNameSelect(donor.donor_name)}
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
