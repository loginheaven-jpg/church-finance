import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '재정부 > 카드내역 입력',
  openGraph: {
    title: '재정부 > 카드내역 입력',
    description: '예봄교회 카드 사용내역 입력',
  },
};

export default function CardExpenseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
