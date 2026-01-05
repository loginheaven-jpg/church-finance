'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { IncomeCode, ExpenseCode } from '@/types';

export default function CodesPage() {
  const [loading, setLoading] = useState(true);
  const [incomeCodes, setIncomeCodes] = useState<IncomeCode[]>([]);
  const [expenseCodes, setExpenseCodes] = useState<ExpenseCode[]>([]);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const [incomeRes, expenseRes] = await Promise.all([
        fetch('/api/codes/income'),
        fetch('/api/codes/expense'),
      ]);

      const incomeData = await incomeRes.json();
      const expenseData = await expenseRes.json();

      if (incomeData.success) setIncomeCodes(incomeData.data);
      if (expenseData.success) setExpenseCodes(expenseData.data);
    } catch (error) {
      console.error(error);
      toast.error('코드를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // 카테고리별 그룹화
  const groupedIncome = incomeCodes.reduce((acc, code) => {
    const key = `${code.category_code}_${code.category_item}`;
    if (!acc[key]) {
      acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
    }
    acc[key].codes.push(code);
    return acc;
  }, {} as Record<string, { category_code: number; category_item: string; codes: IncomeCode[] }>);

  const groupedExpense = expenseCodes.reduce((acc, code) => {
    const key = `${code.category_code}_${code.category_item}`;
    if (!acc[key]) {
      acc[key] = { category_code: code.category_code, category_item: code.category_item, codes: [] };
    }
    acc[key].codes.push(code);
    return acc;
  }, {} as Record<string, { category_code: number; category_item: string; codes: ExpenseCode[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">코드 관리</h1>

      <Tabs defaultValue="income">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="income" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            수입부 코드
          </TabsTrigger>
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            지출부 코드
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-6 space-y-4">
          {Object.values(groupedIncome).map((group) => (
            <Card key={group.category_code}>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">{group.category_item} ({group.category_code})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">코드</TableHead>
                      <TableHead>항목</TableHead>
                      <TableHead className="w-20">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.codes.map((code) => (
                      <TableRow key={code.code}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell>{code.item}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${code.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {code.active ? '활성' : '비활성'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {Object.keys(groupedIncome).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                수입부 코드가 없습니다. 시트를 초기화하세요.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expense" className="mt-6 space-y-4">
          {Object.values(groupedExpense).map((group) => (
            <Card key={group.category_code}>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">{group.category_item} ({group.category_code})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">코드</TableHead>
                      <TableHead>항목</TableHead>
                      <TableHead className="w-20">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.codes.map((code) => (
                      <TableRow key={code.code}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell>{code.item}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${code.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {code.active ? '활성' : '비활성'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {Object.keys(groupedExpense).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                지출부 코드가 없습니다. 시트를 초기화하세요.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
