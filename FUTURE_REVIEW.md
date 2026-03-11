# 향후 검토 사항

> 2026-03-11 코드 점검 시 발견된 항목 중, side effect 위험으로 즉시 수정하지 않은 항목입니다.
> 각 항목을 개별적으로 재검토하고, 충분한 테스트 후 신중히 진행해야 합니다.

---

## 1. API 인증 추가 (보안)

### 1-1. 인증 추가 가능한 라우트 (side effect 없음 확인 완료)

아래 라우트들은 호출하는 페이지가 모두 로그인 필수 페이지이므로, 인증 추가가 안전합니다.

| 라우트 | 권장 최소 권한 | 호출 페이지 |
|--------|--------------|------------|
| `/api/codes/income` | member | card-details, reports, FinanceCodeFab 등 |
| `/api/codes/expense` | member | card-details, reports, FinanceCodeFab 등 |
| `/api/card/my-transactions` | member | card-details |
| `/api/card/submit-details` | member | card-details |
| `/api/reports/weekly` | deacon | reports/weekly |
| `/api/reports/budget` | member | reports/budget |
| `/api/cache/invalidate` | member | card-details (새로고침 버튼) |

### 1-2. 인증 추가 금지 라우트

| 라우트 | 이유 |
|--------|------|
| `/api/donors/public` | 로그인 페이지에서 작정헌금/연말정산 입력 시 비로그인 상태로 호출 |
| `/api/donors/lookup` | TaxInfoEntryModal에서 비로그인 상태로 호출 |

---

## 2. 사이드바 메뉴 추가 검토

현재 페이지는 존재하지만 사이드바에 표시되지 않는 메뉴 5개:

| 페이지 | 현재 접근 방법 | 사이드바 추가 시 고려 |
|--------|--------------|---------------------|
| `/reports/donor-analysis` | income-analysis에서 내부 데이터 로드 | 독립 메뉴로 분리할지 검토 |
| `/card-details` | match 페이지 내 링크 | 이미 링크로 접근 가능, 중복 경로 발생 |
| `/settings/matching-rules` | 직접 URL 접근 | admin 전용, 메뉴 추가 시 사이드바 길이 증가 |
| `/settings/codes` | 직접 URL 접근 | admin 전용 |
| `/settings/budget` | 직접 URL 접근 | admin 전용 |

**판단**: 사용자 의도 확인 필요 (의도적 숨김인지, 누락인지)

---

## 3. 중복 유틸 함수 리팩토링

### 3-1. 파일 간 중복 함수

| 함수 | 중복 위치 | 위험 요소 |
|------|----------|----------|
| `parseDate()` | upload/bank, card-expense/parse 등 8+ 파일 | 각 파일의 parseDate가 미세하게 다를 수 있음 (엣지 케이스 처리 차이) |
| `parseAmount()` | google-sheets.ts 내 776행(로컬) vs 1788행(글로벌) | 로컬 버전과 글로벌 버전의 로직 차이 정밀 비교 필요 |
| `findColumnIndex()` | upload/bank, card-expense/parse | 동일 로직으로 보이나 통합 전 정밀 비교 필요 |
| `isLeapYear()` | reports/budget, reports/weekly | 동일 로직 |

**권장 접근**:
1. 각 중복 함수의 미세 차이를 먼저 diff로 정밀 비교
2. 공통 유틸 파일(`lib/date-utils.ts`, `lib/excel-utils.ts`) 생성
3. 한 파일씩 교체 후 해당 기능 테스트

### 3-2. 엑셀 생성 로직 중복

| 파일 | 중복 내용 |
|------|----------|
| `bank-annual-excel.ts` | 숫자 포맷, 컬럼 너비, 셀 스타일 |
| `bank-budget-excel.ts` | 동일 패턴 90% 반복 |
| `bank-combined-excel.ts` | 15행 래퍼, 위 두 파일에 의존 |

