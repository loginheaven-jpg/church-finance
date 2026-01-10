'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, X } from 'lucide-react';

interface ExpenseRecord {
  id: string;
  date: string;
  payment_method: string;
  vendor: string;
  description: string;
  amount: number;
  account_code: number;
  category_code: number;
  note: string;
}

interface ExpenseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountCode: number;
  accountName: string;
  year: number;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString() + '원';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

export function ExpenseDetailModal({
  open,
  onOpenChange,
  accountCode,
  accountName,
  year,
}: ExpenseDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (open && accountCode) {
      loadRecords();
    }
  }, [open, accountCode, year]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/expense/records?accountCode=${accountCode}&year=${year}`
      );
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records || []);
        setTotalAmount(data.data.summary?.totalAmount || 0);
      }
    } catch (error) {
      console.error('Load expense records error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {accountName} ({accountCode}) 지출 내역
          </DialogTitle>
          <DialogDescription>
            {year}년 총 집행: <span className="font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
            {' '}({records.length}건)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="h-10 w-10 mb-2 text-slate-300" />
              <p>지출 내역이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="py-2 px-3 text-left font-medium w-20">날짜</th>
                  <th className="py-2 px-3 text-left font-medium">내용</th>
                  <th className="py-2 px-3 text-right font-medium w-28">금액</th>
                  <th className="py-2 px-3 text-center font-medium w-20">수단</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr
                    key={record.id || idx}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3 text-slate-600">
                      {formatDate(record.date)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{record.description || record.vendor || '-'}</div>
                      {record.note && (
                        <div className="text-xs text-slate-500">{record.note}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {formatCurrency(record.amount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant="outline" className="text-xs">
                        {record.payment_method === '계좌이체' ? '계좌' :
                         record.payment_method === '법인카드' ? '카드' :
                         record.payment_method || '기타'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="font-semibold">
                  <td className="py-2 px-3">합계</td>
                  <td className="py-2 px-3">{records.length}건</td>
                  <td className="py-2 px-3 text-right text-blue-600">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
