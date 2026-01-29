'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { Menu, X, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useFinanceSession } from '@/lib/auth/use-finance-session';
import { Button } from '@/components/ui/button';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const session = useFinanceSession();

  // 연마감 알림 상태
  const [showClosingAlert, setShowClosingAlert] = useState(false);
  const [closingTargetYear, setClosingTargetYear] = useState<number | null>(null);
  const [closingDismissed, setClosingDismissed] = useState(false);

  // 경로 변경 시 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // super_admin일 때 연마감 상태 확인
  useEffect(() => {
    const checkAnnualClosing = async () => {
      // super_admin만 확인, 이미 dismiss 했거나 연마감 페이지면 스킵
      if (
        session?.finance_role !== 'super_admin' ||
        closingDismissed ||
        pathname === '/admin/annual-closing'
      ) {
        return;
      }

      // sessionStorage에서 dismiss 상태 확인
      const dismissedKey = `annual_closing_dismissed_${new Date().getFullYear()}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setClosingDismissed(true);
        return;
      }

      try {
        const res = await fetch('/api/admin/annual-closing');
        const result = await res.json();
        if (result.success && result.needsClosing) {
          setShowClosingAlert(true);
          setClosingTargetYear(result.targetYear);
        }
      } catch (error) {
        console.error('Annual closing check error:', error);
      }
    };

    // 세션이 로드된 후 확인
    if (session) {
      checkAnnualClosing();
    }
  }, [session, pathname, closingDismissed]);

  const handleDismissClosingAlert = () => {
    const dismissedKey = `annual_closing_dismissed_${new Date().getFullYear()}`;
    sessionStorage.setItem(dismissedKey, 'true');
    setClosingDismissed(true);
    setShowClosingAlert(false);
  };

  const handleGoToClosing = () => {
    setShowClosingAlert(false);
    router.push('/admin/annual-closing');
  };

  return (
    <div className="min-h-screen bg-[#F8F6F3]">
      {/* Mobile Header - md 이하에서만 표시 */}
      <header
        className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #2C3E50 0%, #1a2a3a 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{
              background: 'linear-gradient(135deg, #C9A962 0%, #D4B87A 100%)',
            }}
          >
            ⛪
          </div>
          <span className="font-display font-semibold text-white text-[13px]">예봄교회 재정부</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          {sidebarOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={session?.finance_role || 'member'}
        userName={session?.name}
      />

      {/* Main Content */}
      <main className="md:ml-[240px] min-h-screen pt-14 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* 연마감 알림 팝업 */}
      {showClosingAlert && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
              <CalendarCheck className="h-6 w-6 text-white" />
              <h2 className="text-lg font-bold text-white">연마감 필요</h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">
                  <strong>{closingTargetYear}년도</strong> 회계 연마감이 완료되지 않았습니다.
                  정확한 재정 데이터를 위해 연마감을 진행해주세요.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                <p className="font-medium mb-2">연마감에서 처리할 항목:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>일반회계 이월잔액 확정</li>
                  <li>성전봉헌 연간 헌금/상환 스냅샷</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <Button variant="outline" onClick={handleDismissClosingAlert}>
                나중에
              </Button>
              <Button
                onClick={handleGoToClosing}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <CalendarCheck className="h-4 w-4 mr-2" />
                연마감 하기
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" richColors />
    </div>
  );
}
