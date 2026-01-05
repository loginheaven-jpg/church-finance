'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CashOfferingSync } from '@/components/data-entry/CashOfferingSync';
import { BankUpload } from '@/components/data-entry/BankUpload';
import { CardUpload } from '@/components/data-entry/CardUpload';

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState('sync');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">데이터 입력</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sync">현금헌금 동기화</TabsTrigger>
          <TabsTrigger value="bank">은행원장 업로드</TabsTrigger>
          <TabsTrigger value="card">카드내역 업로드</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="mt-6">
          <CashOfferingSync />
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
          <BankUpload />
        </TabsContent>

        <TabsContent value="card" className="mt-6">
          <CardUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
