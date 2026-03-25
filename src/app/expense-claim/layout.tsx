import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '재정부 > 지출청구',
  openGraph: {
    title: '재정부 > 지출청구',
    description: '예봄교회 지출청구 입력 및 현황 조회',
  },
};

export default function ExpenseClaimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
