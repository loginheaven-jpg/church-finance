'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Target,
  ChevronLeft,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

type PledgeType = '건축헌금' | '선교헌금';

interface PledgeWithFulfillment {
  id: string;
  year: number;
  type: PledgeType;
  donor_name: string;
  representative: string;
  pledged_amount: number;
  fulfilled_amount: number;
  fulfillment_rate: number;
  note?: string;
  created_at: string;
  updated_at: string;
}

export default function PledgeManagementPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedType, setSelectedType] = useState<PledgeType>('건축헌금');
  const [pledges, setPledges] = useState<PledgeWithFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPledge, setEditingPledge] = useState<PledgeWithFulfillment | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState({
    donor_name: '',
    representative: '',
    pledged_amount: '',
    note: '',
  });

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [year, selectedType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/pledge?year=${year}&type=${selectedType}&withFulfillment=true`);
      const data = await res.json();

      if (data.success) {
        setPledges(data.data || []);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      donor_name: '',
      representative: '',
      pledged_amount: '',
      note: '',
    });
    setEditingPledge(null);
  };

  // 수정 모드
  const handleEdit = (pledge: PledgeWithFulfillment) => {
    setEditingPledge(pledge);
    setFormData({
      donor_name: pledge.donor_name,
      representative: pledge.representative,
      pledged_amount: String(pledge.pledged_amount),
      note: pledge.note || '',
    });
    setDialogOpen(true);
  };

  // 저장
  const handleSave = async () => {
    if (!formData.donor_name || !formData.pledged_amount) {
      toast.error('작정자명과 작정금액은 필수입니다');
      return;
    }

    setSaving(true);
    try {
      if (editingPledge) {
        // 수정
        const res = await fetch('/api/settings/pledge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPledge.id,
            pledged_amount: Number(formData.pledged_amount.replace(/,/g, '')),
            note: formData.note,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('작정헌금이 수정되었습니다');
        } else {
          throw new Error(data.error);
        }
      } else {
        // 추가
        const res = await fetch('/api/settings/pledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year,
            type: selectedType,
            donor_name: formData.donor_name,
            representative: formData.representative || formData.donor_name,
            pledged_amount: Number(formData.pledged_amount.replace(/,/g, '')),
            note: formData.note,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('작정헌금이 등록되었습니다');
        } else {
          throw new Error(data.error);
        }
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 작정헌금을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/settings/pledge?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('작정헌금이 삭제되었습니다');
        loadData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(String(error));
    }
  };

  // 합계 계산
  const totalPledged = pledges.reduce((sum, p) => sum + p.pledged_amount, 0);
  const totalFulfilled = pledges.reduce((sum, p) => sum + p.fulfilled_amount, 0);
  const overallRate = totalPledged > 0 ? Math.round((totalFulfilled / totalPledged) * 100) : 0;

  // 상태별 카운트
  const fulfilledCount = pledges.filter(p => p.fulfillment_rate >= 100).length;
  const inProgressCount = pledges.filter(p => p.fulfillment_rate > 0 && p.fulfillment_rate < 100).length;
  const notStartedCount = pledges.filter(p => p.fulfillment_rate === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">작정헌금 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            연간 헌금 작정 현황을 관리합니다
          </p>
          {/* Type Tabs */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={selectedType === '건축헌금' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('건축헌금')}
            >
              건축헌금
            </Button>
            <Button
              variant={selectedType === '선교헌금' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('선교헌금')}
            >
              선교헌금
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(y => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium w-20 text-center">{year}년</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(y => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Add Button */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                작정 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPledge ? '작정헌금 수정' : '작정헌금 등록'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="donor_name">작정자명 *</Label>
                    <Input
                      id="donor_name"
                      value={formData.donor_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, donor_name: e.target.value }))}
                      placeholder="홍길동"
                      disabled={!!editingPledge}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="representative">대표자명</Label>
                    <Input
                      id="representative"
                      value={formData.representative}
                      onChange={(e) => setFormData(prev => ({ ...prev, representative: e.target.value }))}
                      placeholder="대표자명 (비워두면 작정자명과 동일)"
                      disabled={!!editingPledge}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pledged_amount">작정금액 *</Label>
                    <Input
                      id="pledged_amount"
                      value={formData.pledged_amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setFormData(prev => ({
                          ...prev,
                          pledged_amount: value ? Number(value).toLocaleString() : ''
                        }));
                      }}
                      placeholder="1,200,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">비고</Label>
                    <Input
                      id="note"
                      value={formData.note}
                      onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="비고"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    저장
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">총 작정</div>
            <div className="text-xl font-bold text-slate-900">
              {totalPledged.toLocaleString()}원
            </div>
            <div className="text-xs text-slate-400">{pledges.length}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">총 실행</div>
            <div className="text-xl font-bold text-green-600">
              {totalFulfilled.toLocaleString()}원
            </div>
            <div className="text-xs text-slate-400">{overallRate}% 달성</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">완료</div>
            <div className="text-xl font-bold text-blue-600">{fulfilledCount}명</div>
            <div className="text-xs text-slate-400">100% 이상</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">진행중</div>
            <div className="text-xl font-bold text-yellow-600">{inProgressCount}명</div>
            <div className="text-xs text-slate-400">1~99%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-slate-500">미시작</div>
            <div className="text-xl font-bold text-red-600">{notStartedCount}명</div>
            <div className="text-xs text-slate-400">0%</div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            전체 달성률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>실행 / 작정</span>
              <span className="font-medium">
                {totalFulfilled.toLocaleString()} / {totalPledged.toLocaleString()}원
              </span>
            </div>
            <Progress value={Math.min(overallRate, 100)} className="h-3" />
            <div className="text-right text-sm text-slate-500">
              {overallRate}% 달성
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pledge List */}
      <Card>
        <CardHeader>
          <CardTitle>작정 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {pledges.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              등록된 작정헌금이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>작정자</TableHead>
                  <TableHead>대표자</TableHead>
                  <TableHead className="text-right">작정금액</TableHead>
                  <TableHead className="text-right">실행금액</TableHead>
                  <TableHead className="w-32">달성률</TableHead>
                  <TableHead>비고</TableHead>
                  <TableHead className="w-24 text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges.map((pledge) => (
                  <TableRow key={pledge.id}>
                    <TableCell className="font-medium">{pledge.donor_name}</TableCell>
                    <TableCell className="text-slate-500">
                      {pledge.representative !== pledge.donor_name ? pledge.representative : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {pledge.pledged_amount.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={pledge.fulfillment_rate >= 100 ? 'text-green-600 font-medium' : ''}>
                        {pledge.fulfilled_amount.toLocaleString()}원
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress
                          value={Math.min(pledge.fulfillment_rate, 100)}
                          className={`h-2 ${
                            pledge.fulfillment_rate >= 100
                              ? '[&>div]:bg-green-500'
                              : pledge.fulfillment_rate >= 50
                              ? '[&>div]:bg-yellow-500'
                              : '[&>div]:bg-red-500'
                          }`}
                        />
                        <div className="text-xs text-right text-slate-500">
                          {pledge.fulfillment_rate}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {pledge.note || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(pledge)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(pledge.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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
    </div>
  );
}
