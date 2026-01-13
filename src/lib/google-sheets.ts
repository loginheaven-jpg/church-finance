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
  ManualReceiptHistory,
  CarryoverBalance,
  PledgeDonation,
} from '@/types';

// ============================================
// Google Sheets 클라이언트
// ============================================

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

export function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;

  // Handle both escaped \n (from .env file) and actual newlines (from Vercel)
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
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
    manualReceipts: '수작업발급이력',
    carryoverBalance: '이월잔액',
    pledgeDonations: '작정헌금',
    buildingStatus: '2025건축헌금현황',
    yearlyBudget: '연도별예산',
    businessInfo: '사업자정보',
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

// 시트 데이터 클리어 (헤더 유지, 데이터만 삭제)
export async function clearSheetData(sheetName: string): Promise<void> {
  const sheets = getGoogleSheetsClient();

  // 먼저 데이터 범위 확인
  const rows = await readSheet(sheetName);
  if (rows.length <= 1) return; // 헤더만 있거나 빈 시트

  // 헤더 제외한 데이터 영역 클리어 (A2부터 끝까지)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A2:Z${rows.length + 100}`, // 여유있게 클리어
  });
}

// 코드 테이블 리셋 (기존 데이터 삭제 후 새 코드로 재생성)
export async function resetCodeTables(): Promise<{ income: number; expense: number }> {
  // 1. 기존 코드 데이터 삭제
  await clearSheetData(FINANCE_CONFIG.sheets.incomeCodes);
  await clearSheetData(FINANCE_CONFIG.sheets.expenseCodes);

  // 2. 새 코드 데이터 시딩
  await seedIncomeCodesForce();
  await seedExpenseCodesForce();

  // 3. 결과 확인
  const incomeCodes = await getIncomeCodes();
  const expenseCodes = await getExpenseCodes();

  return {
    income: incomeCodes.length,
    expense: expenseCodes.length,
  };
}

// 강제 시딩 (기존 데이터 체크 없이)
async function seedIncomeCodesForce(): Promise<void> {
  const codes = [
    // 일반헌금 (10)
    [10, '일반헌금', 10, '헌금', true, 1],
    [10, '일반헌금', 11, '주일헌금', true, 2],
    [10, '일반헌금', 12, '십일조헌금', true, 3],
    [10, '일반헌금', 13, '감사헌금', true, 4],
    [10, '일반헌금', 14, '특별헌금', true, 5],
    [10, '일반헌금', 15, '어린이부', true, 6],
    [10, '일반헌금', 16, '중고', true, 7],
    [10, '일반헌금', 17, '청년부', true, 8],
    // 목적헌금 (20)
    [20, '목적헌금', 20, '목적헌금', true, 9],
    [20, '목적헌금', 21, '선교헌금', true, 10],
    [20, '목적헌금', 22, '구제헌금', true, 11],
    [20, '목적헌금', 23, '전도회비', true, 12],
    [20, '목적헌금', 24, '지정헌금', true, 13],
    // 잡수입 (30)
    [30, '잡수입', 30, '잡수입', true, 14],
    [30, '잡수입', 31, '이자수입', true, 15],
    [30, '잡수입', 32, '기타잡수입', true, 16],
    // 자본수입 (40)
    [40, '자본수입', 40, '자본수입', true, 17],
    [40, '자본수입', 41, '일시차입금', true, 18],
    [40, '자본수입', 42, '차입금', true, 19],
    [40, '자본수입', 43, '적립금인출', true, 20],
    [40, '자본수입', 44, '자산처분수입', true, 21],
    // 건축헌금 (500)
    [500, '건축헌금', 500, '건축헌금', true, 22],
    [500, '건축헌금', 501, '건축헌금', true, 23],
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.incomeCodes, codes);
}

