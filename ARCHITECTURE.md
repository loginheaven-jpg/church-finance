# 예봄교회 재정시스템 아키텍처

## 시스템 개요

Next.js 기반 교회 재정 관리 시스템으로, Google Sheets를 데이터베이스로 활용합니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| 데이터 저장 | Google Sheets API |
| 인증 | Session 기반 (쿠키) |
| 차트 | Recharts |
| 상태관리 | React Query (TanStack Query) |

## 폴더 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── api/               # API Route Handlers
│   ├── dashboard/         # 대시보드
│   ├── reports/           # 보고서 (weekly, monthly, budget 등)
│   ├── settings/          # 설정 페이지
│   ├── admin/             # 관리자 페이지
│   └── building/          # 성전 봉헌
├── components/            # 재사용 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── layout/           # 레이아웃 (Sidebar, MainLayout)
│   ├── dashboard/        # 대시보드 위젯
│   └── pledge/           # 작정헌금 관련
├── lib/                   # 유틸리티
│   ├── google-sheets.ts  # Google Sheets 연동
│   └── auth/             # 인증 관련
└── types/                 # TypeScript 타입 정의
```

## 권한 체계

| 역할 | 설명 | 접근 범위 |
|------|------|----------|
| super_admin | 수퍼어드민 | 모든 기능 + 시스템 설정, 연마감, 커스텀 보고서 |
| admin | 관리자 | 대부분 기능 (시스템 설정 제외) |
| deacon | 제직 | 보고서 + 수입/지출 분석 |
| member | 성도 | 대시보드, 내 헌금, 기본 보고서 |

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
