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
  Pledge,
  PledgeHistory,
  PledgeMilestone,
  OfferingType,
  PledgePeriod,
  PledgeStatus,
  CardExpenseTempRecord,
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
    pledges: '작정헌금v2',
    pledgeHistory: '작정이력',
    pledgeMilestones: '작정마일스톤',
    buildingMaster: '건축원장',
    yearlyBudget: '연도별예산',
    businessInfo: '사업자정보',
    expenseClaim: '지출청구',
    accounts: '계정',
    cardExpenseTemp: '카드내역임시',
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

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: data,
    },
  });

  // 응답 검증: 업데이트된 셀 수 확인
  const expectedCells = data.reduce((sum, row) => sum + row.length, 0);
  const actualCells = response.data.updatedCells || 0;

  console.log('[updateSheet]', sheetName, range, '- 예상:', expectedCells, '셀, 실제:', actualCells, '셀');

  if (actualCells === 0) {
    console.error('[updateSheet] 경고: 업데이트된 셀 없음!', sheetName, range);
  }
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
// 현금헌금 조회 (외부 시트 - 여러 날짜 탭 순회)
// ============================================

/**
 * 스프레드시트의 모든 탭(시트) 이름 조회
 */
async function getSheetTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  return response.data.sheets?.map(s => s.properties?.title || '') || [];
}

/**
 * 탭명이 날짜 형식인지 확인 (YYYY/MM/DD)
 */
function isDateTabName(tabName: string): boolean {
  return /^\d{4}\/\d{2}\/\d{2}$/.test(tabName);
}

/**
 * 탭명을 날짜 문자열로 변환 (2026/01/18 → 2026-01-18)
 */
function tabNameToDate(tabName: string): string {
  return tabName.replace(/\//g, '-');
}

export async function fetchCashOfferings(
  startDate?: string,
  endDate?: string
): Promise<CashOffering[]> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = CASH_OFFERING_CONFIG.spreadsheetId;

  // 1. 모든 탭 목록 조회
  const allTabs = await getSheetTabs(spreadsheetId);

  // 2. 날짜 형식 탭만 필터링 (YYYY/MM/DD)
  const dateTabs = allTabs.filter(isDateTabName);

  if (dateTabs.length === 0) {
    console.warn('날짜 형식 탭이 없습니다. 기존 헌금함 탭 시도...');
    // 폴백: 기존 헌금함 탭 시도
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${CASH_OFFERING_CONFIG.sheetName}!A:H`,
      });
      const rows = response.data.values;
      if (!rows || rows.length <= 1) return [];

      const data = rows.slice(1);
      return data
        .filter(row => row[0] && row[2] && row[3])
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
    } catch {
      return [];
    }
  }

  // 3. 시작일~종료일 범위에 해당하는 탭만 선택
  let targetTabs = dateTabs;
  if (startDate && endDate) {
    targetTabs = dateTabs.filter(tabName => {
      const tabDate = tabNameToDate(tabName);
      return tabDate >= startDate && tabDate <= endDate;
    });
  }

  if (targetTabs.length === 0) {
    return [];
  }

  // 4. 각 탭에서 데이터 읽어와 통합
  const allOfferings: CashOffering[] = [];

  for (const tabName of targetTabs) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A:H`, // 탭명에 /가 있으므로 따옴표 필요
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) continue;

      const tabDate = tabNameToDate(tabName); // 탭명에서 날짜 추출
      const data = rows.slice(1);

      // 헌금함 시트 컬럼: A=?, B=경로, C=성명, D=금액, E=소코드, F=소항목, G=대코드, H=비고
      const offerings = data
        .filter(row => row[2] && row[3]) // 성명(C), 금액(D) 필수
        .map(row => ({
          date: tabDate, // 탭명에서 추출한 날짜 사용
          source: row[1] || '헌금함', // B: 경로
          donor_name: row[2], // C: 성명
          amount: parseAmount(row[3]), // D: 금액
          code: parseInt(row[4]) || 11, // E: 소코드
          item: row[5] || '주일헌금', // F: 소항목
          category_code: parseInt(row[6]) || 10, // G: 대코드
          note: row[7] || '', // H: 비고
        }));

      allOfferings.push(...offerings);
    } catch (error) {
      console.warn(`탭 '${tabName}' 읽기 실패:`, error);
      continue;
    }
  }

  return allOfferings;
}

// ============================================
// 수입부 관련
// ============================================

export async function addIncomeRecords(records: IncomeRecord[], skipPledgeMatching = false): Promise<void> {
  const rows = records.map(r => [
    r.id,
    r.date, // 기준일 (주일)
    r.source,
    r.offering_code,
    r.donor_name,
    r.representative,
    r.amount,
    r.note,
    r.input_method,
    r.created_at,
    r.created_by || '',
    r.transaction_date || '', // 실제 거래일
  ]);

  await appendToSheet(FINANCE_CONFIG.sheets.income, rows);

  // 작정 자동 매칭 (skipPledgeMatching이 false일 때만)
  if (!skipPledgeMatching) {
    for (const record of records) {
      if (record.donor_name && record.offering_code && record.amount > 0) {
        try {
          await matchIncomeToPlledge(
            record.donor_name,
            record.id,
            record.offering_code,
            record.amount,
            record.date
          );
        } catch (err) {
          console.error(`Pledge matching failed for income ${record.id}:`, err);
          // 매칭 실패해도 수입 기록은 유지
        }
      }
    }
  }
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
    r.date, // 기준일 (주일)
    r.payment_method,
    r.vendor,
    r.description,
    r.amount,
    r.account_code,
    r.category_code,
    r.note,
    r.created_at,
    r.created_by || '',
    r.transaction_date || '', // 실제 거래일
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

// NH카드대금 행 검색 (총액으로 매칭)
export async function findNhCardExpenseRecord(
  totalAmount: number
): Promise<(ExpenseRecord & { rowIndex: number }) | null> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.expense);
  if (rows.length <= 1) return null;

  // NH카드 관련 키워드
  const nhCardKeywords = ['nh카드대금', 'nh기업카드', 'nh카드', '농협카드'];

  // 금액 파싱 함수 (쉼표 제거)
  const parseAmount = (val: unknown): number => {
    if (typeof val === 'number') return val;
    const str = String(val || '').replace(/[,원\s]/g, '');
    return Number(str) || 0;
  };

  // 디버그: 찾고자 하는 금액 로깅
  console.log(`Finding NH카드대금 with amount: ${totalAmount}`);

  // 헤더 제외한 데이터 검색
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const description = String(row[4] || '').trim().toLowerCase();
    const vendor = String(row[3] || '').trim().toLowerCase();
    const amount = parseAmount(row[5]);

    // description 또는 vendor가 NH카드 관련 키워드를 포함하는지 확인
    const isNhCard = nhCardKeywords.some(
      (keyword) => description.includes(keyword) || vendor.includes(keyword)
    );

    // 디버그: NH카드 관련 행 발견 시 로깅
    if (isNhCard) {
      console.log(`Found NH카드 row: vendor="${vendor}", desc="${description}", amount=${amount} (raw: ${row[5]})`);
    }

    if (isNhCard && amount === totalAmount) {
      return {
        id: String(row[0] || ''),
        date: String(row[1] || ''),
        payment_method: String(row[2] || ''),
        vendor: String(row[3] || '').trim(),
        description: String(row[4] || '').trim(),
        amount: amount,
        account_code: Number(row[6]) || 0,
        category_code: Number(row[7]) || 0,
        note: String(row[8] || ''),
        created_at: String(row[9] || ''),
        created_by: String(row[10] || ''),
        transaction_date: String(row[11] || ''),
        rowIndex: i + 1, // 1-based (시트 행 번호)
      };
    }
  }

  console.log('No matching NH카드대금 record found');
  return null;
}

