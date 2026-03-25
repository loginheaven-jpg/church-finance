import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '재정부 > 내 헌금',
  openGraph: {
    title: '재정부 > 내 헌금',
    description: '예봄교회 내 헌금 조회',
  },
};

export default function MyOfferingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
