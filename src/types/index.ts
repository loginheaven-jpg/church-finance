// ============================================
// 교회재정관리 시스템 TypeScript 타입 정의
// ============================================

// 수입 레코드
export interface IncomeRecord {
  id: string;
  date: string; // 기준일 (해당 주의 일요일)
  source: string; // 헌금함, 계좌이체
  offering_code: number;
  donor_name: string;
  representative: string;
  amount: number;
  note: string;
  input_method: string; // 현금헌금, 은행원장
  created_at: string;
  created_by?: string;
  transaction_date?: string; // 실제 거래일
}

// 지출 레코드
export interface ExpenseRecord {
  id: string;
  date: string; // 기준일 (해당 주의 일요일)
  payment_method: string; // 계좌이체, 법인카드, 현금
  vendor: string;
  description: string;
  amount: number;
  account_code: number;
  category_code: number;
  note: string;
  created_at: string;
  created_by?: string;
  transaction_date?: string; // 실제 거래일
}

// 은행 거래
export interface BankTransaction {
  id: string;
  transaction_date: string; // 실제 거래일
  date: string; // 기준일 (해당 주의 일요일)
  withdrawal: number;
  deposit: number;
  balance: number;
  description: string;
  detail: string;
  branch: string;
  time: string;
  memo: string;
  matched_status: 'pending' | 'matched' | 'suppressed' | 'ignored';
  matched_type?: string;
  matched_ids?: string;
  suppressed: boolean;
  suppressed_reason?: string;
  uploaded_at: string;
}

// 카드 거래
export interface CardTransaction {
  id: string;
  billing_date: string;
  seq: string;
  card_number: string;
  card_owner?: string;
  merchant: string;
  sale_date: string;
  sale_amount: number;
  transaction_amount: number;
  purpose?: string;
  account_code?: number;
  detail_completed: boolean;
  matched_status: 'pending' | 'matched' | 'ignored';
  matched_id?: string;
  uploaded_at: string;
}

// 카드 소유자
export interface CardOwner {
  card_number: string;
  owner_name: string;
  card_type?: string;
  active: boolean;
  note?: string;
  created_at: string;
}

// 카드대금 세부내역 (임시 데이터)
export interface CardExpenseItem {
  tempId: string;
  date: string;           // NH카드대금 행의 기준일
  payment_method: string; // "법인카드"
  vendor: string;         // 카드소유자명
  amount: number;         // 거래금액
  note: string;           // 이용가맹점
  transaction_date: string; // 매출일
  description: string;    // 내역 (자동/수동)
  account_code: number | null; // 계정코드 (자동/수동)
  card_number: string;    // 원본 카드번호
}

// 카드대금 파싱 응답
export interface CardExpenseParseResponse {
  success: boolean;
  transactions: CardExpenseItem[];
  matchingRecord: {
    id: string;
    date: string;
    amount: number;
  } | null;
  totalAmount: number;
  warning?: string;
  error?: string;
}

