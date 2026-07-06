'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { CashOfferingSync } from '@/components/data-entry/CashOfferingSync';
import { BankUpload } from '@/components/data-entry/BankUpload';
import { FinanceReflection } from '@/components/data-entry/FinanceReflection';
import { IncomeCorrection } from '@/components/data-entry/IncomeCorrection';
import { useFinanceSession } from '@/lib/auth/use-finance-session';

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState('sync');
  const session = useFinanceSession();
  const isSuperAdmin = session?.finance_role === 'super_admin';

  // super_admin 클릭 시 재정관리 구글시트를 새 탭으로 오픈
  const handleOpenLedger = async () => {
    try {
      const res = await fetch('/api/admin/finance-sheet-url');
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(data.error || '원장 URL 조회 실패');
      }
    } catch {
      toast.error('원장 열기 중 오류');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">데이터 입력</h1>
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenLedger}
            title="재정관리 구글시트 (원장) 열기"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            원장
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sync" className="text-xs sm:text-sm">현금헌금 동기화</TabsTrigger>
          <TabsTrigger value="bank" className="text-xs sm:text-sm">은행원장 입력</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs sm:text-sm">미처리 확인</TabsTrigger>
          <TabsTrigger value="correction" className="text-xs sm:text-sm">수입부 데이터보정</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="mt-6">
          <CashOfferingSync />
        </TabsContent>

        <TabsContent value="bank" className="mt-6 space-y-6">
          <BankUpload />
        </TabsContent>

        <TabsContent value="finance" className="mt-6">
          <FinanceReflection />
        </TabsContent>

        <TabsContent value="correction" className="mt-6">
          <IncomeCorrection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