async function seedExpenseCodesForce(): Promise<void> {
  const codes = [
    // 사례비 (10)
    [10, '사례비', 10, '사례비', true, 1],
    [10, '사례비', 11, '교역자사례비', true, 2],
    [10, '사례비', 12, '직원급여', true, 3],
    [10, '사례비', 13, '기타수당', true, 4],
    [10, '사례비', 14, '식대', true, 5],
    // 예배비 (20)
    [20, '예배비', 20, '예배비', true, 6],
    [20, '예배비', 21, '예배환경비', true, 7],
    [20, '예배비', 22, '주보대', true, 8],
    [20, '예배비', 23, '찬양대', true, 9],
    // 선교비 (30)
    [30, '선교비', 30, '선교비', true, 10],
    [30, '선교비', 31, '전도비', true, 11],
    [30, '선교비', 32, '선교보고비', true, 12],
    [30, '선교비', 33, '선교후원비', true, 13],
    // 교육비 (40)
    [40, '교육비', 40, '교육비', true, 14],
    [40, '교육비', 41, '교육훈련비', true, 15],
    [40, '교육비', 42, '어린이부', true, 16],
    [40, '교육비', 43, '청소년부', true, 17],
    [40, '교육비', 44, '청년부', true, 18],
    [40, '교육비', 45, '목장비', true, 19],
    [40, '교육비', 46, '행사비', true, 20],
    [40, '교육비', 47, '친교비', true, 21],
    [40, '교육비', 48, '도서비', true, 22],
    [40, '교육비', 49, '장학금', true, 23],
    // 봉사비 (50)
    [50, '봉사비', 50, '봉사비', true, 24],
    [50, '봉사비', 51, '경조비', true, 25],
    [50, '봉사비', 52, '구호비', true, 26],
    [50, '봉사비', 53, '지역사회봉사비', true, 27],
    // 관리비 (60)
    [60, '관리비', 60, '관리비', true, 29],
    [60, '관리비', 61, '사택관리비', true, 30],
    [60, '관리비', 62, '수도광열비', true, 31],
    [60, '관리비', 63, '공과금', true, 32],
    [60, '관리비', 64, '관리대행비', true, 33],
    [60, '관리비', 65, '차량유지비', true, 34],
    [60, '관리비', 66, '수선유지비', true, 35],
    // 운영비 (70)
    [70, '운영비', 70, '운영비', true, 36],
    [70, '운영비', 71, '통신비', true, 37],
    [70, '운영비', 72, '도서인쇄비', true, 38],
    [70, '운영비', 73, '회의비', true, 39],
    [70, '운영비', 74, '사무비', true, 40],
    [70, '운영비', 75, '잡비', true, 41],
    // 상회비 (80)
    [80, '상회비', 80, '상회비', true, 42],
    [80, '상회비', 81, '상회비', true, 43],
    // 기타비용 (90)
    [90, '기타비용', 90, '기타비용', true, 44],
    [90, '기타비용', 91, '목회활동비', true, 45],
    [90, '기타비용', 92, '일시차입금상환', true, 46],
    [90, '기타비용', 93, '제적립예금', true, 47],
    [90, '기타비용', 94, '법인세', true, 48],
    [90, '기타비용', 96, '지정헌금지출', true, 49],
    // 예비비 (100)
    [100, '예비비', 100, '예비비', true, 49],
    [100, '예비비', 101, '예비비', true, 50],
    // 건축비 (500)
    [500, '건축비', 500, '건축비', true, 51],
    [500, '건축비', 501, '건축지급이자', true, 52],
    [500, '건축비', 502, '건축원금상환', true, 53],
    [500, '건축비', 503, '일시대출금', true, 54],
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.expenseCodes, codes);
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

      // 숫자 변환 (콤마 포함 문자열도 처리)
      if (typeof value === 'string' && value !== '') {
        // 콤마 제거 후 숫자 변환 시도
        const cleanValue = value.replace(/,/g, '');
        if (!isNaN(Number(cleanValue)) && cleanValue !== '') {
          value = Number(cleanValue);
        }
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

export async function updateDonorInfo(
  representative: string,
  donorName: string,
  updates: Partial<DonorInfo>
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetName = FINANCE_CONFIG.sheets.donorInfo;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:I`,
  });

  const rows = response.data.values || [];
  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  const rowIndex = dataRows.findIndex(
    (row) => row[0] === representative && row[1] === donorName
  );

  if (rowIndex === -1) {
    throw new Error('헌금자 정보를 찾을 수 없습니다');
  }

  const currentRow = dataRows[rowIndex];
  const updatedRow = [
    updates.representative ?? currentRow[0],
    updates.donor_name ?? currentRow[1],
    updates.relationship ?? currentRow[2] ?? '',
    updates.registration_number ?? currentRow[3] ?? '',
    updates.address ?? currentRow[4] ?? '',
    updates.phone ?? currentRow[5] ?? '',
    updates.email ?? currentRow[6] ?? '',
    updates.note ?? currentRow[7] ?? '',
    currentRow[8], // created_at는 유지
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A${rowIndex + 2}:I${rowIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [updatedRow],
    },
  });
}

export async function deleteDonorInfo(
  representative: string,
  donorName: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetName = FINANCE_CONFIG.sheets.donorInfo;

  // 먼저 시트 ID 가져오기
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error('시트를 찾을 수 없습니다');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:I`,
  });

  const rows = response.data.values || [];
  const dataRows = rows.slice(1);

  const rowIndex = dataRows.findIndex(
    (row) => row[0] === representative && row[1] === donorName
  );

  if (rowIndex === -1) {
    throw new Error('헌금자 정보를 찾을 수 없습니다');
  }

  // 행 삭제
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 for header
              endIndex: rowIndex + 2,
            },
          },
        },
      ],
    },
  });
}

