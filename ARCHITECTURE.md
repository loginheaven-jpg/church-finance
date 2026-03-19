# 예봄교회 재정시스템 아키텍처

## 시스템 개요

Next.js 기반 교회 재정 관리 시스템으로, Google Sheets를 데이터베이스로 활용합니다.

### 프로덕션 URL

- **재정부**: https://finance.yebom.org
- **교적부 (연동)**: https://saint.yebom.org

### SSO 연동

교적부(saint-record-v2)와 SSO(Single Sign-On) 연동되어 있습니다.
- 교적부에서 로그인하면 재정부에 자동 로그인됩니다
- `saint_record_session` 쿠키를 감지하여 자동 세션 생성
- 쿠키 도메인: `.yebom.org` (서브도메인 간 공유)
- 교적부 `users.finance_role` 필드로 재정부 권한 관리
- iron-session 라이브러리로 쿠키 암호화/복호화

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| 데이터 저장 | Google Sheets API, Supabase (교적부 연동) |
| 인증 | iron-session (SSO), Session 기반 (쿠키), bcryptjs |
| 차트 | Recharts |
| 상태관리 | React Query (TanStack Query) |
| PDF | jspdf + jspdf-autotable, @react-pdf/renderer |
| 엑셀 | xlsx |
| 캐싱 | Upstash Redis |
| 날짜 | date-fns, react-day-picker |
| 알림 | Sonner (Toast UI) |

