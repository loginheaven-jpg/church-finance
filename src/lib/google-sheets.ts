import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type {
  IncomeRecord,
  ExpenseRecord,
  BankTransaction,
  CardTransaction,
  CashOffering,
  MatchingRule,
  IncomeCode,
  ExpenseCode,
  CardOwner,
  DonorInfo,
  Budget,
} from '@/types';

// ============================================
// Google Sheets 클라이언트
// ============================================

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

export function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ============================================
// 설정
// ============================================

const CASH_OFFERING_CONFIG = {
  spreadsheetId: process.env.CASH_OFFERING_SHEET_ID!,
  sheetName: '헌금함',
};

const FINANCE_CONFIG = {
  spreadsheetId: process.env.FINANCE_SHEET_ID!,
  sheets: {
    income: '수입부',
    expense: '지출부',
    bank: '은행원장',
    card: '카드원본',
    cardOwners: '카드소유자',
    matchingRules: '매칭규칙',
    budget: '예산',
    incomeCodes: '수입부코드',
    expenseCodes: '지출부코드',
    donorInfo: '헌금자정보',
  },
};

// ============================================
// 기본 CRUD 함수
// ============================================

export async function readSheet(sheetName: string, range: string = 'A:Z'): Promise<string[][]> {
  try {
    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${sheetName}!${range}`,
    });

    return response.data.values || [];
  } catch (error) {
    // 시트가 없는 경우 빈 배열 반환
    console.warn(`Sheet "${sheetName}" not found or error reading`);
    return [];
  }
}

export async function appendToSheet(sheetName: string, data: (string | number | boolean)[][]): Promise<void> {
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: data,
    },
  });
}

export async function updateSheet(
  sheetName: string,
  range: string,
  data: (string | number | boolean)[][]
): Promise<void> {
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: data,
    },
  });
}

export async function getSheetData<T>(sheetName: string): Promise<T[]> {
  const rows = await readSheet(sheetName);

  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  const data = rows.slice(1);

  return data.map(row => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      let value: unknown = row[index];

      // 숫자 변환
      if (value && !isNaN(Number(value)) && value !== '') {
        value = Number(value);
      }
      // 불리언 변환
      if (value === 'true' || value === 'TRUE') value = true;
      if (value === 'false' || value === 'FALSE') value = false;

      obj[header] = value ?? '';
    });
    return obj as T;
  });
}

// ============================================
// 현금헌금 조회 (외부 시트)
// ============================================

export async function fetchCashOfferings(
  startDate?: string,
  endDate?: string
): Promise<CashOffering[]> {
  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CASH_OFFERING_CONFIG.spreadsheetId,
    range: `${CASH_OFFERING_CONFIG.sheetName}!A:H`,
  });

  const rows = response.data.values;
  if (!rows || rows.length <= 1) return [];

  const data = rows.slice(1);

  const offerings = data
    .filter(row => row[0] && row[2] && row[3]) // 날짜, 성명, 금액 필수
    .map(row => ({
      date: normalizeDate(row[0]),
      source: row[1] || '헌금함',
      donor_name: row[2],
      amount: parseAmount(row[3]),
      code: parseInt(row[4]) || 11,
      item: row[5] || '주일헌금',
      category_code: parseInt(row[6]) || 10,
      note: row[7] || '',
    }));

  if (startDate && endDate) {
    return offerings.filter(o => o.date >= startDate && o.date <= endDate);
  }

  return offerings;
}

// ============================================
// 수입부 관련
// ============================================

export async function addIncomeRecords(records: IncomeRecord[]): Promise<void> {
  const rows = records.map(r => [
    r.id,
    r.date,
    r.source,
    r.offering_code,
    r.donor_name,
    r.representative,
    r.amount,
    r.note,
    r.input_method,
    r.created_at,
    r.created_by || '',
  ]);

  await appendToSheet(FINANCE_CONFIG.sheets.income, rows);
}

export async function getIncomeRecords(
  startDate?: string,
  endDate?: string
): Promise<IncomeRecord[]> {
  const data = await getSheetData<IncomeRecord>(FINANCE_CONFIG.sheets.income);

  if (startDate && endDate) {
    return data.filter(r => r.date >= startDate && r.date <= endDate);
  }
  return data;
}

// ============================================
// 지출부 관련
// ============================================

export async function addExpenseRecords(records: ExpenseRecord[]): Promise<void> {
  const rows = records.map(r => [
    r.id,
    r.date,
    r.payment_method,
    r.vendor,
    r.description,
    r.amount,
    r.account_code,
    r.category_code,
    r.note,
    r.created_at,
    r.created_by || '',
  ]);

  await appendToSheet(FINANCE_CONFIG.sheets.expense, rows);
}

export async function getExpenseRecords(
  startDate?: string,
  endDate?: string
): Promise<ExpenseRecord[]> {
  const data = await getSheetData<ExpenseRecord>(FINANCE_CONFIG.sheets.expense);

  if (startDate && endDate) {
    return data.filter(r => r.date >= startDate && r.date <= endDate);
  }
  return data;
}

// ============================================
// 은행원장 관련
// ============================================

export async function addBankTransactions(transactions: BankTransaction[]): Promise<void> {
  const rows = transactions.map(t => [
    t.id,
    t.transaction_date,
    t.withdrawal,
    t.deposit,
    t.balance,
    t.description,
    t.detail,
    t.branch,
    t.time,
    t.memo,
    t.matched_status,
    t.matched_type || '',
    t.matched_ids || '',
    t.suppressed,
    t.suppressed_reason || '',
    t.uploaded_at,
  ]);

  await appendToSheet(FINANCE_CONFIG.sheets.bank, rows);
}

export async function getBankTransactions(): Promise<BankTransaction[]> {
  return getSheetData<BankTransaction>(FINANCE_CONFIG.sheets.bank);
}

export async function getUnmatchedBankTransactions(): Promise<BankTransaction[]> {
  const data = await getBankTransactions();
  return data.filter(t => t.matched_status === 'pending' && !t.suppressed);
}

export async function updateBankTransaction(
  id: string,
  updates: Partial<BankTransaction>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.bank);
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) throw new Error(`Bank transaction ${id} not found`);

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  const updatedRow = headers.map((header, idx) => {
    if (header in updates) {
      return (updates as Record<string, unknown>)[header];
    }
    return currentRow[idx];
  });

  await updateSheet(
    FINANCE_CONFIG.sheets.bank,
    `A${rowIndex + 1}:P${rowIndex + 1}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

// ============================================
// 카드원본 관련
// ============================================

export async function addCardTransactions(transactions: CardTransaction[]): Promise<void> {
  const rows = transactions.map(t => [
    t.id,
    t.billing_date,
    t.seq,
    t.card_number,
    t.card_owner || '',
    t.merchant,
    t.sale_date,
    t.sale_amount,
    t.transaction_amount,
    t.purpose || '',
    t.account_code || '',
    t.detail_completed,
    t.matched_status,
    t.matched_id || '',
    t.uploaded_at,
  ]);

  await appendToSheet(FINANCE_CONFIG.sheets.card, rows);
}

export async function getCardTransactions(): Promise<CardTransaction[]> {
  return getSheetData<CardTransaction>(FINANCE_CONFIG.sheets.card);
}

export async function getUnmatchedCardTransactions(): Promise<CardTransaction[]> {
  const data = await getCardTransactions();
  return data.filter(t => !t.detail_completed);
}

export async function updateCardTransaction(
  id: string,
  updates: Partial<CardTransaction>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.card);
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) throw new Error(`Card transaction ${id} not found`);

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  const updatedRow = headers.map((header, idx) => {
    if (header in updates) {
      return (updates as Record<string, unknown>)[header];
    }
    return currentRow[idx];
  });

  await updateSheet(
    FINANCE_CONFIG.sheets.card,
    `A${rowIndex + 1}:P${rowIndex + 1}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

// ============================================
// 코드 테이블 조회
// ============================================

export async function getIncomeCodes(): Promise<IncomeCode[]> {
  return getSheetData<IncomeCode>(FINANCE_CONFIG.sheets.incomeCodes);
}

export async function getExpenseCodes(): Promise<ExpenseCode[]> {
  return getSheetData<ExpenseCode>(FINANCE_CONFIG.sheets.expenseCodes);
}

export async function getCardOwners(): Promise<CardOwner[]> {
  return getSheetData<CardOwner>(FINANCE_CONFIG.sheets.cardOwners);
}

// ============================================
// 매칭 규칙 관련
// ============================================

export async function getMatchingRules(): Promise<MatchingRule[]> {
  return getSheetData<MatchingRule>(FINANCE_CONFIG.sheets.matchingRules);
}

export async function addMatchingRule(rule: Omit<MatchingRule, 'id'>): Promise<string> {
  const id = generateId('RULE');
  const row = [
    id,
    rule.rule_type,
    rule.pattern,
    rule.target_type,
    rule.target_code,
    rule.target_name,
    rule.confidence,
    rule.usage_count,
    rule.created_at,
    rule.updated_at,
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.matchingRules, [row]);
  return id;
}

export async function updateMatchingRule(
  id: string,
  updates: Partial<MatchingRule>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.matchingRules);
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) throw new Error(`Matching rule ${id} not found`);

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  const updatedRow = headers.map((header, idx) => {
    if (header in updates) {
      return (updates as Record<string, unknown>)[header];
    }
    return currentRow[idx];
  });

  await updateSheet(
    FINANCE_CONFIG.sheets.matchingRules,
    `A${rowIndex + 1}:J${rowIndex + 1}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

// ============================================
// 헌금자 정보 관련
// ============================================

export async function getDonorInfo(): Promise<DonorInfo[]> {
  return getSheetData<DonorInfo>(FINANCE_CONFIG.sheets.donorInfo);
}

export async function addDonorInfo(donor: DonorInfo): Promise<void> {
  const row = [
    donor.representative,
    donor.donor_name,
    donor.relationship || '',
    donor.registration_number || '',
    donor.address || '',
    donor.phone || '',
    donor.email || '',
    donor.note || '',
    donor.created_at,
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.donorInfo, [row]);
}

// ============================================
// 예산 관련
// ============================================

export async function getBudget(year: number): Promise<Budget[]> {
  const data = await getSheetData<Budget>(FINANCE_CONFIG.sheets.budget);
  return data.filter(b => b.year === year);
}

// ============================================
// 시트 초기화
// ============================================

export async function initializeSheets(): Promise<void> {
  const sheets = getGoogleSheetsClient();

  const sheetHeaders: Record<string, string[]> = {
    [FINANCE_CONFIG.sheets.income]: [
      'id', 'date', 'source', 'offering_code',
      'donor_name', 'representative', 'amount', 'note', 'input_method',
      'created_at', 'created_by'
    ],
    [FINANCE_CONFIG.sheets.expense]: [
      'id', 'date', 'payment_method', 'vendor', 'description',
      'amount', 'account_code', 'category_code',
      'note', 'created_at', 'created_by'
    ],
    [FINANCE_CONFIG.sheets.bank]: [
      'id', 'transaction_date', 'withdrawal', 'deposit', 'balance',
      'description', 'detail', 'branch', 'time', 'memo',
      'matched_status', 'matched_type', 'matched_ids', 'suppressed', 'suppressed_reason',
      'uploaded_at'
    ],
    [FINANCE_CONFIG.sheets.card]: [
      'id', 'billing_date', 'seq', 'card_number', 'card_owner',
      'merchant', 'sale_date', 'sale_amount', 'transaction_amount', 'purpose',
      'account_code', 'detail_completed', 'matched_status', 'matched_id',
      'uploaded_at'
    ],
    [FINANCE_CONFIG.sheets.cardOwners]: [
      'card_number', 'owner_name', 'card_type', 'active', 'note', 'created_at'
    ],
    [FINANCE_CONFIG.sheets.matchingRules]: [
      'id', 'rule_type', 'pattern', 'target_type', 'target_code',
      'target_name', 'confidence', 'usage_count', 'created_at', 'updated_at'
    ],
    [FINANCE_CONFIG.sheets.budget]: [
      'year', 'category_code', 'category_item', 'account_code', 'account_item',
      'budgeted_amount', 'note'
    ],
    [FINANCE_CONFIG.sheets.incomeCodes]: [
      'category_code', 'category_item', 'code', 'item', 'active', 'sort_order'
    ],
    [FINANCE_CONFIG.sheets.expenseCodes]: [
      'category_code', 'category_item', 'code', 'item', 'active', 'sort_order'
    ],
    [FINANCE_CONFIG.sheets.donorInfo]: [
      'representative', 'donor_name', 'relationship', 'registration_number',
      'address', 'phone', 'email', 'note', 'created_at'
    ],
  };

  // 각 시트 생성 및 헤더 설정
  for (const [sheetName, headers] of Object.entries(sheetHeaders)) {
    try {
      // 시트 추가 시도
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: FINANCE_CONFIG.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }
      });
    } catch {
      // 시트가 이미 존재하면 무시
    }

    // 헤더 설정
    await sheets.spreadsheets.values.update({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers]
      }
    });
  }

  // 기본 코드 데이터 추가
  await seedIncomeCodes();
  await seedExpenseCodes();
}