// ============================================
// 예산 관련
// ============================================

/**
 * 연도별예산 시트에서 예산 데이터 읽기 (피벗 형태 → Budget[] 변환)
 * 시트 구조:
 *   - B열: 분야코드 (카테고리 헤더 행에서만 값 있음)
 *   - C열: 계정코드 (세부 항목 행에서만 값 있음)
 *   - D열: 항목명
 *   - E열~: 연도별 금액 (헤더: "2024년", "2025년" 등)
 */
async function getBudgetFromYearlySheet(year: number): Promise<Budget[]> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.yearlyBudget, 'A:Z');
  if (!rows || rows.length < 2) return [];

  // 헤더에서 연도 컬럼 위치 찾기 (예: "2025년", " 2024년 " 등)
  const headers = rows[0];
  const yearStr = `${year}년`;
  const yearColIndex = headers.findIndex(h => String(h).trim() === yearStr);
  if (yearColIndex === -1) {
    console.warn(`Year column for ${year} not found in 연도별예산 sheet`);
    return [];
  }

  // 지출부코드에서 분야명 조회용 맵 생성
  const expenseCodes = await getExpenseCodes();
  const categoryNameMap = new Map<number, string>();
  expenseCodes.forEach(c => {
    if (!categoryNameMap.has(c.category_code)) {
      categoryNameMap.set(c.category_code, c.category_item);
    }
  });

  // 숫자 파싱 헬퍼
  const parseNum = (val: string | undefined) => {
    if (!val) return 0;
    return Number(String(val).replace(/,/g, '').trim()) || 0;
  };

  // 각 행을 Budget 객체로 변환
  const budgets: Budget[] = [];
  let currentCategoryCode = 0; // 현재 분야코드 (카테고리 헤더 행에서 설정됨)

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    // B열: 분야코드 (카테고리 헤더 행에서만 값 있음)
    const rowCategoryCode = Number(row[1]) || 0;
    // C열: 계정코드 (세부 항목 행에서만 값 있음)
    const accountCode = Number(row[2]) || 0;
    // D열: 항목명
    const accountItem = String(row[3] || '').trim();
    // 해당 연도 금액
    const amount = parseNum(row[yearColIndex]);

    // 분야코드가 있으면 현재 카테고리 업데이트 (카테고리 헤더 행)
    if (rowCategoryCode > 0) {
      currentCategoryCode = rowCategoryCode;
    }

    // 계정코드가 있는 행만 예산 항목으로 추가 (세부 항목 행)
    if (accountCode > 0 && amount > 0) {
      budgets.push({
        year,
        category_code: currentCategoryCode,
        category_item: categoryNameMap.get(currentCategoryCode) || `분야${currentCategoryCode}`,
        account_code: accountCode,
        account_item: accountItem,
        budgeted_amount: amount,
      });
    }
  }

  return budgets;
}