## 폴더 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── api/               # API Route Handlers (62+ 라우트)
│   ├── dashboard/         # 대시보드
│   ├── reports/           # 보고서 (weekly, monthly, budget 등)
│   ├── settings/          # 설정 페이지 (pledge, carryover, codes, matching-rules, budget)
│   ├── admin/             # 관리자 페이지 (annual-closing, users)
│   ├── building/          # 성전 봉헌
│   ├── my-offering/       # 내 헌금
│   ├── data-entry/        # 수입/지출 입력
│   ├── match/             # 거래 매칭
│   ├── expense-claim/     # 지출청구 (탭: 청구 입력, 청구 현황)
│   ├── card-expense-integration/  # 카드내역 입력
│   ├── card-details/      # 카드 상세 입력
│   ├── donors/            # 헌금자 관리 (receipts 포함)
│   ├── login/             # 로그인
│   └── register/          # 회원가입
├── components/            # 재사용 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── layout/           # 레이아웃 (Sidebar, MainLayout)
│   ├── dashboard/        # 대시보드 위젯
│   ├── expense-claim/    # 지출청구 (ClaimSubmitForm, ClaimList, ExpenseClaimVerification)
│   └── pledge/           # 작정헌금 관련
├── lib/                   # 유틸리티
│   ├── google-sheets.ts  # Google Sheets 연동
│   ├── supabase.ts       # Supabase 클라이언트 (교적부 DB 연동)
│   ├── redis.ts          # Upstash Redis 캐싱
│   ├── matching-engine.ts # 자동 매칭 엔진
│   ├── queries.ts        # 공통 쿼리 함수
│   ├── utils.ts          # 공통 유틸
│   ├── receipt-pdf.tsx   # PDF 영수증 렌더링
│   └── auth/             # 인증 관련
│       ├── finance-permissions.ts  # 권한 정의 및 체크
│       └── use-finance-session.ts  # 세션 훅
├── middleware.ts          # SSO 감지 및 리다이렉트
└── types/                 # TypeScript 타입 정의 (index.ts)
public/
├── manifest.json          # PWA 매니페스트
├── sw.js                  # 최소 서비스 워커 (PWA 설치 요건 충족)
└── icons/                 # PWA 아이콘 (192x192, 512x512)
```

### PWA 자동설치

- `src/components/pwa-install.tsx` — 카카오톡/인앱 브라우저 감지→Chrome/Safari 리다이렉트, PWA 설치 유도 UI
- `public/sw.js` — 최소 서비스 워커 (beforeinstallprompt 이벤트 발동 요건)

### SSO 관련 주요 파일

| 파일 | 설명 |
|------|------|
| `src/middleware.ts` | 교적부 세션 쿠키 감지 및 SSO API로 리다이렉트 |
| `src/app/api/auth/sso/route.ts` | iron-session으로 교적부 세션 복호화 → 재정부 세션 생성 |
| `src/lib/auth/finance-permissions.ts` | 재정부 권한 정의 (FinanceRole, MENU_MIN_ROLE 등) |
| `src/lib/auth/use-finance-session.ts` | 클라이언트용 세션 훅 |

## 환경 변수

| 변수명 | 설명 | 필수 여부 |
|--------|------|----------|
| `SESSION_SECRET` | iron-session 암호화 키 (교적부와 동일해야 함, 32자 이상) | ✅ 필수 |
| `GOOGLE_PRIVATE_KEY` | Google Sheets API 서비스 계정 비공개 키 | ✅ 필수 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Sheets API 서비스 계정 이메일 | ✅ 필수 |
| `FINANCE_SHEET_ID` | 재정부 메인 Google Sheets ID | ✅ 필수 |
| `CASH_OFFERING_SHEET_ID` | 현금헌금 Google Sheets ID | ✅ 필수 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (클라이언트) | ✅ 필수 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon 키 (클라이언트) | ✅ 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role 키 (서버 전용) | ✅ 필수 |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (캐싱) | 선택 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST 토큰 (캐싱) | 선택 |
| `CHURCH_NAME` | 교회명 (기부금 영수증용) | 선택 |
| `CHURCH_ADDRESS` | 교회 주소 (기부금 영수증용) | 선택 |
| `CHURCH_LEADER` | 담임목사명 (기부금 영수증용) | 선택 |
| `NEXT_PUBLIC_BUILD_ID` | 빌드 ID (버전 체크용) | 선택 |

## 권한 체계

### 역할 정의

| 역할 | 한글명 | 우선순위 | 설명 |
|------|--------|----------|------|
| super_admin | 수퍼어드민 | 4 (최고) | 시스템 전체 관리자 |
| admin | 관리자 | 3 | 재정부 담당자 |
| deacon | 제직 | 2 | 재정 집사/권사 |
| member | 성도 | 1 (최저) | 일반 성도 |

### 메뉴별 접근 권한

#### MAIN (기본 메뉴)

| 메뉴 | 경로 | 최소 권한 | 비고 |
|------|------|----------|------|
| 대시보드 | `/dashboard` | member | |
| 성전 봉헌 | `/building` | member | |
| 내 헌금 | `/my-offering` | member | |

#### REPORTS (보고서)

| 메뉴 | 경로 | 최소 권한 | 비고 |
|------|------|----------|------|
| 예산 집행 | `/reports/budget` | member | 예산 대비 집행 현황 |
| 주간 요약 | `/reports/weekly` | **deacon** | |
| 연간 요약 | `/reports/monthly` | **deacon** | |
| 연간 비교 | `/reports/comparison` | **deacon** | |
| 수입 분석 | `/reports/income-analysis` | **deacon** | 상세 수입 분석 |
| 지출 분석 | `/reports/expense-analysis` | **deacon** | 상세 지출 분석 |
| 헌금자 분석 | `/reports/donor-analysis` | **admin** | 상세 헌금자 분석 |
| 커스텀 보고서 | `/reports/custom` | **super_admin** | 맞춤 보고서 생성 |

#### MANAGEMENTS (관리)

| 메뉴 | 경로 | 최소 권한 | 비고 |
|------|------|----------|------|
| 지출청구 | `/expense-claim` | **member** | 3탭: 청구 입력(member↑), 청구 현황(member↑), 처리내역 점검(member↑) |
| 데이터 입력 | `/data-entry` | admin | 4탭: 현금헌금 동기화, 은행원장 입력, 미반영 처리, 수입부 데이터보정 |
| 거래 매칭 | `/match` | admin | 미분류 거래 분류 |
| 카드내역 입력 | `/card-expense-integration` | **member** | 카드 사용 내역 업로드 |
| 카드 상세 입력 | `/card-details` | **member** | 카드 거래 상세 입력 |
| 헌금자 관리 | `/donors` | admin | |
| 기부금 영수증 | `/donors/receipts` | admin | |
| 매칭 규칙 | `/settings/matching-rules` | admin | 자동 매칭 규칙 조회 |
| 이월 잔액 | `/settings/carryover` | admin | |
| 작정 헌금 | `/settings/pledge` | admin | 작정 관리 |
| 계정과목 | `/settings/codes` | admin | 계정과목 관리 |
| 예산 관리 | `/settings/budget` | admin | 연간 예산 설정 |

#### ADMIN (시스템 관리)

| 메뉴 | 경로 | 최소 권한 | 비고 |
|------|------|----------|------|
| 연마감 | `/admin/annual-closing` | super_admin | 연도 마감 처리 |
| 사용자 관리 | `/admin/users` | super_admin | 사용자 역할 부여 |

### 권한 검사 로직

```typescript
// src/components/layout/Sidebar.tsx
const ROLE_PRIORITY: Record<FinanceRole, number> = {
  'super_admin': 4,
  'admin': 3,
  'deacon': 2,
  'member': 1,
};