**권장**: 공통 포맷팅 헬퍼 추출 후 점진적 교체

### 3-3. google-sheets.ts 내부 중복

| 중복 대상 | 위치 | 설명 |
|----------|------|------|
| 시트 행 삭제 로직 | 644-650행 vs 835-841행 | deleteIncome/deleteExpense에서 동일 패턴 |
| 날짜 정규화 | normalizeDateString(297행) vs normalizeDate(1796행) | 역할 구분 정리 필요 |

---

## 4. 상태 관리 통일 (React Query)

현재 Dashboard만 React Query(`useQuery`) 사용, 나머지 15+ 페이지는 직접 `useState` + `fetch` 패턴.

**위험 요소**:
- 대규모 리팩토링 (15+ 페이지 변경)
- 캐싱/리렌더링 동작 변경
- 에러 핸들링 흐름 변경

**권장**: 신규 페이지부터 React Query 적용, 기존 페이지는 필요 시 점진적 전환

---

## 5. 인라인 타입 중앙화

페이지 내 인라인 정의된 타입들을 `src/types/index.ts`로 이동 검토:

| 타입 | 현재 위치 | 비고 |
|------|----------|------|
| `DashboardStats`, `CategoryDetail` 등 | dashboard/page.tsx 20-74행 | |
| `UnmatchedData` | match/page.tsx 20-24행 | |
| `ExpenseClaimData` | expense-claim/page.tsx 20-31행 | |

**위험**: 낮음 (import 경로만 변경). 급하지 않음.

---

## 6. Redis 캐시 전략 검토

### 6-1. queries.ts와 redis.ts 캐시 키 시그니처 불일치

| 키 | redis.ts | queries.ts |
|----|----------|------------|
| weeklyReport | 삭제됨 (미사용) | `(week: string)` |

**확인 필요**: queries.ts의 weeklyReport 키가 React Query에서 사용되는지 점검 후 정리

### 6-2. TTL 검토

| 키 | 현재 TTL | 검토 사항 |
|----|---------|----------|
| REPORTS | 259200 (3일) | 재정 데이터 변경 빈도 대비 너무 길 수 있음 |
| CODES | 604800 (7일) | 적절 (거의 변경 안됨) |

---

## 7. scripts/ 디렉토리 정리

14개 스크립트 중 일회성 마이그레이션/분석용 파일 다수. 문서화하거나 `scripts/archive/`로 이동 검토:

| 파일 | 용도 | 상태 |
|------|------|------|
| `analyze-building-sheet.js` | 건축 시트 분석 | 일회성 |
| `analyze-legacy-data.js` | 레거시 데이터 분석 | 일회성 |
| `analyze-source.ts` | 소스 분석 | 일회성 |
| `check-duplicates.ts` | 중복 검사 | 유지보수용? |
| `deduplicate-income.ts` | 수입 중복 제거 | 일회성 |
| `deduplicate-legacy.ts` | 레거시 중복 제거 | 일회성 |
| `matching-rules-data.json` | 매칭 규칙 데이터 | 용도 불명 |

---

## 8. 입력값 검증 강화

현재 여러 API에서 입력값 범위 검증 부재:

| 라우트 | 파라미터 | 미검증 항목 |
|--------|---------|------------|
| `/api/dashboard/stats` | weekOffset | 범위 제한 없음 (음수 무제한) |
| `/api/reports/budget` | year | 범위 제한 없음 |
| `/api/income/records` | minAmount/maxAmount | 음수 검증 없음 |
| `/api/upload/bank` | 파일 | 크기 제한 없음 |
| `/api/card-expense/parse` | 파일 | 크기 제한 없음 |

---

## 9. google-sheets.ts 미사용 함수

Phase 2 예산 기능용으로 보이나 현재 호출처 없음:
- `addBudget()`
- `updateBudget()`
- `deleteBudget()`

**판단**: Phase 2 착수 전까지 유지하되, 착수 시점에 API 설계와 함께 재검토
