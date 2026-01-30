'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  GitCompare,
  CreditCard,
  FileText,
  Settings,
  Users,
  BarChart3,
  Receipt,
  Cog,
  TrendingUp,
  TrendingDown,
  Scale,
  Target,
  RefreshCw,
  Building2,
  FileBarChart,
  Heart,
  FilePlus,
  UserCog,
  LogOut,
  User,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// 역할 타입 정의
export type FinanceRole = 'super_admin' | 'admin' | 'deacon' | 'member';

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: FinanceRole;  // 항목별 최소 권한 (섹션 권한 오버라이드)
}

interface MenuSection {
  label: string;
  items: MenuItem[];
  minRole: FinanceRole;  // 최소 필요 역할
}

// 역할 우선순위 (높을수록 권한 높음)
const ROLE_PRIORITY: Record<FinanceRole, number> = {
  'super_admin': 4,
  'admin': 3,
  'deacon': 2,
  'member': 1,
};

// 역할 확인 헬퍼
function hasAccess(userRole: FinanceRole, requiredRole: FinanceRole): boolean {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[requiredRole];
}

const menuSections: MenuSection[] = [
  {
    label: 'MAIN',
    minRole: 'member',
    items: [
      { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
      { href: '/building', label: '성전 봉헌', icon: Building2 },
      { href: '/my-offering', label: '내 헌금', icon: Heart },
    ],
  },
  {
    label: 'REPORTS',
    minRole: 'member',
    items: [
      { href: '/reports/weekly', label: '주간 요약', icon: FileText },
      { href: '/reports/monthly', label: '연간 요약', icon: BarChart3 },
      { href: '/reports/comparison', label: '연간 비교', icon: Scale },
      { href: '/reports/budget', label: '예산 집행', icon: Receipt },
      { href: '/reports/income-analysis', label: '수입 분석', icon: TrendingUp, minRole: 'deacon' },
      { href: '/reports/expense-analysis', label: '지출 분석', icon: TrendingDown, minRole: 'deacon' },
      { href: '/reports/custom', label: '커스텀 보고서', icon: FileBarChart, minRole: 'super_admin' },
    ],
  },
  {
    label: 'MANAGEMENTS',
    minRole: 'admin',
    items: [
      { href: '/expense-claim', label: '지출청구', icon: FilePlus },
      { href: '/data-entry', label: '데이터 입력', icon: Upload },
      { href: '/match', label: '거래 매칭', icon: GitCompare },
      { href: '/card-expense-integration', label: '카드내역 입력', icon: CreditCard, minRole: 'member' },
      { href: '/donors', label: '헌금자 관리', icon: Users },
      { href: '/donors/receipts', label: '기부금 영수증', icon: FileText },
      { href: '/settings/matching-rules', label: '매칭 규칙', icon: Cog },
      { href: '/settings/carryover', label: '이월 잔액', icon: RefreshCw },
      { href: '/settings/pledge', label: '작정 헌금', icon: Target },
    ],
  },
  {
    label: 'ADMIN',
    minRole: 'super_admin',
    items: [
      { href: '/admin/annual-closing', label: '연마감', icon: CalendarCheck },
      { href: '/admin/settings', label: '시스템 설정', icon: Settings },
      { href: '/admin/users', label: '사용자 관리', icon: UserCog },
    ],
  },
];

// 역할 한글명
const ROLE_LABELS: Record<FinanceRole, string> = {
  'super_admin': '수퍼어드민',
  'admin': '관리자',
  'deacon': '제직',
  'member': '성도',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  userRole?: FinanceRole;
  userName?: string;
}

export function Sidebar({ isOpen = true, onClose, userRole = 'member', userName }: SidebarProps) {
  const pathname = usePathname();

  // 사용자 역할에 따라 메뉴 필터링 (항목별 권한 포함)
  const filteredSections = menuSections
    .map(section => ({
      ...section,
      // 항목별 권한 체크: item.minRole이 있으면 그것을 사용, 없으면 section.minRole 사용
      items: section.items.filter(item =>
        hasAccess(userRole, item.minRole || section.minRole)
      ),
    }))
    // 표시할 항목이 있는 섹션만 남김
    .filter(section => section.items.length > 0);

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/verify', { method: 'DELETE' });
      // 전체 페이지 새로고침으로 세션 상태 완전 초기화
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen w-[240px] flex flex-col transition-transform duration-300',
        // 모바일: 기본 숨김, 열릴 때 슬라이드
        'max-md:-translate-x-full max-md:top-14 max-md:h-[calc(100vh-56px)] max-md:overflow-y-auto max-md:scrollbar-hide',
        isOpen && 'max-md:translate-x-0',
        // PC: 항상 표시
        'md:translate-x-0'
      )}
      style={{ background: 'linear-gradient(180deg, #2C3E50 0%, #1a2a3a 100%)' }}
    >
      {/* Logo Section - PC에서만 표시 */}
      <div className="hidden md:flex items-center gap-3 px-3 py-5 border-b border-white/10">
        <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-[#C9A962] flex items-center justify-center">
          <Image
            src="/yebom_logo.png"
            alt="예봄교회 로고"
            width={60}
            height={60}
            className="object-cover w-full h-full"
            onError={(e) => {
              // 이미지 로드 실패 시 이모지 표시
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<span style="font-size: 28px;">⛪</span>';
            }}
          />
        </div>
        <div>
          <div className="font-display font-semibold text-[16px] text-white">예봄교회</div>
          <div className="text-[13px] text-white/50 tracking-[2px]">재 정 부</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto scrollbar-hide">
        {filteredSections.map((section) => (
          <div key={section.label} className="mb-4">
            {/* Section Label */}
            <div className="px-4 mb-3 text-[11px] font-semibold text-white/35 uppercase tracking-[1.5px]">
              {section.label}
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-[14px] px-4 py-[14px] mx-2 rounded-xl text-[14px] font-medium transition-all duration-300 w-full relative',
                      isActive
                        ? 'menu-active'
                        : 'text-white/90 hover:bg-white/5'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - User Info & Logout */}
      <div className="mt-auto border-t border-white/10 p-4">
        {userName ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <User className="h-4 w-4 text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{userName}</div>
                <div className="text-[11px] text-white/50">{ROLE_LABELS[userRole]}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
          >
            <User className="h-4 w-4" />
            로그인
          </Link>
        )}
        <div className="mt-3 text-center text-[11px] text-white/40">
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
