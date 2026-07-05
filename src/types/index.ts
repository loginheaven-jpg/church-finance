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
  transaction_date: string; // 실제 거래일 (YYYY-MM-DD)
  /**
   * 기준일 (해당 주의 일요일, YYYY-MM-DD).
   * INVARIANT: date === getWeekEndingSunday(transaction_date).
   * 서버가 addBankTransactions / updateBankTransaction 에서 자동 계산·강제한다.
   * 클라이언트/스크립트에서 임의 값 지정 금지.
   */
  date: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  description: string;
  detail: string;
  branch: string;
  time: string;
  memo: string;
  matched_status: 'pending' | 'matched' | 'suppressed';
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

// 카드내역 임시저장 (서버 측)
export interface CardExpenseTempRecord {
  tempId: string;
  transaction_date: string;  // 매출일
  vendor: string;            // 카드보유자명
  note: string;              // 가맹점명
  amount: number;
  description: string;       // 내역 (입력값)
  account_code: number | null;
  card_number: string;       // 카드번호
  matching_record_id: string | null;   // NH카드대금 매칭 행 ID
  matching_record_date: string | null; // NH카드대금 기준일
  matching_record_amount: number | null;
  created_at: string;
  status: 'pending' | 'applied';
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
  // 금액 조건 (선택). 같은 vendor를 금액으로 분기할 때 사용.
  // 예: 한국전력 + amount_min=500000 → 62번 교회 전기 / amount_max=499999 → 61번 사택 전기
  // 둘 다 비어있으면 금액 무관 (기존 동작과 동일)
  amount_min?: number;
  amount_max?: number;
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

// 작정헌금 (Pledge Donation) - 기존 호환용
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

// ============================================
// 새 작정헌금 시스템 (v2)
// ============================================

// 헌금 종류 (수입코드 연동)
export type OfferingType = 'building' | 'mission' | 'weekly';

// 작정 주기
export type PledgePeriod = 'weekly' | 'monthly' | 'yearly';

// 작정 상태
export type PledgeStatus = 'active' | 'completed' | 'cancelled';

// 헌금 종류 ↔ 수입코드 매핑
export const OFFERING_CODE_MAP: Record<OfferingType, number> = {
  building: 501,  // 성전봉헌헌금
  mission: 21,    // 선교헌금
  weekly: 11,     // 주일헌금
};

// 헌금 종류 한글 라벨
export const OFFERING_TYPE_LABELS: Record<OfferingType, string> = {
  building: '성전봉헌헌금',
  mission: '선교헌금',
  weekly: '주정헌금',
};

// 작정 주기 한글 라벨
export const PLEDGE_PERIOD_LABELS: Record<PledgePeriod, string> = {
  weekly: '주정',
  monthly: '월정',
  yearly: '연간',
};

// 새 작정헌금 인터페이스 (v2)
export interface Pledge {
  id: string;
  donor_id?: string;        // 헌금자 ID (선택)
  donor_name: string;       // 작정자명
  representative?: string;  // 대표자명

  // 헌금 종류
  offering_type: OfferingType;
  offering_code: number;    // 501, 21, 11

  // 작정 정보
  pledge_period: PledgePeriod;
  amount: number;           // 주기당 금액
  yearly_amount: number;    // 연간 환산 금액

  // 기간
  year: number;
  start_month: number;
  end_month: number;

  // 실적
  fulfilled_amount: number;
  fulfilled_count: number;

  // 스트릭 시스템
  current_streak: number;
  max_streak: number;
  last_fulfilled_date?: string;

  // 메타
  memo?: string;
  status: PledgeStatus;
  created_at: string;
  updated_at: string;
}

// 작정헌금 이력
export interface PledgeHistory {
  id: string;
  pledge_id: string;
  income_id: string;
  amount: number;
  period_number?: number;  // 해당 주차/월 번호
  matched_at: string;
}

// 마일스톤 종류
export type MilestoneType =
  | 'first_pledge'    // 첫 작정
  | 'first_fulfill'   // 첫 달성
  | 'progress_25'     // 25% 달성
  | 'progress_50'     // 50% 달성
  | 'progress_75'     // 75% 달성
  | 'progress_100'    // 100% 달성
  | 'streak_4'        // 4주/월 연속
  | 'streak_12'       // 12주/월 연속
  | 'streak_24'       // 24주/월 연속
  | 'streak_52'       // 52주 연속
  | 'building_1y'     // 성전봉헌 1년
  | 'building_3y'     // 성전봉헌 3년
  | 'mission_1y'      // 선교 1년
  | 'all_types';      // 3종류 모두

// 마일스톤
export interface PledgeMilestone {
  id: string;
  donor_name: string;
  milestone_type: MilestoneType;
  achieved_at: string;
  offering_type?: OfferingType;
  year?: number;
}

// 마일스톤 정보
export const MILESTONE_INFO: Record<MilestoneType, { emoji: string; message: string }> = {
  first_pledge: { emoji: '🌱', message: '작정의 첫 걸음을 내딛으셨습니다!' },
  first_fulfill: { emoji: '✨', message: '첫 번째 약속을 지키셨습니다!' },
  progress_25: { emoji: '🌱', message: '벌써 4분의 1을 달성하셨네요!' },
  progress_50: { emoji: '🌿', message: '절반을 넘으셨습니다! 함께해요!' },
  progress_75: { emoji: '🌳', message: '목표가 눈앞에 보입니다!' },
  progress_100: { emoji: '🎉', message: '올해 작정을 완수하셨습니다!' },
  streak_4: { emoji: '🔥', message: '한 달간 꾸준히 함께하셨습니다!' },
  streak_12: { emoji: '💪', message: '분기 내내 함께하셨습니다!' },
  streak_24: { emoji: '⭐', message: '반년을 함께 하셨습니다!' },
  streak_52: { emoji: '🏆', message: '1년간 매주 함께하셨습니다!' },
  building_1y: { emoji: '🏛️', message: '성전 건축의 동역자입니다' },
  building_3y: { emoji: '🏰', message: '성전을 함께 세워가고 있습니다' },
  mission_1y: { emoji: '🌍', message: '선교의 동역자입니다' },
  all_types: { emoji: '💎', message: '온전한 헌신을 하고 계십니다' },
};

// API 응답용 작정 요약
export interface PledgeSummary {
  offering_type: OfferingType;
  pledge_period: PledgePeriod;
  amount: number;
  yearly_amount: number;
  fulfilled_amount: number;
  fulfilled_percentage: number;
  current_streak: number;
  max_streak: number;
  status: PledgeStatus;
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

// 현금헌금 (헌금함입력 시트, 과거: 외부 시트)
export interface CashOffering {
  rowIndex?: number; // 헌금함입력 시트 행 번호 (sync 후 status 업데이트용)
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
