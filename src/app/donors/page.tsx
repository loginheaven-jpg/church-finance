'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, Users, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { DonorInfo } from '@/types';

export default function DonorsPage() {
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<DonorInfo[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<DonorInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    representative: '',
    donor_name: '',
    relationship: '',
    registration_number: '',
    address: '',
    phone: '',
    email: '',
    note: '',
  });

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/donors?${params}`);
      const data = await res.json();

      if (data.success) {
        setDonors(data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('헌금자 목록을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDonors();
  };

  const openAddDialog = () => {
    setSelectedDonor(null);
    setFormData({
      representative: '',
      donor_name: '',
      relationship: '',
      registration_number: '',
      address: '',
      phone: '',
      email: '',
      note: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (donor: DonorInfo) => {
    setSelectedDonor(donor);
    setFormData({
      representative: donor.representative,
      donor_name: donor.donor_name,
      relationship: donor.relationship || '',
      registration_number: donor.registration_number || '',
      address: donor.address || '',
      phone: donor.phone || '',
      email: donor.email || '',
      note: donor.note || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (donor: DonorInfo) => {
    setSelectedDonor(donor);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.representative || !formData.donor_name) {
      toast.error('대표자명과 헌금자명은 필수입니다');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedDonor) {
        // 수정
        const res = await fetch('/api/donors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            representative: selectedDonor.representative,
            donor_name: selectedDonor.donor_name,
            updates: formData,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('헌금자 정보가 수정되었습니다');
        } else {
          toast.error(data.error);
        }
      } else {
        // 추가
        const res = await fetch('/api/donors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('헌금자가 추가되었습니다');
        } else {
          toast.error(data.error);
        }
      }
      setDialogOpen(false);
      fetchDonors();
    } catch (error) {
      console.error(error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDonor) return;

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        representative: selectedDonor.representative,
        donor_name: selectedDonor.donor_name,
      });
      const res = await fetch(`/api/donors?${params}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast.success('헌금자가 삭제되었습니다');
        setDeleteDialogOpen(false);
        fetchDonors();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('삭제 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 주민등록번호 마스킹 표시
  const maskRegNum = (regNum?: string) => {
    if (!regNum || regNum.length < 7) return regNum || '-';
    return regNum.substring(0, 8) + '******';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">헌금자 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDonors}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            헌금자 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            헌금자 목록
          </CardTitle>
          <CardDescription>
            기부금영수증 발급을 위한 헌금자 정보를 관리합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 검색 */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <Input
              placeholder="대표자명 또는 헌금자명으로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" variant="outline">
              <Search className="mr-2 h-4 w-4" />
              검색
            </Button>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : donors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              등록된 헌금자가 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대표자명</TableHead>
                  <TableHead>헌금자명</TableHead>
                  <TableHead>관계</TableHead>
                  <TableHead>주민등록번호</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donors.map((donor, idx) => (
                  <TableRow key={`${donor.representative}-${donor.donor_name}-${idx}`}>
                    <TableCell className="font-medium">{donor.representative}</TableCell>
                    <TableCell>{donor.donor_name}</TableCell>
                    <TableCell>{donor.relationship || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {maskRegNum(donor.registration_number)}
                    </TableCell>
                    <TableCell>{donor.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(donor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openDeleteDialog(donor)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDonor ? '헌금자 정보 수정' : '헌금자 추가'}
            </DialogTitle>
            <DialogDescription>
              기부금영수증 발급에 필요한 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="representative">대표자명 *</Label>
                <Input
                  id="representative"
                  value={formData.representative}
                  onChange={(e) =>
                    setFormData({ ...formData, representative: e.target.value })
                  }
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donor_name">헌금자명 *</Label>
                <Input
                  id="donor_name"
                  value={formData.donor_name}
                  onChange={(e) =>
                    setFormData({ ...formData, donor_name: e.target.value })
                  }
                  placeholder="홍길동"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relationship">관계</Label>
                <Input
                  id="relationship"
                  value={formData.relationship}
                  onChange={(e) =>
                    setFormData({ ...formData, relationship: e.target.value })
                  }
                  placeholder="본인, 배우자, 자녀 등"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration_number">주민등록번호</Label>
                <Input
                  id="registration_number"
                  value={formData.registration_number}
                  onChange={(e) =>
                    setFormData({ ...formData, registration_number: e.target.value })
                  }
                  placeholder="800101-1234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="서울시 강남구 ..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="010-1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">비고</Label>
              <Input
                id="note"
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>헌금자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDonor?.donor_name} 님의 정보를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