// 지출 레코드 삭제 (ID로)
export async function deleteExpenseRecord(id: string): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const sheetName = FINANCE_CONFIG.sheets.expense;

  // 시트 ID 가져오기
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet?.properties?.sheetId) {
    throw new Error('지출부 시트를 찾을 수 없습니다');
  }

  // 행 찾기
  const rows = await readSheet(sheetName);
  const rowIndex = rows.findIndex((row) => row[0] === id);

  if (rowIndex === -1) {
    throw new Error(`지출 레코드를 찾을 수 없습니다: ${id}`);
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
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

// ============================================
// 은행원장 관련
// ============================================

export async function addBankTransactions(transactions: BankTransaction[]): Promise<void> {
  const rows = transactions.map(t => [
    t.id,
    t.transaction_date, // 실제 거래일
    t.date, // 기준일 (주일)
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

  if (rowIndex === -1) {
    console.error('[updateBankTransaction] ID not found:', id, 'Total rows:', rows.length);
    throw new Error(`Bank transaction ${id} not found`);
  }

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  // 필수 컬럼 인덱스 확인
  const matchedStatusIdx = headers.indexOf('matched_status');
  const matchedTypeIdx = headers.indexOf('matched_type');
  const matchedIdsIdx = headers.indexOf('matched_ids');
  const suppressedIdx = headers.indexOf('suppressed');
  const suppressedReasonIdx = headers.indexOf('suppressed_reason');

  if (matchedStatusIdx === -1) {
    console.error('[updateBankTransaction] matched_status 헤더 없음! 헤더:', headers.join(', '));
    throw new Error('matched_status column not found');
  }

  const currentStatus = currentRow[matchedStatusIdx] || 'unknown';

  // 업데이트할 행 데이터 구성 (현재 데이터 복사 후 명시적 업데이트)
  const updatedRow = [...currentRow];

  // 행 길이가 헤더보다 짧으면 확장
  while (updatedRow.length < headers.length) {
    updatedRow.push('');
  }

  // 명시적으로 각 필드 업데이트 (헤더 이름 의존 제거)
  if (updates.matched_status !== undefined && matchedStatusIdx !== -1) {
    updatedRow[matchedStatusIdx] = updates.matched_status;
  }
  if (updates.matched_type !== undefined && matchedTypeIdx !== -1) {
    updatedRow[matchedTypeIdx] = updates.matched_type;
  }
  if (updates.matched_ids !== undefined && matchedIdsIdx !== -1) {
    updatedRow[matchedIdsIdx] = updates.matched_ids;
  }
  if (updates.suppressed !== undefined && suppressedIdx !== -1) {
    updatedRow[suppressedIdx] = String(updates.suppressed);
  }
  if (updates.suppressed_reason !== undefined && suppressedReasonIdx !== -1) {
    updatedRow[suppressedReasonIdx] = updates.suppressed_reason;
  }

  // 동적 범위 계산 (헤더 길이 기반)
  const lastColIndex = Math.min(headers.length - 1, 25); // 최대 Z열까지
  const lastColLetter = String.fromCharCode(65 + lastColIndex);
  const range = `A${rowIndex + 1}:${lastColLetter}${rowIndex + 1}`;

  console.log('[updateBankTransaction] ID:', id, '상태:', currentStatus, '→', updates.matched_status,
    '(row:', rowIndex + 1, ', statusCol:', matchedStatusIdx + 1, ', range:', range, ')');

  await updateSheet(
    FINANCE_CONFIG.sheets.bank,
    range,
    [updatedRow.slice(0, lastColIndex + 1) as (string | number | boolean)[]]
  );

  console.log('[updateBankTransaction] 완료:', id);
}

// 배치 업데이트: 여러 은행거래 상태를 한 번의 API 호출로 업데이트
export async function updateBankTransactionsBatch(
  updates: Array<{
    id: string;
    matched_status: 'matched' | 'suppressed';
    matched_type?: string;
    matched_ids?: string;
    suppressed?: boolean;
    suppressed_reason?: string;
  }>
): Promise<{ success: string[]; failed: string[] }> {
  const sheets = getGoogleSheetsClient();

  // 1. 은행원장 전체 읽기 (한 번만)
  const rows = await readSheet(FINANCE_CONFIG.sheets.bank);
  if (rows.length === 0) {
    console.error('[updateBankTransactionsBatch] 은행원장이 비어있음');
    return { success: [], failed: updates.map(u => u.id) };
  }

  const headers = rows[0];

  // 컬럼 인덱스 찾기
  const matchedStatusIdx = headers.indexOf('matched_status');
  const matchedTypeIdx = headers.indexOf('matched_type');
  const matchedIdsIdx = headers.indexOf('matched_ids');
  const suppressedIdx = headers.indexOf('suppressed');
  const suppressedReasonIdx = headers.indexOf('suppressed_reason');

  if (matchedStatusIdx === -1) {
    console.error('[updateBankTransactionsBatch] matched_status 헤더 없음');
    return { success: [], failed: updates.map(u => u.id) };
  }

  // 2. ID → 행 인덱스 맵 생성
  const idToRowIndex = new Map<string, number>();
  rows.forEach((row, idx) => {
    if (idx > 0 && row[0]) { // 헤더 제외
      idToRowIndex.set(row[0], idx);
    }
  });

  // 3. 배치 업데이트 요청 구성
  const batchRequests: Array<{
    range: string;
    values: (string | number | boolean)[][];
  }> = [];

  const successIds: string[] = [];
  const failedIds: string[] = [];

  for (const update of updates) {
    const rowIndex = idToRowIndex.get(update.id);
    if (rowIndex === undefined) {
      console.warn('[updateBankTransactionsBatch] ID 없음:', update.id);
      failedIds.push(update.id);
      continue;
    }

    const currentRow = [...rows[rowIndex]];

    // 행 길이 확장
    while (currentRow.length < headers.length) {
      currentRow.push('');
    }

    // 값 업데이트
    currentRow[matchedStatusIdx] = update.matched_status;
    if (update.matched_type !== undefined && matchedTypeIdx !== -1) {
      currentRow[matchedTypeIdx] = update.matched_type;
    }
    if (update.matched_ids !== undefined && matchedIdsIdx !== -1) {
      currentRow[matchedIdsIdx] = update.matched_ids;
    }
    if (update.suppressed !== undefined && suppressedIdx !== -1) {
      currentRow[suppressedIdx] = String(update.suppressed);
    }
    if (update.suppressed_reason !== undefined && suppressedReasonIdx !== -1) {
      currentRow[suppressedReasonIdx] = update.suppressed_reason;
    }

    // 범위는 A:Q (17열)로 제한
    const range = `${FINANCE_CONFIG.sheets.bank}!A${rowIndex + 1}:Q${rowIndex + 1}`;
    batchRequests.push({
      range,
      values: [currentRow.slice(0, 17) as (string | number | boolean)[]],
    });

    successIds.push(update.id);
  }

  if (batchRequests.length === 0) {
    console.warn('[updateBankTransactionsBatch] 업데이트할 항목 없음');
    return { success: [], failed: failedIds };
  }

  // 4. 배치 업데이트 실행 (한 번의 API 호출)
  console.log('[updateBankTransactionsBatch] 배치 업데이트 시작:', batchRequests.length, '건');

  try {
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchRequests,
      },
    });

    const updatedCells = response.data.totalUpdatedCells || 0;
    console.log('[updateBankTransactionsBatch] 완료:', successIds.length, '건, 업데이트된 셀:', updatedCells);

    return { success: successIds, failed: failedIds };
  } catch (error) {
    console.error('[updateBankTransactionsBatch] 배치 업데이트 실패:', error);
    // 배치 실패 시 모든 항목 실패로 처리
    return { success: [], failed: [...successIds, ...failedIds] };
  }
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

export async function clearMatchingRules(): Promise<number> {
  const sheets = getGoogleSheetsClient();
  const rows = await readSheet(FINANCE_CONFIG.sheets.matchingRules);

  if (rows.length <= 1) return 0; // 헤더만 있으면 삭제할 것 없음

  const deleteCount = rows.length - 1;

  // 헤더를 제외한 모든 데이터 삭제 (2행부터)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${FINANCE_CONFIG.sheets.matchingRules}!A2:J${rows.length}`,
  });

  return deleteCount;
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
      'created_at', 'created_by', 'transaction_date'
    ],
    [FINANCE_CONFIG.sheets.expense]: [
      'id', 'date', 'payment_method', 'vendor', 'description',
      'amount', 'account_code', 'category_code',
      'note', 'created_at', 'created_by', 'transaction_date'
    ],
    [FINANCE_CONFIG.sheets.bank]: [
      'id', 'transaction_date', 'date', 'withdrawal', 'deposit', 'balance',
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
  const random = Math.random().toString(36).substring(2, 6);  // 4자리 랜덤 문자열
  return `${prefix}${dateStr}${timeStr}${random}`;
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

/**
 * 주어진 날짜가 속한 주의 일요일(기준일) 반환
 * 주간: 월요일~일요일
 * @param dateStr YYYY-MM-DD 형식
 * @returns 해당 주의 일요일 날짜 (YYYY-MM-DD)
 */
export function getWeekEndingSunday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0=일, 1=월, ..., 6=토

  // 일요일이면 그대로, 아니면 다음 일요일로
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

// ============================================
// 건축현황마스터 타입 정의
// ============================================

export interface BuildingMasterData {
  // 기본정보
  landCost: number;
  buildingCost: number;
  totalCost: number;
  initialLoan: number;
  interestRate: number;

  // 스냅샷 (연말 기준)
  snapshotDate: string;
  snapshotYear: number;
  cumulativeDonationBefore2011: number;
  cumulativeDonationAfter2012: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
  loanBalance: number;

  // 연도별 히스토리 (차트용)
  history: BuildingYearlyHistory[];
}

export interface BuildingYearlyHistory {
  year: number;
  donation: number;           // G열: 연간 헌금
  principal: number;          // H열: 누적 원금 상환
  interest: number;           // I열: 누적 이자 지출
  loanBalance: number;        // J열: 대출 잔액
  yearlyPrincipal: number;    // K열: 연간 원금 상환
  yearlyInterest: number;     // L열: 연간 이자 지출
  milestone?: string;
}

/**
 * 건축현황마스터 전체 데이터 읽기
 * 시트: 건축원장
 *
 * 실제 시트 구조:
 * - D4: 토지비, D5: 건물비, D6: 합계
 * - D8: 헌금(~11년), D9: 대출
 * - D11: 헌금(12년~)
 * - B13: 스냅샷연도 (예: "2025")
 * - D13: 금년이자지출, D14: 금년원금상환
 * - D16: 누적이자지출, D17: 누적원금상환, D18: 대출잔금
 * - J2: 이자율 (예: "4.65%")
 * - F4~F17: 연도(2012~2025), G4~G17: 연간헌금액
 */
export async function getBuildingMaster(): Promise<BuildingMasterData> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.buildingMaster, 'A:L');

  const parseNum = (val: string | undefined) => {
    if (!val) return 0;
    return Number(String(val).replace(/,/g, '')) || 0;
  };

  // 건축비 (D열, index 3)
  const landCost = parseNum(rows[3]?.[3]);        // D4: 토지
  const buildingCost = parseNum(rows[4]?.[3]);    // D5: 건물
  const totalCost = parseNum(rows[5]?.[3]);       // D6: 합계

  // 비용조달 (D열)
  const cumulativeDonationBefore2011 = parseNum(rows[7]?.[3]);  // D8: 헌금(~11년)
  const initialLoan = parseNum(rows[8]?.[3]);     // D9: 대출
  const cumulativeDonationAfter2012 = parseNum(rows[10]?.[3]);  // D11: 헌금(12년~)

  // 스냅샷 연도 (B13, index 1)
  const snapshotYearStr = String(rows[12]?.[1] || '2025');
  const snapshotYear = parseInt(snapshotYearStr) || 2025;
  const snapshotDate = `${snapshotYear}-12-31`;

  // 이자율 (J2, index 9)
  const interestRateStr = String(rows[1]?.[9] || '4.7').replace(/%/g, '');
  const interestRate = parseFloat(interestRateStr) || 4.7;

  // 누적 상환 (D열)
  const cumulativeInterest = parseNum(rows[15]?.[3]);    // D16: 누적 이자 지출
  const cumulativePrincipal = parseNum(rows[16]?.[3]);   // D17: 누적 원금 상환
  const loanBalance = parseNum(rows[17]?.[3]);           // D18: 대출잔금

  // 히스토리 (F-L열: 연도별 데이터)
  // F: 연도, G: 헌금, H: 누적원금, I: 누적이자, J: 잔액, K: 연간원금, L: 연간이자
  const history: BuildingYearlyHistory[] = [];
  for (let i = 3; i <= 20; i++) {  // Row 4-21 (index 3-20)
    const row = rows[i];
    if (!row) continue;

    const yearStr = String(row[5] || '');  // F열 (index 5)
    const year = parseInt(yearStr);
    if (isNaN(year) || year < 2003) continue;

    const donation = parseNum(row[6]);            // G열: 연간 헌금
    const principal = parseNum(row[7]);           // H열: 누적 원금 상환
    const interest = parseNum(row[8]);            // I열: 누적 이자 지출
    const historyLoanBalance = parseNum(row[9]);  // J열: 대출 잔액
    const yearlyPrincipal = parseNum(row[10]);    // K열: 연간 원금 상환
    const yearlyInterest = parseNum(row[11]);     // L열: 연간 이자 지출

    history.push({
      year,
      donation,
      principal,
      interest,
      loanBalance: historyLoanBalance,
      yearlyPrincipal,
      yearlyInterest,
    });
  }

  return {
    landCost: landCost || 1800000000,
    buildingCost: buildingCost || 3400000000,
    totalCost: totalCost || 5200000000,
    initialLoan: initialLoan || 2100000000,
    interestRate,
    snapshotDate,
    snapshotYear,
    cumulativeDonationBefore2011: cumulativeDonationBefore2011 || 3200000000,
    cumulativeDonationAfter2012: cumulativeDonationAfter2012 || 1220000000,
    cumulativePrincipal: cumulativePrincipal || 800000000,
    cumulativeInterest: cumulativeInterest || 1026764421,
    loanBalance: loanBalance || 1300000000,
    history: history.sort((a, b) => a.year - b.year),
  };
}