function hasAccess(userRole: FinanceRole, requiredRole: FinanceRole): boolean {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[requiredRole];
}
```

### 특수 권한 동작

| 기능 | 대상 역할 | 동작 |
|------|----------|------|
| 작정헌금 독려 팝업 | member | 미작정 시 팝업 표시 |
| 연마감 알림 | super_admin | 연말에 마감 안내 표시 |
| 지출 상세 보기 | deacon 이상 | 예산집행 페이지에서 클릭 가능 |

## 데이터 구조 (Google Sheets)

### 주요 시트

| 시트명 | 코드 키 | 용도 | 비고 |
|--------|---------|------|------|
| 수입부 | income | 수입 기록 | |
| 지출부 | expense | 지출 기록 | |
| 은행원장 | bank | 은행 입출금 내역 | |
| 카드원본 | card | 카드 사용 내역 | |
| 카드소유자 | cardOwners | 카드 소유자 매핑 | |
| 매칭규칙 | matchingRules | 자동 매칭 학습 규칙 | |
| 예산 | budget | 예산 데이터 | |
| 수입부코드 | incomeCodes | 수입 계정과목 | |
| 지출부코드 | expenseCodes | 지출 계정과목 | |
| 헌금자정보 | donorInfo | 헌금자 정보 | |
| 수작업발급이력 | manualReceipts | 기부금영수증 수작업 발급 이력 | |
| 이월잔액 | carryoverBalance | 연초 이월 잔액 | |
| 작정헌금 | pledgeDonations | 작정 내역 (레거시) | |
| 작정헌금v2 | pledges | 작정 내역 (현행) | |
| 작정이력 | pledgeHistory | 작정 변경 이력 | |
| 작정마일스톤 | pledgeMilestones | 작정 달성 마일스톤 | |
| 건축원장 | buildingMaster | 건축헌금 원장 | |
| 연도별예산 | yearlyBudget | 외부 예산 조회 | IMPORTRANGE 연동 (읽기 전용) |
| 사업자정보 | businessInfo | 교회 사업자 정보 | 기부금영수증용 |
| 지출청구 | expenseClaim | 지출 청구 내역 | |
| 계정 | accounts | 계정 정보 | |
| 카드내역임시 | cardExpenseTemp | 카드내역 임시 저장 | |
| 헌금함 | (별도 시트) | 현금헌금 데이터 | CASH_OFFERING_SHEET_ID 사용 | |

---

## Phase 2 계획: 예산 취합/수정 기능

### 배경

현재 '연도별예산' 시트는 `IMPORTRANGE()`로 외부 Google 시트를 읽어오는 구조입니다.
따라서 앱 내에서 예산을 직접 수정할 수 없습니다.

### Phase 2 목표

앱 내에서 예산을 취합하고 수정할 수 있는 기능 구현

### 구현 방안

#### Option A: 외부 시트 직접 수정

1. 외부 예산 시트에 대한 쓰기 권한 설정
2. `IMPORTRANGE` 대신 직접 API로 외부 시트 접근
3. 예산 CRUD 기능을 외부 시트 대상으로 구현

#### Option B: 내부 예산 시트 신설

1. 내부용 '예산관리' 시트 생성 (앱에서 CRUD 가능)
2. '연도별예산' 시트는 참조용으로 유지
3. 예산 승인 워크플로우 구현

### 필요 기능

| 기능 | 설명 |
|------|------|
| 예산 입력 | 연도별, 계정과목별 예산 금액 입력 |
| 예산 수정 | 기존 예산 금액 변경 |
| 예산 삭제 | 예산 항목 삭제 |
| 예산 취합 | 카테고리별 예산 합계 조회 |
| 예산 승인 | (선택) 입력된 예산 승인 워크플로우 |

### 관련 파일 (향후 생성/수정)

```
src/app/settings/budget/page.tsx          # 예산 관리 UI (Phase 2 재구현)
src/app/api/settings/budget/route.ts      # 예산 CRUD API (Phase 2 재구현)
src/lib/google-sheets.ts                  # 외부 시트 접근 함수 추가
```

### 일정

- Phase 2 시작 시점: 별도 협의
- 현재 상태: 예산 수정은 Google 시트에서 직접 관리

---

## Redis 캐시 정책

### 개요

Upstash Redis를 사용하여 Google Sheets API 호출을 최소화합니다. Redis가 설정되지 않은 환경에서는 자동으로 캐시를 우회하고 직접 API를 호출합니다.

### 캐시 TTL

| 키 | TTL | 용도 |
|----|-----|------|
| `DASHBOARD` | 3일 (259200s) | 대시보드 통계 |
| `REPORTS` | 3일 (259200s) | 모든 보고서 API |
| `DONORS` | 3일 (259200s) | 헌금자 목록 |
| `CODES` | 7일 (604800s) | 수입부/지출부 코드 (거의 변경 안됨) |
| `BUDGET` | 3일 (259200s) | 예산 데이터 |
| `MY_OFFERING` | 1시간 (3600s) | 개인헌금 조회 |

### 캐시 키 구조

| 캐시 키 패턴 | 용도 |
|-------------|------|
| `finance:dashboard:v3:{year}:{weekOffset}` | 대시보드 |
| `finance:report:weekly:{year}:{startDate}` | 주간보고서 |
| `finance:report:monthly:{year}` | 월간보고서 |
| `finance:report:budget:{year}:{endDate}:{excludeConstruction}` | 예산대비보고서 |
| `finance:report:comparison:{endYear}` | 연간비교보고서 |
| `finance:report:income-analysis:{year}` | 수입분석 |
| `finance:report:expense-analysis:{year}` | 지출분석 |
| `finance:report:donor-analysis:{year}` | 헌금자분석 |
| `finance:my-offering:{userName}:{year}:{mode}:{includeHistory}` | 개인헌금 |

### 캐시 무효화

- **데이터 변경 시**: `invalidateYearCache(year)` 호출 → `finance:*:${year}*` 패턴 매칭으로 해당 연도 관련 캐시 일괄 삭제
- **무효화 호출 위치**:
  - `POST /api/sync/cash-offering` — 현금헌금 동기화
  - `POST /api/match/confirm` — 거래 매칭 확인
  - `POST /api/card/submit-details` — 카드내역 저장
  - `POST /api/card-expense/apply` — 카드대금 반영
  - `POST /api/income/records/split` — 수입부 레코드 분할
  - `PUT /api/income/records/[id]` — 수입부 레코드 수정
  - `DELETE /api/income/records/[id]` — 수입부 레코드 삭제
  - `POST /api/settings/budget` — 예산 설정
  - `POST /api/settings/carryover` — 이월잔액 설정

### 캐시 버전

`CACHE_VERSION = 'v3'` — 데이터 읽기 로직 변경 시 버전을 올려서 stale 캐시를 자동 무효화합니다.

---

## 최근 변경사항

### 2026-03-20 업데이트 (지출청구 2단계 처리 체계)

1. **청구현황 2탭으로 통합** — 처리내역 점검 탭 제거, 청구 현황 탭에 지출부 대조 기능 흡수

2. **2단계 처리 상태 체계**

   | 상태 | 배지 | 조건 |
   |------|------|------|
   | 미처리 | 🟡 | K컬럼 없음, 경과 일요일 0~1회 |
   | 누락의심 | 🔴 | K컬럼 없음, 경과 일요일 2회↑ |
   | 입금완료 | 🔵 | K컬럼 기재됨 (1차 점검) |
   | 최종확인 | 🟢 | K컬럼 + 지출원장 매칭됨 (2차 점검) |

3. **admin 워크플로우**
   - 1차 점검 (이체 당일): 체크박스 선택 → "입금완료 표시" 클릭 → K컬럼 기재 → 청구자 즉시 🔵 확인
   - 2차 점검 (주일 지출부 동기화 후): "지출부 대조" 클릭 → verification API 교차검증 → 🟢 또는 ⚠️ 아이콘
   - 엑셀 다운로드: 이체 파일 생성 + 전체 미처리 건 1차 처리 동시 진행

4. **청구현황 기본 기간**: 전체 → **최근 3개월** (기간 필터로 과거 조회 가능)

5. **수정 파일**: `ClaimList.tsx`, `expense-claim/page.tsx` (3탭→2탭)

### 2026-03-19 업데이트 (자체 지출청구 시스템 구현)

1. **지출청구 자체 시스템 (구글폼 대체)**
   - 전교인 SSO 로그인을 활용한 자체 지출청구 UI 구현
   - `/expense-claim` 최소 권한: admin → **member** (전교인 접근 가능)

2. **지출청구 탭 구조 3탭으로 개편**
   | 탭 | 내용 | 비고 |
   |----|------|------|
   | 청구 입력 | ClaimSubmitForm | 2단계 계정과목, 영수증 첨부 |
   | 청구 현황 | ClaimList | 상태 배지, 취소, admin 처리완료/엑셀 다운로드 |
   | 처리내역 점검 | ExpenseClaimVerification | 기존 무수정 |

3. **신규 API 라우트**
   | 경로 | 메서드 | 용도 |
   |------|--------|------|
   | `/api/expense-claim/submit` | POST | 지출청구 등록 (multipart/form-data, 영수증 포함) |
   | `/api/expense-claim/list` | GET | 청구 목록 (member=본인, admin=전체) |
   | `/api/expense-claim/cancel` | DELETE | 미처리 청구 취소 (본인 또는 admin) |
   | `/api/expense-claim/account-info` | GET | 세션 사용자 계좌 자동조회 |
   | `/api/expense-claim/receipt` | GET | 영수증 signed URL 생성 (1시간 만료) |

4. **google-sheets.ts 신규 함수**
   - `addExpenseClaim()` — 시트에 새 행 추가 (A: claimId, L: receiptUrl)
   - `getExpenseClaimsByClaimant(claimant)` — 청구자별 전체 내역
   - `getAllExpenseClaims(options?)` — 전체 청구 내역 (날짜 범위 옵션)
   - `deleteExpenseClaimRow(rowIndex)` — 행 삭제 (취소용)
   - `getAccountInfoByNamePublic(name)` — 계좌 조회 (기존 private → public 래퍼)

5. **Supabase Storage (expense-receipts 버킷)**
   - 경로: `{claimant}/{year}/{claimId}.{ext}` (private 버킷)
   - 조회: `createSignedUrl()` 1시간 만료 (서버사이드)
   - 삭제: 청구 취소 시 파일도 함께 삭제

6. **지출청구 상태 계산 로직**
   - 처리일(K컬럼) 있음 → `'processed'` (처리 완료)
   - 없음 + 청구일 이후 일요일 0~1회 → `'pending'` (미처리 추정)
   - 없음 + 일요일 2회↑ → `'suspicious'` (누락 의심)

7. **신규/수정 컴포넌트**
   ```
   src/components/expense-claim/
   ├── ClaimSubmitForm.tsx    # 청구 입력 폼 (신규)
   ├── ClaimList.tsx          # 청구 현황 목록 (신규)
   └── ExpenseClaimVerification.tsx  # 처리내역 점검 (무수정)
   ```

### 2026-03-16 업데이트 (지출청구 처리내역 점검 + 분석 개선)

1. **지출청구 처리내역 점검 기능 추가**
   - `/expense-claim` 페이지에 탭 구조 도입 (지출청구 / 처리내역 점검)
   - 처리완료 청구건 ↔ 지출원장 교차대조 (금액+날짜+내역 스코어링)
   - 청구자명 검색, 날짜범위 필터, 상태별(매칭/누락/확인필요) 필터
   - 매칭 후보 아코디언 상세 표시
   - API: `GET /api/expense-claim/verification`
   - 함수: `getProcessedExpenseClaims()` (google-sheets.ts)

2. **헌금자 월평균 분포 계산 수정**
   - `totalAmount / 12` → `totalAmount / (경과주차/52*12)` (연중 시점 반영)

3. **수입/지출 분석 전년동기 비교 추가**
   - 상단 카드에 전년동기 총수입/총지출 병기

4. **캐시 키 버전 추가**
   - income-analysis, expense-analysis, donor-analysis 캐시 키에 `CACHE_VERSION` 포함

### 2026-03-11 업데이트 (캐시 개선 + 코드 클린업)

1. **보고서 API Redis 캐시 추가**
   - 7개 보고서 API에 `getWithCache` 적용: weekly, monthly, budget, comparison, income-analysis, expense-analysis, donor-analysis
   - 캐시 TTL: 3일 (CACHE_TTL.REPORTS = 259200s)
   - monthly 보고서의 debug 모드는 캐시 우회

2. **캐시 무효화 누락 수정**
   - 4개 데이터 입력 라우트에 `invalidateYearCache()` 호출 추가
   - 대상: sync/cash-offering, match/confirm, card/submit-details, card-expense/apply

3. **코드 클린업 + 문서 정비** (이전 커밋)

1. **함수명 오타 수정**
   - `matchIncomeToPlledge` → `matchIncomeToPledge` (google-sheets.ts 정의 + 호출부)

2. **미사용 코드 삭제**
   - `src/lib/pdf/donation-receipt.tsx` 삭제 (receipt-pdf.tsx가 실제 사용 파일)
   - `src/components/data-entry/CardUpload.tsx` 삭제 (card-expense-integration 페이지로 대체 완료)
   - 미사용 Redis 캐시 키 6개 제거 (weeklyReport, monthlyReport 등 정의만 있고 사용처 없음)

3. **보안 개선**
   - 마이그레이션 라우트 5개 삭제 (`/api/migrate/*` — 일회성 이관 완료, 인증 없이 노출 위험)
   - API 에러 응답에서 `String(error)` 내부정보 노출 제거 (7개 파일) → 일반 에러 메시지로 교체

4. **UI 수정**
   - Sidebar에서 존재하지 않는 `/admin/settings` (시스템 설정) 고스트 메뉴 제거

5. **문서 정비**
   - ARCHITECTURE.md 환경변수 섹션: 5개 → 14개 (실제 사용 변수 반영, 변수명 오류 수정)
   - ARCHITECTURE.md 시트명 섹션: 10개 → 23개 (실제 google-sheets.ts FINANCE_CONFIG 기준)
   - 향후 검토 사항 문서 신규 작성 (`FUTURE_REVIEW.md`)

### 2026-03-10 업데이트 (버그 수정)

1. **대시보드 캐시 버전 변경**
   - v2 → v3: 날짜 정규화(normalizeDateString) 추가 후 stale 캐시 문제 해결

2. **수입부/지출부 날짜 서식 변경 시 대시보드 0원 문제 수정**
   - Google Sheets 날짜 서식 변경 시 대시보드 수입/지출이 0원으로 표시되는 문제 해결

### 2026-03-09 업데이트 (재정코드 플로팅 버튼)

1. **재정코드 플로팅 버튼 (FAB) 추가**
   - 화면 우하단에 플로팅 아이콘 표시 (모든 페이지에서 접근 가능)
   - 클릭 시 수입부코드/지출부코드를 탭으로 전환하여 조회
   - 카테고리별 그룹화, 비활성 코드 표시
   - 데이터는 최초 열 때 1회만 로드 (이후 캐시)

2. **신규/수정 파일**
   - `src/components/layout/FinanceCodeFab.tsx` — 플로팅 버튼 + 코드 조회 Dialog 컴포넌트 (신규)
   - `src/components/layout/MainLayout.tsx` — FinanceCodeFab 추가

### 2026-02-23 업데이트 (대시보드 잔액 정합성 개선)

1. **대시보드 마감 전 자동 이전 주 이동**
   - 문제: 주일이 지났지만 마감 전이면 대시보드가 미마감 주를 표시하여 잔액 불일치
   - 해결: weekOffset=0일 때 현재 주에 수입 데이터가 없으면 자동으로 이전 주(마감 완료 주)로 이동
   - API 응답에 `displaySunday`(실제 표시 날짜), `weekShifted`(이동 여부) 필드 추가
   - 프론트엔드: API의 displaySunday로 헤더 날짜 표시
   - 파일: `src/app/api/dashboard/stats/route.ts`, `src/app/dashboard/page.tsx`

2. **대시보드 잔액 계산 자본 필터링 (주간보고와 통일)**
   - 변경 전: 모든 수입/지출 포함 (자본수입 40번대, 자본지출 92/93 포함)
   - 변경 후: 자본수입(offering_code 40~49) 제외, 자본지출(account_code 92, 93) 제외
   - 주간보고서의 잔액 계산 방식과 동일하게 맞춤
   - 파일: `src/app/api/dashboard/stats/route.ts`

### 2026-02-11 업데이트 (은행제출용 예산안 + 연간보고)

1. **은행제출용 예산안 기능 신규 추가**
   - 커스텀 보고서 페이지 상단에 "은행제출용 예산안" 버튼 추가
   - 연도 선택 → 미리보기(편집 가능) → 엑셀 다운로드 흐름
   - 지출부: 해당 연도 예산계획(getBudget)에서 집계
   - 수입부: 전년도 실제 수입(getIncomeRecords)에서 집계
   - 전기이월: 전년 말 잔액(getCarryoverBalance)

2. **은행제출용 연간보고 기능 신규 추가**
   - 커스텀 보고서 페이지 상단에 "은행제출용 연간보고" 버튼 추가
   - 연도 선택 → 읽기전용 미리보기 → 엑셀 다운로드 흐름
   - 전년도 월별 수입/지출 집계 (12개월 테이블)
   - 수입 카테고리: 일반헌금, 목적헌금, 잡수입, 자본수입, 건축헌금
   - 지출 카테고리: 사례비~예비비(10개), 건축비
   - 당기잔고(월별 수입-지출), 총잔고(전기이월 기반 누적)
   - 수입부 상세내역 (연간 합계)

3. **신규 파일**
   - `src/app/api/reports/bank-budget/route.ts` — 예산안 데이터 집계 API
   - `src/components/reports/BankBudgetReport.tsx` — 예산안 Dialog 미리보기
   - `src/lib/bank-budget-excel.ts` — 예산안 엑셀 생성 유틸
   - `src/app/api/reports/bank-annual/route.ts` — 연간보고 월별 집계 API
   - `src/components/reports/BankAnnualReport.tsx` — 연간보고 읽기전용 Dialog
   - `src/lib/bank-annual-excel.ts` — 연간보고 엑셀 생성 유틸

### 2026-02-10 업데이트 (문서 정비 + 코드 클린징)

1. **ARCHITECTURE.md 문서-코드 불일치 8건 수정 (D1~D8)**
   - D1~D3: REPORTS 권한 테이블 수정 (weekly/monthly/comparison → deacon, budget → member, donor-analysis 추가)
   - D4: 카드 상세 입력(/card-details) 메뉴 누락 보완
   - D5: 존재하지 않는 /admin/settings 메뉴 제거
   - D6: 계정과목(/settings/codes), 예산 관리(/settings/budget) 메뉴 추가
   - D7: 폴더 구조 전면 재작성 (실제 코드와 일치)
   - D8: 기술 스택 테이블에 PDF/Excel/캐시/날짜/토스트 추가

2. **C3: 미사용 의존성 8개 제거**
   - 제거: @hookform/resolvers, dotenv, fontkit, html2canvas, next-auth, pdf-lib, react-hook-form, zod
   - 미사용 파일 삭제: `src/components/ui/form.tsx`

3. **C4: as any 4개 제거**
   - 파일: `src/app/admin/users/page.tsx`
   - untyped Supabase client에서 불필요한 `as any` 캐스팅 + eslint-disable 주석 제거

### 2026-02-03 업데이트 (성능 최적화)

1. **my-offering API N+1 쿼리 제거**
   - 기존: 연도별 22+회 API 호출 (2003~현재)
   - 변경: 전체 데이터 1회 조회 → 메모리에서 연도별 집계
   - 파일: `src/app/api/my-offering/route.ts`

2. **dashboard/stats API 8주 데이터 중복 조회 제거**
   - 기존: 연간 데이터 로드 후 8주 데이터 별도 조회 (2회 추가)
   - 변경: 8주 범위가 연간 범위 내이면 이미 로드된 데이터에서 필터링
   - 파일: `src/app/api/dashboard/stats/route.ts`

3. **Redis 캐시 TTL 추가**
   - `MY_OFFERING`: 3600초 (1시간) - 개인별 헌금 데이터
   - 캐시 키: `myOffering(userName, year, mode, includeHistory)`
   - 파일: `src/lib/redis.ts`

4. **my-offering API 캐싱 적용**
   - 캐시 히트 시 즉시 반환
   - `nocache` 쿼리 파라미터로 캐시 무시 가능
   - 파일: `src/app/api/my-offering/route.ts`

### 2026-02-01 업데이트 (SSO 연동)

1. **교적부-재정부 SSO 통합**
   - iron-session 패키지 추가 (v8.0.4)
   - 교적부 세션 자동 인식 및 재정부 세션 생성
   - 쿠키 도메인 `.yebom.org`로 설정 (서브도메인 간 공유)
   - middleware에서 `saint_record_session` 쿠키 감지
   - `/api/auth/sso` API로 세션 변환 처리

2. **관련 파일**
   - `src/middleware.ts`: SSO 감지 로직 추가
   - `src/app/api/auth/sso/route.ts`: SSO API 신규 생성
   - `package.json`: iron-session 의존성 추가

3. **환경 변수**
   - `SESSION_SECRET`: 교적부와 동일한 값 필수

### 2025-02 업데이트 (연말정산 정보입력 기능)

1. **연말정산 정보입력 기능 추가**
   - 로그인 페이지: 작정헌금 / 연말정산 정보입력 / 로그인 3가지 선택
   - 로그인 후 member 역할: 미입력 시 독려 팝업 표시
   - 수집 정보: 주민등록번호 (13자리), 주민등록 주소
   - 저장 전 확인 팝업: "정보가 정확하십니까?"
   - 데이터는 Supabase `members` 테이블에 저장

2. **이름 검색 UX 개선**
   - 작정헌금, 연말정산 정보입력 시 이름 검색 방식 변경
   - 기존: 전체 목록 로드 → 필터링 선택
   - 변경: 이름 입력 → 검색 버튼 클릭 → 정확히 일치하는 이름만 허용
   - 미등록 이름 검색 시: "교적부에서 성함이 발견되지 않습니다. 먼저 등록해 주시기 바랍니다."

3. **관련 컴포넌트**
   ```
   src/components/pledge/
   ├── TaxInfoModal.tsx          # 로그인 사용자용 연말정산 정보 모달
   ├── TaxInfoEntryModal.tsx     # 비로그인 사용자용 연말정산 정보 모달 (이름 검색 포함)
   ├── PledgeEntryModal.tsx      # 작정헌금 입력 모달 (이름 검색 포함)
   ├── PledgePromptPopup.tsx     # 작정/연말정산 독려 팝업 (카드 선택 UI)
   └── index.ts                  # 컴포넌트 export
   ```

4. **관련 API**
   | 경로 | 메서드 | 용도 |
   |------|--------|------|
   | `/api/members/tax-info` | GET | 연말정산 정보 입력 여부 확인 |
   | `/api/members/tax-info` | POST | 연말정산 정보 저장 (주민번호, 주소) |
   | `/api/donors/public` | GET | 헌금자 목록 조회 (로그인 불필요, 이름만 반환) |
   | `/api/donors/lookup` | GET | 헌금자 상세 정보 조회 (기존 데이터 로드용) |

5. **Supabase 연동**
   - `src/lib/supabase.ts`에 함수 추가:
     - `updateMemberTaxInfo(name, residentId, address)`: 교인 정보 업데이트
     - `hasMemberTaxInfo(name)`: 연말정산 정보 존재 여부 확인
   - `members` 테이블 `resident_id` 컬럼: varchar(14) (하이픈 포함 13자리)

### 2024-01 업데이트

1. **예산 집행 페이지**
   - 건축제외/전체 토글 추가 (기본값: 건축제외)
   - 분야별 상세 컬럼 헤더 고정 (sticky)
   - 폰트 크기 축소
   - 분야별 상세: 헤더/카테고리/소항목/소계를 flex 레이아웃으로 통일 (table→flex)
   - 연간집행율 컬럼 추가 (총예산 대비 지출율 Badge)

2. **성전 봉헌 페이지**
   - 차트 툴팁 억원 단위 표시 수정

3. **작정헌금 팝업 시스템**
   - 비로그인 사용자: 로그인 페이지에서 작정헌금/로그인 선택
   - member 역할: 미작정 시 독려 팝업 표시

4. **권한 조정**
   - '예산 관리' 메뉴 제거 (구글 시트에서 직접 관리)
   - '커스텀 보고서' super_admin 전용으로 변경

### 2025-03 업데이트 (데이터 입력 재설계 + 수입부 데이터보정)

1. **데이터 입력 4탭 구조로 재설계**
   - 기존 3탭 → 4탭: 현금헌금 동기화 / 은행원장 입력 / 미반영 처리 / 수입부 데이터보정
   - 은행원장 입력 탭에 잔고 검증 기능 추가 (이전잔고 + 수입합계 - 지출합계 = E11셀 현재잔고)
   - 미반영 처리 탭명 변경 (재정부 반영 → 미반영 처리)

2. **수입부 데이터보정 기능 (신규)**
   - 수입부 레코드 검색: 날짜 범위, 헌금자명, 금액 범위
   - 레코드 수정: 날짜, 헌금자, 대표자, 헌금코드, 금액, 비고
   - 레코드 분할: 1건 → N건 (합계 일치 검증)
   - 레코드 삭제: 확인 다이얼로그 후 삭제

3. **신규 API 라우트**
   | 경로 | 메서드 | 용도 |
   |------|--------|------|
   | `/api/income/records` | GET | 수입부 레코드 검색 (날짜/헌금자/금액 필터) |
   | `/api/income/records/[id]` | PUT | 수입부 레코드 수정 |
   | `/api/income/records/[id]` | DELETE | 수입부 레코드 삭제 |
   | `/api/income/records/split` | POST | 수입부 레코드 분할 |

4. **google-sheets.ts 함수 추가**
   - `deleteIncomeRecord(id)`: 수입부 레코드 삭제
   - `updateIncomeRecord(id, updates)`: 수입부 레코드 수정
   - `splitIncomeRecord(originalId, newRecords)`: 원본 삭제 + 신규 N건 생성

5. **신규/수정 컴포넌트**
   ```
   src/components/data-entry/
   ├── CashOfferingSync.tsx     # 변경 없음
   ├── BankUpload.tsx           # 잔고 검증 UI 추가
   ├── FinanceReflection.tsx    # 탭명만 변경 (미반영 처리)
   └── IncomeCorrection.tsx     # 수입부 데이터보정 (신규)
   ```

6. **은행원장 잔고 검증**
   - preview API에서 엑셀 E11셀 값(현재잔고) 추출
   - 이전잔고 + A(수입합계) - B(지출합계) = C(E11 현재잔고) 자동 검증
   - 검증 결과를 카드 UI로 표시 (일치: 녹색, 불일치: 적색)