/**
 * 예산 조회 - 모든 연도를 '연도별예산' 시트에서 읽기
 */
export async function getBudget(year: number): Promise<Budget[]> {
  return getBudgetFromYearlySheet(year);
}

// ============================================
// 수작업 발급 이력 관련
// ============================================

export async function getManualReceiptHistory(year?: number): Promise<ManualReceiptHistory[]> {
  const data = await getSheetData<ManualReceiptHistory>(FINANCE_CONFIG.sheets.manualReceipts);
  if (year) {
    return data.filter(r => r.year === year);
  }
  return data;
}

export async function addManualReceiptHistory(record: ManualReceiptHistory): Promise<void> {
  const row = [
    record.issue_number,
    record.year,
    record.representative,
    record.address || '',
    record.resident_id || '',
    record.amount,
    record.issued_at,
    record.original_issue_number || '',
    record.note || '',
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.manualReceipts, [row]);
}

export async function getAllIssueNumbers(year: number): Promise<string[]> {
  // 기존 영수증의 발급번호 조회
  const rows = await readSheet(FINANCE_CONFIG.sheets.income);
  const manualRows = await readSheet(FINANCE_CONFIG.sheets.manualReceipts);

  const issueNumbers: string[] = [];

  // 수작업 발급 이력에서 발급번호 추출
  if (manualRows.length > 1) {
    const issueNumberIdx = manualRows[0].indexOf('issue_number');
    const yearIdx = manualRows[0].indexOf('year');
    manualRows.slice(1).forEach(row => {
      if (row[yearIdx] === String(year) && row[issueNumberIdx]) {
        issueNumbers.push(row[issueNumberIdx]);
      }
    });
  }

  return issueNumbers;
}

export async function deleteManualReceiptHistory(
  year: number,
  issueNumber: string
): Promise<boolean> {
  const sheets = getGoogleSheetsClient();

  // 시트 ID 조회
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === FINANCE_CONFIG.sheets.manualReceipts
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error('수작업발급이력 시트를 찾을 수 없습니다');
  }

  // 데이터 읽기
  const rows = await readSheet(FINANCE_CONFIG.sheets.manualReceipts);
  if (rows.length < 2) return false;

  // 헤더에서 인덱스 찾기
  const headers = rows[0];
  const yearIdx = headers.indexOf('year');
  const issueNumIdx = headers.indexOf('issue_number');

  // 해당 행 찾기 (1부터 시작, 0은 헤더)
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (
      String(rows[i][yearIdx]) === String(year) &&
      rows[i][issueNumIdx] === issueNumber
    ) {
      targetRowIndex = i;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return false;
  }

  // 행 삭제 (targetRowIndex는 rows 배열의 인덱스이며, 이미 헤더 포함)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: targetRowIndex,
              endIndex: targetRowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
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
    [FINANCE_CONFIG.sheets.manualReceipts]: [
      'issue_number', 'year', 'representative', 'address', 'resident_id',
      'amount', 'issued_at', 'original_issue_number', 'note'
    ],
    [FINANCE_CONFIG.sheets.carryoverBalance]: [
      'year', 'balance', 'construction_balance', 'note', 'updated_at', 'updated_by'
    ],
    [FINANCE_CONFIG.sheets.pledgeDonations]: [
      'id', 'year', 'donor_name', 'representative', 'pledged_amount',
      'fulfilled_amount', 'note', 'created_at', 'updated_at'
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
    // 일반헌금 (10)
    [10, '일반헌금', 10, '헌금', true, 1],
    [10, '일반헌금', 11, '주일헌금', true, 2],
    [10, '일반헌금', 12, '십일조헌금', true, 3],
    [10, '일반헌금', 13, '감사헌금', true, 4],
    [10, '일반헌금', 14, '특별헌금', true, 5],
    [10, '일반헌금', 15, '어린이부', true, 6],
    [10, '일반헌금', 16, '중고', true, 7],
    [10, '일반헌금', 17, '청년부', true, 8],
    // 목적헌금 (20)
    [20, '목적헌금', 20, '목적헌금', true, 9],
    [20, '목적헌금', 21, '선교헌금', true, 10],
    [20, '목적헌금', 22, '구제헌금', true, 11],
    [20, '목적헌금', 23, '전도회비', true, 12],
    [20, '목적헌금', 24, '지정헌금', true, 13],
    // 잡수입 (30)
    [30, '잡수입', 30, '잡수입', true, 14],
    [30, '잡수입', 31, '이자수입', true, 15],
    [30, '잡수입', 32, '기타잡수입', true, 16],
    // 자본수입 (40)
    [40, '자본수입', 40, '자본수입', true, 17],
    [40, '자본수입', 41, '일시차입금', true, 18],
    [40, '자본수입', 42, '차입금', true, 19],
    [40, '자본수입', 43, '적립금인출', true, 20],
    [40, '자본수입', 44, '자산처분수입', true, 21],
    // 건축헌금 (500)
    [500, '건축헌금', 500, '건축헌금', true, 22],
    [500, '건축헌금', 501, '건축헌금', true, 23],
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.incomeCodes, codes);
}

