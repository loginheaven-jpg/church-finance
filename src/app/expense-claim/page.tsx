'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink } from 'lucide-react';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import ExpenseClaimVerification from '@/components/expense-claim/ExpenseClaimVerification';
import { ClaimSubmitForm } from '@/components/expense-claim/ClaimSubmitForm';
import { ClaimList } from '@/components/expense-claim/ClaimList';

export default function ExpenseClaimPage() {
  const session = useFinanceSession();
  const isSuperAdmin = session?.finance_role === 'super_admin';
  const [activeTab, setActiveTab] = useState('submit');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">지출청구</h1>
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(
              'https://docs.google.com/spreadsheets/d/1Ap1me_my23FKgOLQFcfz0IrGEzCOBSrk56e-rHzsays/edit?gid=542803123#gid=542803123',
              '_blank'
            )}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            원장보기
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="submit">청구 입력</TabsTrigger>
          <TabsTrigger value="list">청구 현황</TabsTrigger>
          <TabsTrigger value="verification">처리내역 점검</TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="mt-6">
          <ClaimSubmitForm
            userName={session?.name || ''}
            onSuccess={() => setActiveTab('list')}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ClaimList />
        </TabsContent>

        <TabsContent value="verification" className="mt-6">
          <ExpenseClaimVerification />
        </TabsContent>
      </Tabs>
    </div>
  );
}
