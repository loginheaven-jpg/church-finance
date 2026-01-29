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
export const CACHE_TTL = {
  DASHBOARD: 300,      // 대시보드: 5분
  REPORTS: 600,        // 보고서: 10분
  DONORS: 300,         // 헌금자 목록: 5분
  CODES: 3600,         // 코드 데이터: 1시간
  BUDGET: 600,         // 예산 데이터: 10분
} as const;

// 캐시 키 생성 헬퍼
export const cacheKeys = {
  dashboard: (year: number, weekOffset: number) =>
    `finance:dashboard:v2:${year}:${weekOffset}`,
  weeklyReport: (year: number, weekNo: number) =>
    `finance:report:weekly:${year}:${weekNo}`,
  monthlyReport: (year: number) =>
    `finance:report:monthly:${year}`,
  budgetReport: (year: number) =>
    `finance:report:budget:${year}`,
  comparisonReport: (year: number) =>
    `finance:report:comparison:${year}`,
  incomeAnalysis: (year: number) =>
    `finance:report:income:${year}`,
  expenseAnalysis: (year: number) =>
    `finance:report:expense:${year}`,
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
      console.log(`[Cache HIT] ${key}`);
      return cached;
    }

    console.log(`[Cache MISS] ${key}`);
  } catch (error) {
    // Redis 연결 실패 시 로그만 남기고 계속 진행
    console.error('[Redis Error]', error);
  }

  // DB에서 데이터 조회
  const data = await fetcher();

  // 캐시 저장 (백그라운드)
  try {
    await redis.set(key, data, { ex: ttl });
    console.log(`[Cache SET] ${key} (TTL: ${ttl}s)`);
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
      console.log(`[Cache INVALIDATED] ${pattern} (${keys.length} keys)`);
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
    console.log(`[Cache DELETED] ${key}`);
  } catch (error) {
    console.error('[Redis DELETE Error]', error);
  }
}

// 여러 키 삭제
export async function deleteCacheMultiple(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
    console.log(`[Cache DELETED] ${keys.length} keys`);
  } catch (error) {
    console.error('[Redis DELETE Error]', error);
  }
}

// 특정 연도 관련 캐시 모두 무효화 (데이터 입력/수정 시)
export async function invalidateYearCache(year: number): Promise<void> {
  await invalidateCache(`finance:*:${year}*`);
  await invalidateCache('finance:building'); // 건축헌금 캐시도 무효화
}