async function seedExpenseCodes(): Promise<void> {
  const existing = await getExpenseCodes();
  if (existing.length > 0) return;

  const codes = [
    // 사례비 (10)
    [10, '사례비', 10, '사례비', true, 1],
    [10, '사례비', 11, '교역자사례비', true, 2],
    [10, '사례비', 12, '직원급여', true, 3],
    [10, '사례비', 13, '기타수당', true, 4],
    [10, '사례비', 14, '식대', true, 5],
    // 예배비 (20)
    [20, '예배비', 20, '예배비', true, 6],
    [20, '예배비', 21, '예배환경비', true, 7],
    [20, '예배비', 22, '주보대', true, 8],
    [20, '예배비', 23, '찬양대', true, 9],
    // 선교비 (30)
    [30, '선교비', 30, '선교비', true, 10],
    [30, '선교비', 31, '전도비', true, 11],
    [30, '선교비', 32, '선교보고비', true, 12],
    [30, '선교비', 33, '선교후원비', true, 13],
    // 교육비 (40)
    [40, '교육비', 40, '교육비', true, 14],
    [40, '교육비', 41, '교육훈련비', true, 15],
    [40, '교육비', 42, '어린이부', true, 16],
    [40, '교육비', 43, '청소년부', true, 17],
    [40, '교육비', 44, '청년부', true, 18],
    [40, '교육비', 45, '목장비', true, 19],
    [40, '교육비', 46, '행사비', true, 20],
    [40, '교육비', 47, '친교비', true, 21],
    [40, '교육비', 48, '도서비', true, 22],
    [40, '교육비', 49, '장학금', true, 23],
    // 봉사비 (50)
    [50, '봉사비', 50, '봉사비', true, 24],
    [50, '봉사비', 51, '경조비', true, 25],
    [50, '봉사비', 52, '구호비', true, 26],
    [50, '봉사비', 53, '지역사회봉사비', true, 27],
    // 관리비 (60)
    [60, '관리비', 60, '관리비', true, 29],
    [60, '관리비', 61, '사택관리비', true, 30],
    [60, '관리비', 62, '수도광열비', true, 31],
    [60, '관리비', 63, '공과금', true, 32],
    [60, '관리비', 64, '관리대행비', true, 33],
    [60, '관리비', 65, '차량유지비', true, 34],
    [60, '관리비', 66, '수선유지비', true, 35],
    // 운영비 (70)
    [70, '운영비', 70, '운영비', true, 36],
    [70, '운영비', 71, '통신비', true, 37],
    [70, '운영비', 72, '도서인쇄비', true, 38],
    [70, '운영비', 73, '회의비', true, 39],
    [70, '운영비', 74, '사무비', true, 40],
    [70, '운영비', 75, '잡비', true, 41],
    // 상회비 (80)
    [80, '상회비', 80, '상회비', true, 42],
    [80, '상회비', 81, '상회비', true, 43],
    // 기타비용 (90)
    [90, '기타비용', 90, '기타비용', true, 44],
    [90, '기타비용', 91, '목회활동비', true, 45],
    [90, '기타비용', 92, '일시차입금상환', true, 46],
    [90, '기타비용', 93, '제적립예금', true, 47],
    [90, '기타비용', 94, '법인세', true, 48],
    [90, '기타비용', 96, '지정헌금지출', true, 49],
    // 예비비 (100)
    [100, '예비비', 100, '예비비', true, 49],
    [100, '예비비', 101, '예비비', true, 50],
    // 건축비 (500)
    [500, '건축비', 500, '건축비', true, 51],
    [500, '건축비', 501, '건축지급이자', true, 52],
    [500, '건축비', 502, '건축원금상환', true, 53],
    [500, '건축비', 503, '일시대출금', true, 54],
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

// ============================================
// 이월잔액 관련
// ============================================

export async function getCarryoverBalances(): Promise<CarryoverBalance[]> {
  return getSheetData<CarryoverBalance>(FINANCE_CONFIG.sheets.carryoverBalance);
}

export async function getCarryoverBalance(year: number): Promise<CarryoverBalance | null> {
  const data = await getCarryoverBalances();
  return data.find(b => b.year === year) || null;
}

export async function setCarryoverBalance(record: CarryoverBalance): Promise<void> {
  const existing = await getCarryoverBalances();
  const existingIndex = existing.findIndex(b => b.year === record.year);

  if (existingIndex >= 0) {
    // 업데이트
    const rows = await readSheet(FINANCE_CONFIG.sheets.carryoverBalance);
    const rowIndex = existingIndex + 1; // +1 for header
    const row = [
      record.year,
      record.balance,
      record.construction_balance || 0,
      record.note || '',
      record.updated_at,
      record.updated_by || '',
    ];
    await updateSheet(
      FINANCE_CONFIG.sheets.carryoverBalance,
      `A${rowIndex + 1}:F${rowIndex + 1}`,
      [row]
    );
  } else {
    // 신규 추가
    const row = [
      record.year,
      record.balance,
      record.construction_balance || 0,
      record.note || '',
      record.updated_at,
      record.updated_by || '',
    ];
    await appendToSheet(FINANCE_CONFIG.sheets.carryoverBalance, [row]);
  }
}

// ============================================
// 작정헌금 관련
// ============================================

export async function getPledgeDonations(year?: number): Promise<PledgeDonation[]> {
  const data = await getSheetData<PledgeDonation>(FINANCE_CONFIG.sheets.pledgeDonations);
  if (year) {
    return data.filter(p => p.year === year);
  }
  return data;
}

export async function addPledgeDonation(pledge: Omit<PledgeDonation, 'id' | 'fulfilled_amount'>): Promise<string> {
  const id = generateId('PLG');
  const row = [
    id,
    pledge.year,
    pledge.type || '건축헌금', // 기본값: 건축헌금
    pledge.donor_name,
    pledge.representative,
    pledge.pledged_amount,
    0, // fulfilled_amount (자동 계산)
    pledge.note || '',
    pledge.created_at,
    pledge.updated_at,
  ];
  await appendToSheet(FINANCE_CONFIG.sheets.pledgeDonations, [row]);
  return id;
}

export async function updatePledgeDonation(
  id: string,
  updates: Partial<PledgeDonation>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.pledgeDonations);
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) throw new Error(`Pledge donation ${id} not found`);

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  const updatedRow = headers.map((header, idx) => {
    if (header in updates) {
      return (updates as Record<string, unknown>)[header];
    }
    return currentRow[idx];
  });

  await updateSheet(
    FINANCE_CONFIG.sheets.pledgeDonations,
    `A${rowIndex + 1}:J${rowIndex + 1}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

export async function deletePledgeDonation(id: string): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetName = FINANCE_CONFIG.sheets.pledgeDonations;

  // 시트 ID 가져오기
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error('시트를 찾을 수 없습니다');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:J`,
  });

  const rows = response.data.values || [];
  const dataRows = rows.slice(1);

  const rowIndex = dataRows.findIndex((row) => row[0] === id);

  if (rowIndex === -1) {
    throw new Error('작정헌금 정보를 찾을 수 없습니다');
  }

  // 행 삭제
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 for header
              endIndex: rowIndex + 2,
            },
          },
        },
      ],
    },
  });
}

