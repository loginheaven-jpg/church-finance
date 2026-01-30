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

// 메뉴별 최소 필요 역할
export const MENU_MIN_ROLE: Record<string, FinanceRole> = {
  // MAIN - 모든 사용자
  '/dashboard': 'member',
  '/building': 'member',
  '/my-offering': 'member',

  // REPORTS
  '/reports': 'member',
  '/reports/weekly': 'member',
  '/reports/monthly': 'member',
  '/reports/comparison': 'member',
  '/reports/budget': 'deacon',           // deacon 이상
  '/reports/income-analysis': 'deacon',  // deacon 이상
  '/reports/expense-analysis': 'deacon', // deacon 이상
  '/reports/custom': 'super_admin',      // super_admin만

  // MANAGEMENTS - admin 이상 (카드내역 입력은 member도 가능)
  '/expense-claim': 'admin',
  '/data-entry': 'admin',
  '/match': 'admin',
  '/card-expense-integration': 'member', // 카드내역 입력은 member도 가능
  '/card': 'admin',
  '/donors': 'admin',
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

  // 정의되지 않은 경로는 기본적으로 허용 (로그인된 사용자에게)
  return true;
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

// 세션 쿠키 이름
export const SESSION_COOKIE_NAME = 'finance-session';

// 세션 만료 시간 (7일)
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

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
 * cookies() 함수를 사용하여 세션 쿠키를 파싱
 */
export async function getServerSession(): Promise<FinanceSession | null> {
  try {
    // Next.js의 cookies() 함수를 동적으로 import
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      return null;
    }

    return JSON.parse(sessionCookie.value) as FinanceSession;
  } catch {
    return null;
  }
}
