'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { MatchingRule } from '@/types';

export default function MatchingRulesPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<MatchingRule[]>([]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/matching-rules');
      const data = await res.json();

      if (data.success) {
        setRules(data.data);
      } else {
        toast.error(data.error || '규칙 조회 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('규칙을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">매칭 규칙</h1>
        <Button variant="outline" onClick={fetchRules}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            자동 매칭 규칙
          </CardTitle>
          <CardDescription>
            수동 분류 시 자동으로 학습됩니다. 사용량이 높을수록 신뢰도가 높아집니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              학습된 매칭 규칙이 없습니다. 거래를 수동으로 분류하면 자동으로 규칙이 생성됩니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>유형</TableHead>
                  <TableHead>패턴</TableHead>
                  <TableHead>대상 항목</TableHead>
                  <TableHead className="text-right">신뢰도</TableHead>
                  <TableHead className="text-right">사용 횟수</TableHead>
                  <TableHead>생성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rule.rule_type === 'bank_income'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {rule.rule_type === 'bank_income' ? '수입' : '지출'}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {rule.pattern}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{rule.target_name}</div>
                        <div className="text-slate-500">코드: {rule.target_code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`font-medium ${
                        rule.confidence >= 0.8 ? 'text-green-600' :
                        rule.confidence >= 0.6 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {Math.round(rule.confidence * 100)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{rule.usage_count}회</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {rule.created_at?.split('T')[0] || '-'}
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