// 레거시 호환을 위한 래퍼 함수들
export async function getBuildingSummary(): Promise<BuildingSummaryData> {
  const master = await getBuildingMaster();
  return {
    landCost: master.landCost,
    buildingCost: master.buildingCost,
    totalCost: master.totalCost,
    donationBefore2011: master.cumulativeDonationBefore2011,
    totalLoan: master.initialLoan,
    donationAfter2012: master.cumulativeDonationAfter2012,
    currentYearInterest: 0, // 실시간 계산 필요
    currentYearPrincipal: 0, // 실시간 계산 필요
    cumulativeInterest: master.cumulativeInterest,
    cumulativePrincipal: master.cumulativePrincipal,
    loanBalance: master.loanBalance,
  };
}

export async function getBuildingYearlyDonations(): Promise<BuildingYearlyDonation[]> {
  const master = await getBuildingMaster();
  return master.history.map(h => ({
    year: h.year,
    donation: h.donation,
  }));
}

export async function getBuildingInterestRate(): Promise<number> {
  const master = await getBuildingMaster();
  return master.interestRate;
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

// ============================================
// 지출청구 관련
// ============================================

export interface ExpenseClaimRow {
  rowIndex: number;       // 시트 행 번호 (1-based, 헤더 포함)
  bankName: string;       // A: 은행명
  accountNumber: string;  // B: 입금계좌
  amount: number;         // C: 이체금액
  claimant: string;       // D: 청구자
  accountCode: string;    // E: 계정
  description: string;    // G: 내역
  processedDate: string;  // K: 입금처리
}

export interface AccountInfo {
  name: string;           // 이름
  bankName: string;       // 은행명
  accountNumber: string;  // 계좌번호
}

/**
 * 계정 시트에서 이름으로 은행/계좌 정보 조회
 * 계정 시트 구조: A=이름, B=은행명, C=계좌번호 (추정)
 */
async function getAccountInfoByName(name: string): Promise<AccountInfo | null> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.accounts, 'A:C');
  if (!rows || rows.length <= 1) return null;

  // 헤더 스킵, 이름으로 검색
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rowName = (row[0] || '').trim();
    if (rowName === name.trim()) {
      return {
        name: rowName,
        bankName: row[1] || '',
        accountNumber: row[2] || '',
      };
    }
  }
  return null;
}

