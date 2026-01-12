'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserCheck, UserX, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import { FinanceRole, ROLE_LABELS } from '@/lib/auth/finance-permissions';

interface User {
  user_id: string;
  email: string;
  name: string;
  permission_level: string;
  finance_role: FinanceRole | null;
  is_approved: boolean;
  created_at: string;
  member_id: string | null;
}

const FINANCE_ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-amber-100 text-amber-700 border-amber-300',
  admin: 'bg-blue-100 text-blue-700 border-blue-300',
  deacon: 'bg-green-100 text-green-700 border-green-300',
  member: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const session = useFinanceSession();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSessionChecked(true);
      if (!session || session.finance_role !== 'super_admin') {
        alert('접근 권한이 없습니다.');
        router.push('/dashboard');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [session, router]);

  const loadUsers = useCallback(async () => {
    if (!session || !supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, email, name, permission_level, finance_role, is_approved, created_at, member_id')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.message?.includes('finance_role')) {
          const { data: d2 } = await supabase
            .from('users')
            .select('user_id, email, name, permission_level, is_approved, created_at, member_id')
            .order('created_at', { ascending: false });
          if (d2) {
            const u = d2.map(x => ({ ...x, finance_role: null })) as User[];
            setUsers(u.filter(x => x.is_approved));
            setPendingUsers(u.filter(x => !x.is_approved));
          }
        }
      } else if (data) {
        const t = data as User[];
        setUsers(t.filter(x => x.is_approved));
        setPendingUsers(t.filter(x => !x.is_approved));
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    if (session && sessionChecked) loadUsers();
  }, [session, sessionChecked, loadUsers]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approveUser = async (userId: string) => {
    if (!session || !supabase) return;
    setActionLoading(userId);
    try {
      const { error } = await (supabase.from('users') as any).update({ is_approved: true, finance_role: 'member' }).eq('user_id', userId);
      if (error && error.message?.includes('finance_role')) {
        await (supabase.from('users') as any).update({ is_approved: true }).eq('user_id', userId);
      }
      await loadUsers();
    } catch (e) { console.error(e); alert('오류'); }
    setActionLoading(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectUser = async (userId: string) => {
    if (!confirm('거부하시겠습니까?')) return;
    if (!supabase) return;
    setActionLoading(userId);
    try {
      await (supabase.from('users') as any).delete().eq('user_id', userId);
      await loadUsers();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changeFinanceRole = async (userId: string, newRole: FinanceRole) => {
    if (!confirm('변경하시겠습니까?')) return;
    if (!supabase) return;
    setActionLoading(userId);
    try {
      await (supabase.from('users') as any).update({ finance_role: newRole }).eq('user_id', userId);
      await loadUsers();
    } catch (e) { console.error(e); alert('오류'); }
    setActionLoading(null);
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.getFullYear() + '.' + String(dt.getMonth()+1).padStart(2,'0') + '.' + String(dt.getDate()).padStart(2,'0');
  };

  const getDisplayRole = (u: User): FinanceRole => {
    if (u.finance_role) return u.finance_role;
    if (u.permission_level === 'super_admin') return 'super_admin';
    return 'member';
  };

  if (!sessionChecked || !session) return <div className="p-6 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-amber-500" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">사용자 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">재정부 사용자 가입 승인 및 권한 관리</p>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">가입 대기 ({pendingUsers.length})</h2>
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-300" />
              <span>대기 중인 가입 신청이 없습니다.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">신청일</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.user_id} className="border-b">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" onClick={() => approveUser(u.user_id)} disabled={actionLoading === u.user_id} className="bg-green-600 hover:bg-green-700 text-white">
                            <UserCheck className="w-3 h-3 mr-1" />승인
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectUser(u.user_id)} disabled={actionLoading === u.user_id} className="border-red-300 text-red-600 hover:bg-red-50">
                            <UserX className="w-3 h-3 mr-1" />거부
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">등록된 사용자 ({users.length})</h2>
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <span>등록된 사용자가 없습니다.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">가입일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">재정부 권한</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">권한 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const r = getDisplayRole(u);
                    const sa = r === 'super_admin';
                    return (
                      <tr key={u.user_id} className="border-b">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={FINANCE_ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sa ? (
                            <span className="text-xs text-gray-400">-</span>
                          ) : (
                            <Select value={r} onValueChange={v => changeFinanceRole(u.user_id, v as FinanceRole)} disabled={actionLoading === u.user_id}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">관리자</SelectItem>
                                <SelectItem value="deacon">제직</SelectItem>
                                <SelectItem value="member">회원</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">재정부 권한 안내</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="font-medium text-amber-700 mb-1">수퍼어드민</div>
              <div className="text-amber-600 text-xs">모든 메뉴 접근 + 사용자 관리</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="font-medium text-blue-700 mb-1">관리자</div>
              <div className="text-blue-600 text-xs">데이터 입력, 설정 관리 (ADMIN 메뉴 제외)</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="font-medium text-green-700 mb-1">제직</div>
              <div className="text-green-600 text-xs">대시보드 + 리포트 조회 (세부내용 열람 가능)</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-medium text-gray-700 mb-1">회원</div>
              <div className="text-gray-600 text-xs">대시보드 + 리포트 조회 (세부내용 제한)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
