import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '재정부 > 대시보드',
  openGraph: {
    title: '재정부 > 대시보드',
    description: '예봄교회 재정 현황 대시보드',
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