async function seedIncomeCodes(): Promise<void> {
  const existing = await getIncomeCodes();
  if (existing.length > 0) return;

  const codes = [
    [10, '헌금수입', 11, '주일헌금', true, 1],
    [10, '헌금수입', 12, '십일조헌금', true, 2],
    [10, '헌금수입', 13, '감사헌금', true, 3],
    [10, '헌금수입', 14, '특별헌금', true, 4],
    [10, '헌금수입', 15, '어린이부', true, 5],
    [20, '특별헌금', 21, '선교헌금', true, 6],
    [20, '특별헌금', 22, '구제헌금', true, 7],
    [30, '기타수입', 31, '이자수입', true, 8],
    [30, '기타수입', 32, '잡수입', true, 9],
    [500, '건축헌금', 501, '성전봉헌헌금', true, 10],
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.incomeCodes, codes);
}

async function seedExpenseCodes(): Promise<void> {
  const existing = await getExpenseCodes();
  if (existing.length > 0) return;

  const codes = [
    [40, '사역비', 41, '식비', true, 1],
    [40, '사역비', 42, '교육훈련비', true, 2],
    [40, '사역비', 43, '회의비', true, 3],
    [40, '사역비', 47, '친교비', true, 4],
    [50, '사례비', 51, '목회자사례비', true, 5],
    [50, '사례비', 52, '전도사사례비', true, 6],
    [60, '관리운영비', 61, '급여', true, 7],
    [60, '관리운영비', 62, '수도광열비', true, 8],
    [60, '관리운영비', 63, '시설유지비', true, 9],
    [70, '운영비', 74, '사무비', true, 10],
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.expenseCodes, codes);
}

// ============================================
// 헬퍼 함수
// ============================================

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    return parseFloat(value.replace(/[,원\s]/g, '')) || 0;
  }
  return 0;
}

function normalizeDate(value: string): string {
  if (!value) return '';
  // YYYY/MM/DD -> YYYY-MM-DD
  return value.replace(/\//g, '-').split(' ')[0];
}

export function generateId(prefix: string): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = kst.getTime().toString().slice(-6);
  return `${prefix}${dateStr}${timeStr}`;
}

export function getKSTDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function getKSTDateTime(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString();
}
