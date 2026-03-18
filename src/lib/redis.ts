import { Redis } from '@upstash/redis';

// Upstash Redis 클라이언트 (싱글톤)
// 환경변수가 없으면 null
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// 캐시 TTL 설정 (초 단위)
// 수동 새로고침으로 캐시 무효화 가능하므로 3일로 설정
export const CACHE_TTL = {
  DASHBOARD: 259200,   // 대시보드: 3일
  REPORTS: 259200,     // 보고서: 3일
  DONORS: 259200,      // 헌금자 목록: 3일
  CODES: 604800,       // 코드 데이터: 7일 (거의 변경 안됨)
  BUDGET: 259200,      // 예산 데이터: 3일
  MY_OFFERING: 3600,   // 개인헌금: 1시간 (개인별 조회, 자주 변경 안됨)
} as const;

// 캐시 버전: 데이터 읽기 로직 변경 시 버전을 올려서 stale 캐시 자동 무효화
// v2 → v3: 날짜 정규화(normalizeDateString) 추가 반영
const CACHE_VERSION = 'v3';

// 캐시 키 생성 헬퍼
export const cacheKeys = {
  dashboard: (year: number, weekOffset: number) =>
    `finance:dashboard:${CACHE_VERSION}:${year}:${weekOffset}`,
  donors: (year: number) =>
    `finance:donors:${year}`,
  incomeCodes: () =>
    `finance:codes:income`,
  expenseCodes: () =>
    `finance:codes:expense`,
  budget: (year: number) =>
    `finance:budget:${year}`,
  building: () =>
    `finance:building`,
  // 개인헌금 캐시 (사용자별, 연도별, 모드별)
  myOffering: (userName: string, year: number, mode: string, includeHistory: boolean) =>
    `finance:my-offering:${encodeURIComponent(userName)}:${year}:${mode}:${includeHistory}`,
  // 보고서 캐시
  weeklyReport: (year: number, startDate: string) =>
    `finance:report:weekly:${year}:${startDate}`,
  monthlyReport: (year: number) =>
    `finance:report:monthly:${year}`,
  budgetReport: (year: number, endDate: string, excludeConstruction: boolean) =>
    `finance:report:budget:${year}:${endDate}:${excludeConstruction}`,
  comparisonReport: (endYear: number) =>
    `finance:report:comparison:${endYear}`,
  incomeAnalysis: (year: number) =>
    `finance:report:income-analysis:${CACHE_VERSION}:${year}`,
  expenseAnalysis: (year: number) =>
    `finance:report:expense-analysis:${CACHE_VERSION}:${year}`,
  donorAnalysis: (year: number, minMonthlyAvg: number = 0) =>
    `finance:report:donor-analysis:${CACHE_VERSION}:${year}:${minMonthlyAvg}`,
};

// 캐시 조회 with 폴백
export async function getWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.DASHBOARD
): Promise<T> {
  // Redis가 설정되지 않았으면 바로 fetcher 실행
  if (!redis) {
    return fetcher();
  }

  try {
    // 캐시 조회 시도
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    // Redis 연결 실패 시 로그만 남기고 계속 진행
    console.error('[Redis Error]', error);
  }

  // DB에서 데이터 조회
  const data = await fetcher();

  // 캐시 저장 (백그라운드)
  try {
    await redis.set(key, data, { ex: ttl });
  } catch (error) {
    console.error('[Redis SET Error]', error);
  }

  return data;
}

// 캐시 삭제 (데이터 변경 시 호출)
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    // 패턴에 맞는 키 검색 및 삭제
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('[Redis INVALIDATE Error]', error);
  }
}

// 특정 키 삭제
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('[Redis DELETE Error]', error);
  }
}

// 여러 키 삭제
export async function deleteCacheMultiple(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    console.error('[Redis DELETE Error]', error);
  }
}

// 특정 연도 관련 캐시 모두 무효화 (데이터 입력/수정 시)
export async function invalidateYearCache(year: number): Promise<void> {
  await invalidateCache(`finance:*:${year}*`);
  await invalidateCache('finance:building'); // 건축헌금 캐시도 무효화
}
