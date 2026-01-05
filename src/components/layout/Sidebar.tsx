'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  GitCompare,
  CreditCard,
  FileText,
  Settings,
  ChevronDown,
  Church,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: '대시보드',
    href: '/dashboard',
  },
  {
    icon: Upload,
    label: '데이터 입력',
    href: '/data-entry',
  },
  {
    icon: GitCompare,
    label: '거래 매칭',
    href: '/match',
  },
  {
    icon: CreditCard,
    label: '카드내역 입력',
    href: '/card/my-transactions',
  },
  {
    icon: FileText,
    label: '보고서',
    children: [
      { label: '주간 요약', href: '/reports/weekly' },
      { label: '월간 추이', href: '/reports/monthly' },
      { label: '예산 집행', href: '/reports/budget' },
    ],
  },
  {
    icon: Settings,
    label: '설정',
    children: [
      { label: '계정과목 코드', href: '/settings/codes' },
      { label: '매칭 규칙', href: '/settings/matching-rules' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['보고서', '설정']);

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      {/* 로고 */}
      <div className="p-6 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Church className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="font-bold text-lg">예봄교회</h1>
            <p className="text-xs text-slate-400">재정관리 시스템</p>
          </div>
        </Link>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors',
                      item.children?.some(child => pathname?.startsWith(child.href))
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        expandedMenus.includes(item.label) && 'rotate-180'
                      )}
                    />
                  </button>
                  {expandedMenus.includes(item.label) && item.children && (
                    <ul className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                              pathname === child.href
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            )}
                          >
                            <span className="w-5" />
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 하단 정보 */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          v1.0.0 | 2026년
        </p>
      </div>
    </aside>
  );
}