/**
 * 지출청구 시트에서 미처리 데이터 조회 (K컬럼이 비어있는 행)
 * 은행/계좌가 비어있으면 청구자 이름으로 계정 시트에서 조회
 */
export async function getUnprocessedExpenseClaims(): Promise<ExpenseClaimRow[]> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.expenseClaim, 'A:K');

  if (!rows || rows.length <= 1) return [];

  // 계정 정보 캐시 (같은 청구자 중복 조회 방지)
  const accountCache = new Map<string, AccountInfo | null>();

  const claims: ExpenseClaimRow[] = [];

  // 헤더 스킵, 데이터 행부터 처리 (i=1부터)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // K컬럼(index 10)이 비어있는 행만 선택
    const processedDate = row[10] || '';
    if (processedDate.trim() !== '') continue;

    // 컬럼 매핑: D=청구자, E=계정, F=금액, G=내역, H=계좌번호, J=은행명
    let bankName = row[9] || '';      // J컬럼 (index 9)
    let accountNumber = '';
    const rawAccount = row[7] || '';  // H컬럼 (index 7)
    const amountStr = row[5] || '0';  // F컬럼 (index 5)
    const claimant = row[3] || '';    // D컬럼 (index 3)

    // H컬럼에 "계좌 / 은행명 / 이름" 형태인 경우 파싱
    if (rawAccount.includes('/')) {
      const parts = rawAccount.split('/').map(s => s.trim());
      accountNumber = parts[0].replace(/[^0-9]/g, '');
      if (!bankName && parts[1]) bankName = parts[1];
    } else {
      accountNumber = rawAccount.replace(/[^0-9]/g, '');
    }

    // 은행/계좌가 비어있고 청구자가 있으면 계정 시트에서 조회
    if ((!bankName || !accountNumber) && claimant) {
      if (!accountCache.has(claimant)) {
        const accountInfo = await getAccountInfoByName(claimant);
        accountCache.set(claimant, accountInfo);
      }
      const cached = accountCache.get(claimant);
      if (cached) {
        if (!bankName) bankName = cached.bankName;
        if (!accountNumber) accountNumber = cached.accountNumber;
      }
    }

    // 금액 파싱
    const amount = parseFloat(String(amountStr).replace(/[,원\s]/g, '')) || 0;
    if (amount <= 0) continue;

    // 은행/계좌가 여전히 비어있으면 스킵 (필수 정보)
    if (!bankName || !accountNumber) continue;

    claims.push({
      rowIndex: i + 1, // 1-based (시트 행 번호)
      bankName,
      accountNumber,
      amount,
      claimant,
      accountCode: row[4] || '',
      description: row[6] || '',
      processedDate: '',
    });
  }

  return claims;
}

