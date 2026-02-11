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
│   ├── expense-claim/     # 지출청구
│   ├── card-expense-integration/  # 카드내역 입력
│   ├── card-details/      # 카드 상세 입력
│   ├── donors/            # 헌금자 관리 (receipts 포함)
│   ├── login/             # 로그인
│   └── register/          # 회원가입
├── components/            # 재사용 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── layout/           # 레이아웃 (Sidebar, MainLayout)
│   ├── dashboard/        # 대시보드 위젯
│   └── pledge/           # 작정헌금 관련
├── lib/                   # 유틸리티
│   ├── google-sheets.ts  # Google Sheets 연동
│   ├── supabase.ts       # Supabase 클라이언트 (교적부 DB 연동)
│   ├── redis.ts          # Upstash Redis 캐싱
│   ├── matching-engine.ts # 자동 매칭 엔진
│   ├── queries.ts        # 공통 쿼리 함수
│   ├── utils.ts          # 공통 유틸
│   ├── receipt-pdf.tsx   # PDF 영수증 렌더링
│   ├── pdf/              # PDF 관련
│   │   └── donation-receipt.tsx  # 기부금 영수증 PDF
│   └── auth/             # 인증 관련
│       ├── finance-permissions.ts  # 권한 정의 및 체크
│       └── use-finance-session.ts  # 세션 훅
├── middleware.ts          # SSO 감지 및 리다이렉트
└── types/                 # TypeScript 타입 정의 (index.ts)
```

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
| `GOOGLE_SHEETS_PRIVATE_KEY` | Google Sheets API 서비스 계정 키 | ✅ 필수 |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Google Sheets API 서비스 계정 이메일 | ✅ 필수 |
| `SUPABASE_URL` | Supabase 프로젝트 URL | ✅ 필수 |
| `SUPABASE_ANON_KEY` | Supabase Anon 키 | ✅ 필수 |

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
| 지출청구 | `/expense-claim` | admin | |
| 데이터 입력 | `/data-entry` | admin | 수입/지출 직접 입력 |
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

| 시트명 | 용도 | 비고 |
|--------|------|------|
| 연도별예산 | 예산 데이터 조회 | IMPORTRANGE로 외부 시트 연동 (읽기 전용) |
| 수입부 | 수입 기록 | |
| 지출부 | 지출 기록 | |
| 헌금자관리 | 헌금자 정보 | |
| 작정헌금 | 작정 내역 | |
| 은행거래 | 은행 입출금 내역 | |
| 카드거래 | 카드 사용 내역 | |
| 매칭규칙 | 자동 매칭 학습 규칙 | |
| 수입부코드 | 수입 계정과목 | |
| 지출부코드 | 지출 계정과목 | |

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

## 최근 변경사항

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

2. **성전 봉헌 페이지**
   - 차트 툴팁 억원 단위 표시 수정

3. **작정헌금 팝업 시스템**
   - 비로그인 사용자: 로그인 페이지에서 작정헌금/로그인 선택
   - member 역할: 미작정 시 독려 팝업 표시

4. **권한 조정**
   - '예산 관리' 메뉴 제거 (구글 시트에서 직접 관리)
   - '커스텀 보고서' super_admin 전용으로 변경