// ============================================
// 예산 CRUD 관련
// ============================================

export async function getAllBudgets(): Promise<Budget[]> {
  return getSheetData<Budget>(FINANCE_CONFIG.sheets.budget);
}

export async function addBudget(budget: Budget): Promise<void> {
  const row = [
    budget.year,
    budget.category_code,
    budget.category_item,
    budget.account_code,
    budget.account_item,
    budget.budgeted_amount,
    budget.note || '',
  ];
  await appendToSheet(FINANCE_CONFIG.sheets.budget, [row]);
}

export async function updateBudget(
  year: number,
  accountCode: number,
  updates: Partial<Budget>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.budget);
  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex(
    (row) => Number(row[0]) === year && Number(row[3]) === accountCode
  );

  if (rowIndex === -1) throw new Error('예산 항목을 찾을 수 없습니다');

  const currentRow = dataRows[rowIndex];
  const updatedRow = [
    updates.year ?? Number(currentRow[0]),
    updates.category_code ?? Number(currentRow[1]),
    updates.category_item ?? currentRow[2],
    updates.account_code ?? Number(currentRow[3]),
    updates.account_item ?? currentRow[4],
    updates.budgeted_amount ?? Number(currentRow[5]),
    updates.note ?? currentRow[6] ?? '',
  ];

  await updateSheet(
    FINANCE_CONFIG.sheets.budget,
    `A${rowIndex + 2}:G${rowIndex + 2}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

export async function deleteBudget(year: number, accountCode: number): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetName = FINANCE_CONFIG.sheets.budget;

  // 시트 ID 가져오기
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error('시트를 찾을 수 없습니다');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A:G`,
  });

  const rows = response.data.values || [];
  const dataRows = rows.slice(1);

  const rowIndex = dataRows.findIndex(
    (row) => Number(row[0]) === year && Number(row[3]) === accountCode
  );

  if (rowIndex === -1) {
    throw new Error('예산 항목을 찾을 수 없습니다');
  }

  // 행 삭제
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 for header
              endIndex: rowIndex + 2,
            },
          },
        },
      ],
    },
  });
}