/**
 * 지출청구 K컬럼에 처리일자 기입
 * @param rowIndices 처리할 행 번호 배열 (1-based)
 * @param processedDate 처리일자 (YYYY-MM-DD)
 */
export async function markExpenseClaimsAsProcessed(
  rowIndices: number[],
  processedDate: string
): Promise<void> {
  const sheets = getGoogleSheetsClient();

  // 각 행의 K컬럼 업데이트 (batch update)
  const requests = rowIndices.map(rowIndex => ({
    range: `${FINANCE_CONFIG.sheets.expenseClaim}!K${rowIndex}`,
    values: [[processedDate]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: requests,
    },
  });
}

// ============================================
// 작정헌금 v2 관련
// ============================================

// 작정헌금 v2 시트 헤더
const PLEDGE_HEADERS = [
  'id', 'donor_id', 'donor_name', 'representative',
  'offering_type', 'offering_code', 'pledge_period',
  'amount', 'yearly_amount', 'year', 'start_month', 'end_month',
  'fulfilled_amount', 'fulfilled_count',
  'current_streak', 'max_streak', 'last_fulfilled_date',
  'memo', 'status', 'created_at', 'updated_at'
];

const PLEDGE_HISTORY_HEADERS = [
  'id', 'pledge_id', 'income_id', 'amount', 'period_number', 'matched_at'
];

const PLEDGE_MILESTONE_HEADERS = [
  'id', 'donor_name', 'milestone_type', 'achieved_at', 'offering_type', 'year'
];

/**
 * 작정헌금 v2 시트 초기화 (헤더 생성)
 */
export async function initializePledgeSheets(): Promise<void> {
  const sheets = getGoogleSheetsClient();

  const sheetConfigs = [
    { name: FINANCE_CONFIG.sheets.pledges, headers: PLEDGE_HEADERS },
    { name: FINANCE_CONFIG.sheets.pledgeHistory, headers: PLEDGE_HISTORY_HEADERS },
    { name: FINANCE_CONFIG.sheets.pledgeMilestones, headers: PLEDGE_MILESTONE_HEADERS },
  ];

  for (const config of sheetConfigs) {
    try {
      // 시트 생성 시도
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: FINANCE_CONFIG.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: config.name } }
          }]
        }
      });
    } catch {
      // 시트가 이미 존재하면 무시
    }

    // 헤더 설정
    const lastCol = String.fromCharCode(65 + config.headers.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${config.name}!A1:${lastCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [config.headers] }
    });
  }
}

/**
 * 작정헌금 목록 조회
 * representative로 조회하면 해당 대표자의 모든 가족 작정을 반환
 */
export async function getPledges(filters?: {
  year?: number;
  donor_name?: string;
  representative?: string;
  offering_type?: OfferingType;
  status?: PledgeStatus;
}): Promise<Pledge[]> {
  let data = await getSheetData<Pledge>(FINANCE_CONFIG.sheets.pledges);

  if (filters) {
    if (filters.year) {
      data = data.filter(p => p.year === filters.year);
    }
    if (filters.representative) {
      // representative 기준 조회 (가족 단위)
      data = data.filter(p => p.representative === filters.representative);
    } else if (filters.donor_name) {
      // donor_name 기준 조회 (개인)
      data = data.filter(p => p.donor_name === filters.donor_name);
    }
    if (filters.offering_type) {
      data = data.filter(p => p.offering_type === filters.offering_type);
    }
    if (filters.status) {
      data = data.filter(p => p.status === filters.status);
    }
  }

  return data;
}

/**
 * 작정헌금 단일 조회
 */
export async function getPledgeById(id: string): Promise<Pledge | null> {
  const data = await getPledges();
  return data.find(p => p.id === id) || null;
}

/**
 * 헌금자의 특정 연도 작정 조회
 */
export async function getPledgeByDonorAndType(
  donor_name: string,
  year: number,
  offering_type: OfferingType
): Promise<Pledge | null> {
  const data = await getPledges({ year, donor_name, offering_type });
  return data[0] || null;
}

/**
 * 작정헌금 생성
 */
