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
  ListChecks,
  Cog,
  TrendingUp,
  TrendingDown,
  Scale,
  Wallet,
  Target,
  RefreshCw,
  Building2,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
      { href: '/data-entry', label: '데이터 입력', icon: Upload },
      { href: '/match', label: '거래 매칭', icon: GitCompare },
      { href: '/card/my-transactions', label: '카드내역 입력', icon: CreditCard },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { href: '/reports/weekly', label: '주간 요약', icon: FileText },
      { href: '/reports/monthly', label: '연간 요약', icon: BarChart3 },
      { href: '/reports/comparison', label: '연간 비교', icon: Scale },
      { href: '/reports/budget', label: '예산 집행', icon: Receipt },
      { href: '/reports/income-analysis', label: '수입 분석', icon: TrendingUp },
      { href: '/reports/expense-analysis', label: '지출 분석', icon: TrendingDown },
      { href: '/reports/custom', label: '커스텀 보고서', icon: FileBarChart },
    ],
  },
  {
    label: 'BUILDING',
    items: [
      { href: '/building', label: '성전 봉헌', icon: Building2 },
    ],
  },
  {
    label: 'DONORS',
    items: [
      { href: '/donors', label: '헌금자 관리', icon: Users },
      { href: '/donors/receipts', label: '기부금영수증', icon: FileText },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { href: '/settings/codes', label: '계정과목 코드', icon: ListChecks },
      { href: '/settings/matching-rules', label: '매칭 규칙', icon: Cog },
      { href: '/settings/budget', label: '예산 관리', icon: Wallet },
      { href: '/settings/carryover', label: '이월잔액', icon: RefreshCw },
      { href: '/settings/pledge', label: '작정헌금', icon: Target },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

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
        {menuSections.map((section) => (
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

      {/* Footer - Version */}
      <div className="mt-auto border-t border-white/10 p-4">
        <div className="mt-2 text-center text-[11px] text-white/40">
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
