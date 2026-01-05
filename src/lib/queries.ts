// React Query 키 정의
export const queryKeys = {
  income: ['income'] as const,
  expense: ['expense'] as const,
  bankTransactions: ['bankTransactions'] as const,
  cardTransactions: ['cardTransactions'] as const,
  unmatchedTransactions: ['unmatchedTransactions'] as const,
  matchingRules: ['matchingRules'] as const,
  incomeCodes: ['incomeCodes'] as const,
  expenseCodes: ['expenseCodes'] as const,
  cardOwners: ['cardOwners'] as const,
  weeklyReport: (week: string) => ['weeklyReport', week] as const,
  monthlyReport: (year: number) => ['monthlyReport', year] as const,
  budgetReport: (year: number) => ['budgetReport', year] as const,
  donorInfo: ['donorInfo'] as const,
};

// API 함수들
export async function fetchUnmatchedTransactions() {
  const res = await fetch('/api/match/unmatched');
  if (!res.ok) throw new Error('Failed to fetch unmatched transactions');
  return res.json();
}

export async function fetchIncomeCodes() {
  const res = await fetch('/api/codes/income');
  if (!res.ok) throw new Error('Failed to fetch income codes');
  return res.json();
}

export async function fetchExpenseCodes() {
  const res = await fetch('/api/codes/expense');
  if (!res.ok) throw new Error('Failed to fetch expense codes');
  return res.json();
}

export async function syncCashOfferings(startDate: string, endDate: string) {
  const res = await fetch('/api/sync/cash-offering', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (!res.ok) throw new Error('Failed to sync cash offerings');
  return res.json();
}

export async function uploadBankFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload/bank', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload bank file');
  return res.json();
}

export async function uploadCardFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload/card', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload card file');
  return res.json();
}

export async function runAutoMatch() {
  const res = await fetch('/api/match/auto', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to run auto match');
  return res.json();
}

export async function confirmMatch(data: {
  source: 'bank' | 'card';
  transactionId: string;
  type: 'income' | 'expense';
  classification: Record<string, unknown>;
}) {
  const res = await fetch('/api/match/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to confirm match');
  return res.json();
}

export async function fetchWeeklyReport(week: string) {
  const res = await fetch(`/api/reports/weekly?week=${week}`);
  if (!res.ok) throw new Error('Failed to fetch weekly report');
  return res.json();
}

export async function fetchMonthlyReport(year: number) {
  const res = await fetch(`/api/reports/monthly?year=${year}`);
  if (!res.ok) throw new Error('Failed to fetch monthly report');
  return res.json();
}

export async function fetchBudgetReport(year: number) {
  const res = await fetch(`/api/reports/budget?year=${year}`);
  if (!res.ok) throw new Error('Failed to fetch budget report');
  return res.json();
}