export async function createPledge(pledge: Omit<Pledge, 'id' | 'fulfilled_amount' | 'fulfilled_count' | 'current_streak' | 'max_streak'>): Promise<string> {
  const id = generateId('PLG');
  const now = getKSTDateTime();

  const row = [
    id,
    pledge.donor_id || '',
    pledge.donor_name,
    pledge.representative || '',
    pledge.offering_type,
    pledge.offering_code,
    pledge.pledge_period,
    pledge.amount,
    pledge.yearly_amount,
    pledge.year,
    pledge.start_month,
    pledge.end_month,
    0, // fulfilled_amount
    0, // fulfilled_count
    0, // current_streak
    0, // max_streak
    '', // last_fulfilled_date
    pledge.memo || '',
    pledge.status || 'active',
    now, // created_at
    now, // updated_at
  ];

  await appendToSheet(FINANCE_CONFIG.sheets.pledges, [row]);

  // 기존 수입 데이터로 누계 재계산
  await recalculatePledgeFulfillment(id);

  return id;
}

/**
 * 작정 누계 재계산 (수입부 데이터 기준)
 * 가족 단위: representative가 같은 모든 가족 구성원의 헌금을 합산
 */
export async function recalculatePledgeFulfillment(pledgeId: string): Promise<{ fulfilled_amount: number; fulfilled_count: number }> {
  // 1. 작정 정보 조회
  const pledge = await getPledgeById(pledgeId);
  if (!pledge) {
    return { fulfilled_amount: 0, fulfilled_count: 0 };
  }

  // 2. 해당 연도의 수입 기록 조회
  const startDate = `${pledge.year}-01-01`;
  const endDate = `${pledge.year}-12-31`;
  const allIncomeRecords = await getIncomeRecords(startDate, endDate);

  // 3. representative 기준으로 가족 구성원 찾기
  const representative = pledge.representative || pledge.donor_name;

  // 가족 구성원의 donor_name 목록 수집 (수입부에서 같은 representative를 가진 모든 헌금자)
  const familyMemberNames = new Set<string>();
  familyMemberNames.add(representative); // 대표자 포함
  familyMemberNames.add(pledge.donor_name); // 작정자 포함

  // 수입부에서 같은 representative를 가진 모든 헌금자 추가
  allIncomeRecords.forEach(record => {
    if (record.representative === representative) {
      familyMemberNames.add(record.donor_name);
    }
  });

  // 4. 가족 구성원 전체의 해당 코드 수입 필터링
  const matchingRecords = allIncomeRecords.filter(record =>
    familyMemberNames.has(record.donor_name) &&
    record.offering_code === pledge.offering_code
  );

  // 5. 누계 계산
  const fulfilled_amount = matchingRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  const fulfilled_count = matchingRecords.length;

  // 6. 작정 업데이트
  await updatePledge(pledgeId, {
    fulfilled_amount,
    fulfilled_count,
  });

  return { fulfilled_amount, fulfilled_count };
}

/**
 * 모든 작정의 누계 재계산 (성능 최적화 버전)
 * - 수입부 데이터를 1회만 읽음 (기존: 작정 개수만큼 읽음)
 * - 배치로 모든 작정의 누계 계산
 */
