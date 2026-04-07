/**
 * 재정시스템 권한 관리
 *
 * 역할:
 * - super_admin: 모든 메뉴 접근 + 사용자 관리
 * - admin: ADMIN 메뉴 제외 모든 기능
 * - deacon (제직): MAIN + REPORTS 메뉴만
 * - member: MAIN + REPORTS 메뉴, 세부내용 보기 제한
 */

export type FinanceRole = 'super_admin' | 'admin' | 'deacon' | 'member';

export interface FinanceSession {
  user_id: string;
  name: string;
  email: string;
  member_id: string | null;
  finance_role: FinanceRole;
}

// 역할 우선순위 (높을수록 권한 높음)
export const ROLE_PRIORITY: Record<FinanceRole, number> = {
  'super_admin': 4,
  'admin': 3,
  'deacon': 2,
  'member': 1,
};

// 역할 한글명
export const ROLE_LABELS: Record<FinanceRole, string> = {
  'super_admin': '수퍼어드민',
  'admin': '관리자',
  'deacon': '제직',
  'member': '회원',
};

// 메뉴별 최소 필요 역할 (화이트리스트 기반 - 여기 없는 경로는 기본 차단)
export const MENU_MIN_ROLE: Record<string, FinanceRole> = {
  // ROOT - 대시보드로 리다이렉트
  '/': 'member',

  // MAIN - 모든 사용자
  '/dashboard': 'member',
  '/building': 'member',
  '/my-offering': 'member',

  // REPORTS
  '/reports': 'member',
  '/reports/weekly': 'deacon',            // deacon 이상
  '/reports/monthly': 'deacon',           // deacon 이상
  '/reports/comparison': 'deacon',        // deacon 이상
  '/reports/budget': 'member',            // 모든 사용자
  '/reports/income-analysis': 'deacon',  // deacon 이상
  '/reports/expense-analysis': 'deacon', // deacon 이상
  '/reports/donor-analysis': 'admin',    // admin 이상 (상세 헌금자 분석)
  '/reports/custom': 'super_admin',      // super_admin만

  // MANAGEMENTS - admin 이상 (카드내역 입력은 member도 가능)
  '/expense-claim': 'member',            // 처리내역 점검은 member도 가능 (지출청구 탭은 admin만 표시)
  '/data-entry': 'admin',
  '/match': 'admin',
  '/card-expense-integration': 'member', // 카드내역 입력은 member도 가능
  '/card-details': 'member',             // 카드 상세 입력 (카드내역 입력 흐름)
  '/card': 'admin',
  '/donors': 'admin',
  '/donors/receipts': 'member',           // member도 본인 가족 영수증 발급 가능 (내부에서 필터)
  '/donors/receipts/print': 'member',     // 출력 페이지도 member 허용
  '/settings': 'admin',

  // ADMIN - super_admin만
  '/admin': 'super_admin',
};

/**
 * 사용자가 특정 역할 이상의 권한을 가지는지 확인
 */
export function hasRole(userRole: FinanceRole, requiredRole: FinanceRole): boolean {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[requiredRole];
}

/**
 * 사용자가 특정 경로에 접근 가능한지 확인
 * (화이트리스트 기반: MENU_MIN_ROLE에 정의되지 않은 경로는 기본 차단)
 */
export function canAccessPath(path: string, userRole: FinanceRole): boolean {
  // 정확한 경로 매칭 먼저 시도
  if (MENU_MIN_ROLE[path]) {
    return hasRole(userRole, MENU_MIN_ROLE[path]);
  }

  // 상위 경로로 매칭 시도
  const segments = path.split('/').filter(Boolean);
  while (segments.length > 0) {
    const partialPath = '/' + segments.join('/');
    if (MENU_MIN_ROLE[partialPath]) {
      return hasRole(userRole, MENU_MIN_ROLE[partialPath]);
    }
    segments.pop();
  }

  // 정의되지 않은 경로는 기본적으로 차단 (화이트리스트 기반 보안)
  return false;
}

/**
 * member 역할은 세부내용을 볼 수 없음
 */
export function canViewDetails(userRole: FinanceRole): boolean {
  return userRole !== 'member';
}

/**
 * 데이터 수정 권한 (admin 이상)
 */
export function canModifyData(userRole: FinanceRole): boolean {
  return hasRole(userRole, 'admin');
}

/**
 * 사용자 관리 권한 (super_admin만)
 */
export function canManageUsers(userRole: FinanceRole): boolean {
  return userRole === 'super_admin';
}

/**
 * 카드소유자 이름 매칭 (완전 일치)
 * 세션의 사용자 이름과 카드소유자 이름이 일치하는지 확인
 */
export function isCardOwnerMatch(sessionName: string, cardOwner: string | undefined): boolean {
  if (!cardOwner || !sessionName) return false;
  return sessionName.trim() === cardOwner.trim();
}

/**
 * 서버 API Route에서 세션 가져오기
 * iron-session을 사용하여 암호화된 세션 쿠키를 복호화
 */
export { getFinanceSession as getServerSession } from './finance-session';