// ============================================
// 건축헌금현황 관련
// ============================================

export interface BuildingSummaryData {
  landCost: number;              // 토지 18억
  buildingCost: number;          // 건물 34억
  totalCost: number;             // 합계 52억
  donationBefore2011: number;    // 헌금(~11년) 32억
  totalLoan: number;             // 대출 21억
  donationAfter2012: number;     // 헌금(12년~)
  currentYearInterest: number;   // 금년 이자지출
  currentYearPrincipal: number;  // 금년 원금상환
  cumulativeInterest: number;    // 누적 이자지출
  cumulativePrincipal: number;   // 누적 원금상환
  loanBalance: number;           // 대출잔금
}

export interface BuildingYearlyDonation {
  year: number;
  donation: number;
}

/**
 * 건축헌금현황 요약 데이터 읽기 (고정 셀 위치 참조)
 * 시트: 2025건축헌금현황 (대시보드 형태)
 */
export async function getBuildingSummary(): Promise<BuildingSummaryData> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.buildingStatus, 'A:C');

  const parseNum = (val: string | undefined) => {
    if (!val) return 0;
    return Number(val.replace(/,/g, '')) || 0;
  };

  // 시트의 고정 위치에서 값 추출
  // 행 인덱스는 0-based (실제 시트 행 -1)
  return {
    landCost: parseNum(rows[2]?.[2]),              // C3: 토지
    buildingCost: parseNum(rows[3]?.[2]),          // C4: 건물
    totalCost: parseNum(rows[4]?.[2]),             // C5: 건축비 합계
    donationBefore2011: parseNum(rows[7]?.[2]),    // C8: 헌금(~11년)
    totalLoan: parseNum(rows[8]?.[2]),             // C9: 대출
    donationAfter2012: parseNum(rows[9]?.[2]),     // C10: 헌금(12년~)
    currentYearInterest: parseNum(rows[11]?.[2]),  // C12: 금년 이자지출
    currentYearPrincipal: parseNum(rows[12]?.[2]), // C13: 금년 원금상환
    cumulativeInterest: parseNum(rows[14]?.[2]),   // C15: 누적 이자지출
    cumulativePrincipal: parseNum(rows[15]?.[2]),  // C16: 누적 원금상환
    loanBalance: parseNum(rows[16]?.[2]),          // C17: 대출잔금
  };
}