export async function recalculateAllPledgesFulfillment(year?: number): Promise<number> {
  const targetYear = year || new Date().getFullYear();
  const pledges = await getPledges({ year: targetYear, status: 'active' });

  if (pledges.length === 0) return 0;

  // 1. 해당 연도의 수입 기록을 1회만 조회
  const startDate = `${targetYear}-01-01`;
  const endDate = `${targetYear}-12-31`;
  const allIncomeRecords = await getIncomeRecords(startDate, endDate);

  let updatedCount = 0;

  // 2. 각 작정에 대해 누계 계산 (추가 API 호출 없이 메모리에서 처리)
  for (const pledge of pledges) {
    // representative 기준으로 가족 구성원 찾기
    const representative = pledge.representative || pledge.donor_name;

    // 가족 구성원의 donor_name 목록 수집
    const familyMemberNames = new Set<string>();
    familyMemberNames.add(representative);
    familyMemberNames.add(pledge.donor_name);

    // 수입부에서 같은 representative를 가진 모든 헌금자 추가
    allIncomeRecords.forEach(record => {
      if (record.representative === representative) {
        familyMemberNames.add(record.donor_name);
      }
    });

    // 가족 구성원 전체의 해당 코드 수입 필터링
    const matchingRecords = allIncomeRecords.filter(record =>
      familyMemberNames.has(record.donor_name) &&
      record.offering_code === pledge.offering_code
    );

    // 누계 계산
    const fulfilled_amount = matchingRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const fulfilled_count = matchingRecords.length;

    // 작정 업데이트
    await updatePledge(pledge.id, {
      fulfilled_amount,
      fulfilled_count,
    });

    if (fulfilled_amount > 0) {
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * 작정헌금 수정
 */
export async function updatePledge(
  id: string,
  updates: Partial<Pledge>
): Promise<void> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.pledges);
  const rowIndex = rows.findIndex(row => row[0] === id);

  if (rowIndex === -1) throw new Error(`Pledge ${id} not found`);

  const headers = rows[0];
  const currentRow = rows[rowIndex];

  // updated_at 자동 갱신
  updates.updated_at = getKSTDateTime();

  const updatedRow = headers.map((header, idx) => {
    if (header in updates) {
      return (updates as Record<string, unknown>)[header];
    }
    return currentRow[idx];
  });

  const lastCol = String.fromCharCode(65 + headers.length - 1);
  await updateSheet(
    FINANCE_CONFIG.sheets.pledges,
    `A${rowIndex + 1}:${lastCol}${rowIndex + 1}`,
    [updatedRow as (string | number | boolean)[]]
  );
}

/**
 * 작정헌금 삭제 (soft delete - status를 cancelled로 변경)
 */
export async function deletePledge(id: string): Promise<void> {
  await updatePledge(id, { status: 'cancelled' as PledgeStatus });
}

/**
 * 작정 실적 업데이트 (수입 입력 시 호출)
 */
export async function updatePledgeFulfillment(
  pledgeId: string,
  incomeId: string,
  amount: number,
  periodNumber?: number
): Promise<void> {
  // 1. 현재 작정 조회
  const pledge = await getPledgeById(pledgeId);
  if (!pledge) throw new Error(`Pledge ${pledgeId} not found`);

  // 2. 이력 추가
  const historyId = generateId('PHI');
  const now = getKSTDateTime();
  const historyRow = [
    historyId,
    pledgeId,
    incomeId,
    amount,
    periodNumber || '',
    now,
  ];
  await appendToSheet(FINANCE_CONFIG.sheets.pledgeHistory, [historyRow]);

  // 3. 실적 업데이트
  const newFulfilledAmount = pledge.fulfilled_amount + amount;
  const newFulfilledCount = pledge.fulfilled_count + 1;

  // 4. 스트릭 계산
  const { newStreak, newMaxStreak } = await calculateStreak(pledge, periodNumber);

  // 5. 작정 업데이트
  await updatePledge(pledgeId, {
    fulfilled_amount: newFulfilledAmount,
    fulfilled_count: newFulfilledCount,
    current_streak: newStreak,
    max_streak: Math.max(pledge.max_streak, newStreak),
    last_fulfilled_date: getKSTDate(),
  });

  // 6. 마일스톤 체크
  await checkAndAwardMilestones(pledge, newFulfilledAmount, newStreak);
}

/**
 * 스트릭 계산
 */
async function calculateStreak(
  pledge: Pledge,
  currentPeriod?: number
): Promise<{ newStreak: number; newMaxStreak: number }> {
  // 이력 조회
  const history = await getPledgeHistory(pledge.id);
  const fulfilledPeriods = new Set(
    history
      .filter(h => h.period_number)
      .map(h => h.period_number as number)
  );

  if (currentPeriod) {
    fulfilledPeriods.add(currentPeriod);
  }

  // 연속 달성 계산 (현재 기간부터 역순)
  let streak = 0;
  const maxPeriod = pledge.pledge_period === 'weekly' ? 52 :
                    pledge.pledge_period === 'monthly' ? 12 : 1;

  for (let p = currentPeriod || maxPeriod; p >= 1; p--) {
    if (fulfilledPeriods.has(p)) {
      streak++;
    } else {
      break;
    }
  }

  return {
    newStreak: streak,
    newMaxStreak: Math.max(pledge.max_streak, streak),
  };
}

/**
 * 작정 이력 조회
 */
export async function getPledgeHistory(pledgeId: string): Promise<PledgeHistory[]> {
  const data = await getSheetData<PledgeHistory>(FINANCE_CONFIG.sheets.pledgeHistory);
  return data.filter(h => h.pledge_id === pledgeId);
}

/**
 * 마일스톤 체크 및 부여
 */
async function checkAndAwardMilestones(
  pledge: Pledge,
  fulfilledAmount: number,
  streak: number
): Promise<void> {
  const percentage = (fulfilledAmount / pledge.yearly_amount) * 100;

  // 달성률 마일스톤
  if (percentage >= 25 && percentage < 50) {
    await awardMilestone(pledge.donor_name, 'progress_25', pledge.offering_type, pledge.year);
  } else if (percentage >= 50 && percentage < 75) {
    await awardMilestone(pledge.donor_name, 'progress_50', pledge.offering_type, pledge.year);
  } else if (percentage >= 75 && percentage < 100) {
    await awardMilestone(pledge.donor_name, 'progress_75', pledge.offering_type, pledge.year);
  } else if (percentage >= 100) {
    await awardMilestone(pledge.donor_name, 'progress_100', pledge.offering_type, pledge.year);
  }

  // 스트릭 마일스톤
  if (streak >= 4) await awardMilestone(pledge.donor_name, 'streak_4', pledge.offering_type, pledge.year);
  if (streak >= 12) await awardMilestone(pledge.donor_name, 'streak_12', pledge.offering_type, pledge.year);
  if (streak >= 24) await awardMilestone(pledge.donor_name, 'streak_24', pledge.offering_type, pledge.year);
  if (streak >= 52) await awardMilestone(pledge.donor_name, 'streak_52', pledge.offering_type, pledge.year);

  // 첫 달성 마일스톤
  if (pledge.fulfilled_count === 0) {
    await awardMilestone(pledge.donor_name, 'first_fulfill', pledge.offering_type, pledge.year);
  }
}

/**
 * 마일스톤 부여 (중복 방지)
 */
async function awardMilestone(
  donorName: string,
  milestoneType: string,
  offeringType?: OfferingType,
  year?: number
): Promise<void> {
  // 기존 마일스톤 확인
  const existing = await getSheetData<PledgeMilestone>(FINANCE_CONFIG.sheets.pledgeMilestones);
  const alreadyHas = existing.some(m =>
    m.donor_name === donorName &&
    m.milestone_type === milestoneType &&
    m.offering_type === offeringType &&
    m.year === year
  );

  if (alreadyHas) return;

  // 새 마일스톤 추가
  const id = generateId('MIL');
  const row = [
    id,
    donorName,
    milestoneType,
    getKSTDateTime(),
    offeringType || '',
    year || '',
  ];
  await appendToSheet(FINANCE_CONFIG.sheets.pledgeMilestones, [row]);
}

/**
 * 헌금자의 마일스톤 조회
 */
export async function getDonorMilestones(donorName: string): Promise<PledgeMilestone[]> {
  const data = await getSheetData<PledgeMilestone>(FINANCE_CONFIG.sheets.pledgeMilestones);
  return data.filter(m => m.donor_name === donorName);
}

/**
 * 교회 전체 작정 통계 조회
 */
export async function getChurchPledgeStats(year: number): Promise<{
  building: { count: number; totalPledged: number; totalFulfilled: number };
  mission: { count: number; totalPledged: number; totalFulfilled: number };
  weekly: { count: number; totalPledged: number; totalFulfilled: number };
}> {
  const pledges = await getPledges({ year, status: 'active' as PledgeStatus });

  const stats = {
    building: { count: 0, totalPledged: 0, totalFulfilled: 0 },
    mission: { count: 0, totalPledged: 0, totalFulfilled: 0 },
    weekly: { count: 0, totalPledged: 0, totalFulfilled: 0 },
  };

  for (const pledge of pledges) {
    const type = pledge.offering_type as keyof typeof stats;
    if (stats[type]) {
      stats[type].count++;
      stats[type].totalPledged += pledge.yearly_amount;
      stats[type].totalFulfilled += pledge.fulfilled_amount;
    }
  }

  return stats;
}

/**
 * 수입 코드로 헌금 종류 판별
 */
export function getOfferingTypeByCode(code: number): OfferingType | null {
  switch (code) {
    case 501: return 'building';
    case 21: return 'mission';
    case 11: return 'weekly';
    default: return null;
  }
}

/**
 * 수입 입력 시 자동 작정 매칭
 */
export async function matchIncomeToPlledge(
  donorName: string,
  incomeId: string,
  incomeCode: number,
  amount: number,
  incomeDate: string
): Promise<{ matched: boolean; pledgeId?: string }> {
  // 1. 헌금 종류 판별
  const offeringType = getOfferingTypeByCode(incomeCode);
  if (!offeringType) {
    return { matched: false };
  }

  // 2. 해당 연도 작정 조회
  const year = parseInt(incomeDate.substring(0, 4));
  const pledge = await getPledgeByDonorAndType(donorName, year, offeringType);
  if (!pledge || pledge.status !== 'active') {
    return { matched: false };
  }

  // 3. 기간 번호 계산
  const periodNumber = calculatePeriodNumber(incomeDate, pledge.pledge_period);

  // 4. 실적 업데이트
  await updatePledgeFulfillment(pledge.id, incomeId, amount, periodNumber);

  return { matched: true, pledgeId: pledge.id };
}

/**
 * 날짜로 기간 번호 계산
 */
function calculatePeriodNumber(dateStr: string, period: PledgePeriod): number {
  const date = new Date(dateStr);

  switch (period) {
    case 'weekly':
      // 해당 연도의 몇 번째 주인지 계산
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      return Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

    case 'monthly':
      return date.getMonth() + 1;

    case 'yearly':
      return 1;

    default:
      return 1;
  }
}

// ============================================
// 카드내역 임시저장 CRUD
// ============================================

const CARD_EXPENSE_TEMP_HEADERS = [
  'tempId',
  'transaction_date',
  'vendor',
  'note',
  'amount',
  'description',
  'account_code',
  'card_number',
  'matching_record_id',
  'matching_record_date',
  'matching_record_amount',
  'created_at',
  'status',
];

/**
 * 카드내역 임시데이터 전체 조회
 */
export async function getCardExpenseTemp(): Promise<CardExpenseTempRecord[]> {
  const rows = await readSheet(FINANCE_CONFIG.sheets.cardExpenseTemp);
  if (rows.length <= 1) return []; // 헤더만 있거나 빈 시트

  return rows.slice(1).map((row) => ({
    tempId: row[0] || '',
    transaction_date: row[1] || '',
    vendor: row[2] || '',
    note: row[3] || '',
    amount: Number(row[4]) || 0,
    description: row[5] || '',
    account_code: row[6] ? Number(row[6]) : null,
    card_number: row[7] || '',
    matching_record_id: row[8] || null,
    matching_record_date: row[9] || null,
    matching_record_amount: row[10] ? Number(row[10]) : null,
    created_at: row[11] || '',
    status: (row[12] as 'pending' | 'applied') || 'pending',
  }));
}

/**
 * 카드내역 임시데이터 저장 (기존 데이터 전체 삭제 후 새로 저장)
 */
export async function saveCardExpenseTemp(records: CardExpenseTempRecord[]): Promise<void> {
  const sheetName = FINANCE_CONFIG.sheets.cardExpenseTemp;

  // 1. 기존 데이터 클리어 (헤더 유지)
  await clearSheetData(sheetName);

  // 2. 새 데이터 추가
  if (records.length > 0) {
    const data = records.map((r) => [
      r.tempId,
      r.transaction_date,
      r.vendor,
      r.note,
      r.amount,
      r.description,
      r.account_code ?? '',
      r.card_number,
      r.matching_record_id ?? '',
      r.matching_record_date ?? '',
      r.matching_record_amount ?? '',
      r.created_at,
      r.status,
    ]);
    await appendToSheet(sheetName, data);
  }
}

/**
 * 카드내역 임시데이터 단건 업데이트 (description, account_code)
 */
export async function updateCardExpenseTempItem(
  tempId: string,
  updates: { description?: string; account_code?: number | null }
): Promise<boolean> {
  const sheetName = FINANCE_CONFIG.sheets.cardExpenseTemp;
  const rows = await readSheet(sheetName);

  if (rows.length <= 1) return false;

  // 헤더 제외하고 해당 tempId 찾기
  const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === tempId);
  if (rowIndex === -1) return false;

  // 업데이트할 필드 (description: 5, account_code: 6)
  const row = rows[rowIndex];
  if (updates.description !== undefined) {
    row[5] = updates.description;
  }
  if (updates.account_code !== undefined) {
    row[6] = updates.account_code !== null ? String(updates.account_code) : '';
  }

  // 해당 행만 업데이트
  await updateSheet(sheetName, `A${rowIndex + 1}:M${rowIndex + 1}`, [row]);
  return true;
}

