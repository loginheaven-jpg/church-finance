import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '재정부 > 성전 봉헌',
  openGraph: {
    title: '재정부 > 성전 봉헌',
    description: '예봄교회 성전 봉헌 현황',
  },
};

export default function BuildingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