// 매칭 규칙
export interface MatchingRule {
  id: string;
  rule_type: 'bank_income' | 'bank_expense' | 'card_expense';
  pattern: string;
  target_type: 'income' | 'expense' | 'expense_batch';
  target_code: number;
  target_name: string;
  confidence: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// 예산
export interface Budget {
  year: number;
  category_code: number;
  category_item: string;
  account_code: number;
  account_item: string;
  budgeted_amount: number;
  note?: string;
}

// 이월잔액
export interface CarryoverBalance {
  year: number;           // 기준 연도 (2024 = 2024년 말 → 2025년으로 이월)
  balance: number;        // 이월잔액
  construction_balance?: number;  // 건축회계 이월잔액 (분리 관리)
  note?: string;          // 비고
  updated_at: string;     // 수정일시
  updated_by?: string;    // 수정자
}

// 작정헌금 (Pledge Donation)
export type PledgeType = '건축헌금' | '선교헌금';

export interface PledgeDonation {
  id: string;
  year: number;           // 작정 연도
  type: PledgeType;       // 헌금 종류
  donor_name: string;     // 작정자명
  representative: string; // 대표자명
  pledged_amount: number; // 작정 금액
  fulfilled_amount: number; // 실행 금액 (자동 계산)
  note?: string;
  created_at: string;
  updated_at: string;
}

// 수입부 코드
export interface IncomeCode {
  category_code: number;
  category_item: string;
  code: number;
  item: string;
  active: boolean;
  sort_order?: number;
}

// 지출부 코드
export interface ExpenseCode {
  category_code: number;
  category_item: string;
  code: number;
  item: string;
  active: boolean;
  sort_order?: number;
}

// 헌금자 정보
export interface DonorInfo {
  representative: string;
  donor_name: string;
  relationship?: string;
  registration_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  note?: string;
  created_at: string;
}

// 기부금영수증 데이터
export interface DonationReceipt {
  year: number;
  representative: string;
  donors: Array<{
    donor_name: string;
    relationship: string;
    registration_number: string;
  }>;
  address: string;
  resident_id?: string;  // 주민번호 앞 7자리 (교적부에서 조회)
  total_amount: number;
  donations: Array<{
    date: string;
    offering_type: string;
    amount: number;
  }>;
  issue_number?: string;  // 발급번호 (2026001~)
}

// 사업자(법인) 기부금영수증 데이터
export interface BusinessDonationReceipt {
  year: number;
  company_name: string;       // 상호
  business_number: string;    // 사업자등록번호
  address: string;            // 주소
  total_amount: number;       // 금액
  issue_number: string;       // 발급번호
}

// 수작업 발급 이력
export interface ManualReceiptHistory {
  issue_number: string;      // 발급번호 (예: 2026016, 2026001-2)
  year: number;              // 기부 연도
  representative: string;    // 대표자명
  address: string;           // 주소
  resident_id: string;       // 주민번호 앞 7자리
  amount: number;            // 금액
  issued_at: string;         // 발급일시
  original_issue_number: string;  // 원본 발급번호 (분할 시)
  note: string;              // 비고 (수작업/분할)
}

// 현금헌금 (외부 시트)
export interface CashOffering {
  date: string;
  source: string;
  donor_name: string;
  amount: number;
  code: number;
  item: string;
  category_code: number;
  note: string;
}

// ============================================
// API Response 타입
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SyncResult {
  processed: number;
  totalAmount: number;
  suppressedBankTransactions: number;
  warnings: string[];
}

export interface UploadResult {
  uploaded: number;
  message: string;
}

export interface AutoMatchResult {
  autoMatched: Array<{
    transaction: BankTransaction;
    match: MatchingRule | null;  // null: 기본 분류 사용
    record: IncomeRecord | ExpenseRecord;
  }>;
  suppressed: BankTransaction[];
  needsReview: Array<{
    transaction: BankTransaction;
    suggestions: MatchingRule[];
  }>;
}

export interface UnmatchedResult {
  bank: BankTransaction[];
  card: CardTransaction[];
  total: number;
}

// ============================================
// 보고서 타입
// ============================================

export interface WeeklyReport {
  // 기본 정보
  year: number;
  weekNumber: number;
  sundayDate: string;  // 주일 날짜 (YYYY-MM-DD)
  reportId: string;    // 보고서 ID (YYYYMMDD 형식)
  dateRange: {
    start: string;
    end: string;
  };

  // 잔고
  previousBalance: number;  // 전주최종잔고
  currentBalance: number;   // 현재잔고

  // 일반 수입
  income: {
    total: number;          // 주간헌금수입총계
    subtotal: number;       // 수입소계 (건축 제외)
    byCategory: Array<{
      categoryCode: number;
      categoryName: string;
      amount: number;
    }>;
    byCode: Array<{
      code: number;
      name: string;
      categoryCode: number;
      amount: number;
    }>;
  };

  // 일반 지출
  expense: {
    total: number;          // 주간지출총계
    subtotal: number;       // 지출소계 (건축 제외)
    byCategory: Array<{
      categoryCode: number;
      categoryName: string;
      amount: number;
    }>;
    byCode: Array<{
      code: number;
      name: string;
      categoryCode: number;
      amount: number;
    }>;
  };

  // 건축회계 (분리)
  construction: {
    income: number;         // 건축헌금소계
    expense: number;        // 건축비지출소계
  };

  // 수지차액
  balance: number;
}

export interface MonthlyReport {
  year: number;
  months: Array<{
    month: number;
    income: number;
    expense: number;
    balance: number;
  }>;
}

export interface BudgetReport {
  year: number;
  categories: Array<{
    category_code: number;
    category_item: string;
    accounts: Array<{
      account_code: number;
      account_item: string;
      budgeted: number;
      executed: number;
      percentage: number;
      remaining: number;
    }>;
  }>;
}

// ============================================
// 폼 타입
// ============================================

export interface IncomeClassification {
  type: 'income';
  date: string;
  source: string;
  offering_code: number;
  donor_name: string;
  representative: string;
  amount: number;
  note?: string;
}

export interface ExpenseClassification {
  type: 'expense';
  date: string;
  payment_method: string;
  vendor: string;
  description: string;
  amount: number;
  account_code: number;
  category_code: number;
  note?: string;
}

export type Classification = IncomeClassification | ExpenseClassification;

export interface CardDetails {
  purpose: string;
  account_code: number;
}

// ============================================
// 유틸리티 타입
// ============================================

export type DateRange = {
  start: string;
  end: string;
};

export type MatchStatus = 'pending' | 'matched' | 'suppressed' | 'ignored';

export type TransactionType = 'income' | 'expense';