/**
 * 카드내역 임시데이터 상태 일괄 업데이트
 */
export async function updateCardExpenseTempStatus(
  tempIds: string[],
  status: 'pending' | 'applied'
): Promise<void> {
  const sheetName = FINANCE_CONFIG.sheets.cardExpenseTemp;
  const rows = await readSheet(sheetName);

  if (rows.length <= 1) return;

  const tempIdSet = new Set(tempIds);
  let updated = false;

  for (let i = 1; i < rows.length; i++) {
    if (tempIdSet.has(rows[i][0])) {
      rows[i][12] = status;
      updated = true;
    }
  }

  if (updated) {
    // 전체 데이터 다시 쓰기 (헤더 제외)
    const sheets = getGoogleSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${sheetName}!A2:M${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows.slice(1),
      },
    });
  }
}

/**
 * 카드내역 임시데이터 시트 초기화 (시트 생성 및 헤더 설정)
 */
export async function initCardExpenseTempSheet(): Promise<void> {
  const sheetName = FINANCE_CONFIG.sheets.cardExpenseTemp;
  const sheets = getGoogleSheetsClient();

  // 1. 시트 생성 시도 (없으면 생성)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: sheetName } }
        }]
      }
    });
  } catch {
    // 시트가 이미 존재하면 무시
  }

  // 2. 기존 데이터 클리어
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: FINANCE_CONFIG.spreadsheetId,
      range: `${sheetName}!A:M`,
    });
  } catch {
    // 클리어 실패 무시
  }

  // 3. 헤더 설정
  const lastCol = String.fromCharCode(65 + CARD_EXPENSE_TEMP_HEADERS.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: FINANCE_CONFIG.spreadsheetId,
    range: `${sheetName}!A1:${lastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [CARD_EXPENSE_TEMP_HEADERS] }
  });
}
