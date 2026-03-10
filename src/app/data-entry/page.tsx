'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CashOfferingSync } from '@/components/data-entry/CashOfferingSync';
import { BankUpload } from '@/components/data-entry/BankUpload';
import { FinanceReflection } from '@/components/data-entry/FinanceReflection';
import { IncomeCorrection } from '@/components/data-entry/IncomeCorrection';

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState('sync');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">데이터 입력</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sync" className="text-xs sm:text-sm">현금헌금 동기화</TabsTrigger>
          <TabsTrigger value="bank" className="text-xs sm:text-sm">은행원장 입력</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs sm:text-sm">미반영 처리</TabsTrigger>
          <TabsTrigger value="correction" className="text-xs sm:text-sm">수입부 데이터보정</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="mt-6">
          <CashOfferingSync />
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
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