/**
 * 연도별 건축헌금 읽기 (2012년 이후)
 * 시트: 2025건축헌금현황 우측 섹션 (E~G열)
 */
export async function getBuildingYearlyDonations(): Promise<BuildingYearlyDonation[]> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.buildingStatus, 'E:G');

  const parseNum = (val: string | undefined) => {
    if (!val) return 0;
    return Number(val.replace(/,/g, '')) || 0;
  };

  const donations: BuildingYearlyDonation[] = [];

  // 데이터 행 파싱 (헤더 건너뛰고, 2012년부터)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const year = Number(row[0]);  // E열: 연도
    const amount = parseNum(row[2]);  // G열: 금액

    if (year >= 2012 && year <= 2030 && amount >= 0) {
      donations.push({ year, donation: amount });
    }
  }

  return donations.sort((a, b) => a.year - b.year);
}

/**
 * 대출 이자율 읽기
 * 시트: 2025건축헌금현황 J2 셀
 */
export async function getBuildingInterestRate(): Promise<number> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.buildingStatus, 'J:J');

  // J2 셀 값 읽기 (인덱스 1)
  const rateStr = rows[1]?.[0];
  if (!rateStr) return 4.65; // 기본값

  // 퍼센트 문자열 파싱 (예: "4.65%" 또는 "4.65")
  const rate = parseFloat(rateStr.replace(/%/g, '').replace(/,/g, ''));
  return isNaN(rate) ? 4.65 : rate;
}

// ============================================
// 사업자정보 관련
// ============================================

export interface BusinessInfo {
  company_name: string;       // 상호
  business_number: string;    // 사업자등록번호
  address: string;            // 주소
  representative: string;     // 대표자명
  note: string;               // 비고
  created_at: string;         // 등록일시
}

/**
 * 모든 사업자정보 조회
 */
export async function getAllBusinessInfo(): Promise<BusinessInfo[]> {
  return getSheetData<BusinessInfo>(FINANCE_CONFIG.sheets.businessInfo);
}

/**
 * 상호로 사업자정보 검색 (정확히 일치)
 */
export async function getBusinessInfoByName(companyName: string): Promise<BusinessInfo | null> {
  const data = await getAllBusinessInfo();
  return data.find(b => b.company_name === companyName) || null;
}

/**
 * 상호로 사업자정보 검색 (부분 일치 - 자동완성용)
 */
export async function searchBusinessInfo(keyword: string): Promise<BusinessInfo[]> {
  const data = await getAllBusinessInfo();
  if (!keyword) return data;
  const lowerKeyword = keyword.toLowerCase();
  return data.filter(b => b.company_name.toLowerCase().includes(lowerKeyword));
}

/**
 * 사업자정보 추가
 */
export async function addBusinessInfo(info: Omit<BusinessInfo, 'created_at'>): Promise<void> {
  const row = [
    info.company_name,
    info.business_number || '',
    info.address || '',
    info.representative || '',
    info.note || '',
    getKSTDateTime(),
  ];
  await appendToSheet(FINANCE_CONFIG.sheets.businessInfo, [row]);
}
