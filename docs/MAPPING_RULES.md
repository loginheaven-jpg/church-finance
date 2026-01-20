# 은행원장 데이터 매핑 규칙

> 이 문서는 은행원장(BankTransaction) 데이터를 수입부(IncomeRecord) 및 지출부(ExpenseRecord)로 변환하는 규칙을 정의합니다.

---

## 1. 데이터 구조

### 1.1 은행원장 (BankTransaction)
```typescript
interface BankTransaction {
  id: string;                    // 거래 ID
  transaction_date: string;      // 실제 거래일 (YYYY-MM-DD)
  date: string;                  // 기준일 (해당 주의 일요일)
  withdrawal: number;            // 출금액
  deposit: number;               // 입금액
  balance: number;               // 잔액
  description: string;           // 거래내용 (예: "인터넷입금", "CMS")
  detail: string;                // 기록사항 (예: "홍길동 십일조", "42청소년부현수막")
  branch: string;                // 점명
  time: string;                  // 시간
  memo: string;                  // 메모 (예: "홍길동")
  matched_status: string;        // 매칭 상태
  suppressed: boolean;           // 말소 여부
  suppressed_reason?: string;    // 말소 사유
}
```

### 1.2 수입부 (IncomeRecord)
```typescript
interface IncomeRecord {
  id: string;                    // 수입 ID (INC-timestamp-random)
  date: string;                  // 기준일 (주일)
  source: string;                // 입금방법 (헌금함, 계좌이체)
  offering_code: number;         // 헌금코드 (11, 12, 13, ...)
  donor_name: string;            // 헌금자명
  representative: string;        // 대표자명
  amount: number;                // 금액
  note: string;                  // 비고
  input_method: string;          // 입력방법 (현금헌금, 은행원장)
  created_at: string;            // 생성일시
  created_by?: string;           // 생성자
  transaction_date?: string;     // 실제 거래일
}
```

### 1.3 지출부 (ExpenseRecord)
```typescript
interface ExpenseRecord {
  id: string;                    // 지출 ID (EXP-timestamp-random)
  date: string;                  // 기준일 (주일)
  payment_method: string;        // 결제방법 (계좌이체, 법인카드, 현금)
  vendor: string;                // 거래처
  description: string;           // 적요
  amount: number;                // 금액
  account_code: number;          // 계정코드 (42, 43, 501, ...)
  category_code: number;         // 대분류코드 (40, 50, ...)
  note: string;                  // 비고
  created_at: string;            // 생성일시
  created_by?: string;           // 생성자
  transaction_date?: string;     // 실제 거래일
}
```

---

## 2. 수입부 매핑 규칙

### 2.1 컬럼 매핑 (BankTransaction → IncomeRecord)

| 수입부 필드 | 은행원장 소스 | 변환 규칙 |
|------------|--------------|----------|
| `id` | - | `generateId('INC')` → `INC-{timestamp}-{random}` |
| `date` | `tx.date` | 그대로 사용 (기준일 = 주일) |
| `source` | - | 항상 `'계좌이체'` |
| `offering_code` | `tx.memo`, `tx.detail` | **아래 2.2 키워드 매칭 규칙 적용** |
| `donor_name` | `tx.detail` | `detail.substring(0, 3)` (좌측 3자) |
| `representative` | `donor_name` | 헌금자정보 시트에서 대표자 조회, 없으면 `donor_name` 그대로 |
| `amount` | `tx.deposit` | 그대로 사용 |
| `note` | `tx.description`, `tx.detail` | `"{description} \| {detail}"` |
| `input_method` | - | 항상 `'은행원장'` |
| `created_at` | - | 현재 KST 시간 |
| `created_by` | - | `'auto_matcher'` |
| `transaction_date` | `tx.transaction_date` | 실제 거래일 그대로 |

### 2.2 헌금코드(offering_code) 결정 규칙

**우선순위 기반 키워드 매칭** (memo + detail 필드에서 검색)

| 우선순위 | 키워드 | 제외 키워드 | 코드 | 명칭 |
|---------|-------|-----------|-----|-----|
| 1 | `건축`, `성전`, `봉헌` | - | 501 | 건축헌금 |
| 2 | `십일조`, `십일` | - | 12 | 십일조헌금 |
| 3 | `구제` | `선교` | 22 | 구제헌금 |
| 4 | `선교` | - | 21 | 선교헌금 |
| 5 | `성탄`, `신년` | - | 14 | 특별헌금 |
| 6 | `감사` | - | 13 | 감사헌금 |
| 7 | `큐티`, `찬조`, `지정`, `후원` | - | 24 | 지정헌금 |
| 8 | `커피`, `카페` | `주일` | 32 | 기타잡수입 |
| 9 | `주일` | - | 11 | 주일헌금 |

**키워드 매칭 실패 시 금액 기반 기본 분류:**

| 조건 | 코드 | 명칭 |
|-----|-----|-----|
| 금액 < 50,000원 | 11 | 주일헌금 |
| 금액 % 10,000 ≠ 0 (천원 단위 있음) | 12 | 십일조 |
| 그 외 (만원 단위) | 13 | 감사헌금 |

### 2.3 특수 처리: 헌금함 입금

**헌금함 판별 조건:**
```
tx.detail.substring(0, 3) === '헌금함'
```

**처리 로직:**
1. 해당 기준일의 수입부 헌금함(source='헌금함') 합계 조회
2. 은행원장 헌금함 입금액과 비교
3. 금액 일치 → **말소** (중복 방지)
4. 금액 불일치 → **검토필요** (수동 확인)

---

## 3. 지출부 매핑 규칙

### 3.1 컬럼 매핑 (BankTransaction → ExpenseRecord)

| 지출부 필드 | 은행원장 소스 | 변환 규칙 |
|------------|--------------|----------|
| `id` | - | `generateId('EXP')` → `EXP-{timestamp}-{random}` |
| `date` | `tx.date` | 그대로 사용 (기준일 = 주일) |
| `payment_method` | - | 항상 `'계좌이체'` |
| `vendor` | `tx.memo` | memo 사용, 없으면 `'기타'` |
| `description` | - | 빈 문자열 (사용자가 입력) |
| `amount` | `tx.withdrawal` | 그대로 사용 |
| `account_code` | `tx.detail` | **아래 3.2 계정코드 추출 규칙 적용** |
| `category_code` | `account_code` | `Math.floor(account_code / 10) * 10` |
| `note` | `tx.detail` | 코드 추출 후 나머지 문자열 |
| `created_at` | - | 현재 KST 시간 |
| `created_by` | - | `'auto_matcher'` |
| `transaction_date` | `tx.transaction_date` | 실제 거래일 그대로 |

### 3.2 계정코드(account_code) 결정 규칙

**3단계 우선순위:**

#### [1순위] detail 앞자리 숫자 추출

`tx.detail` 필드가 숫자로 시작하면 계정코드를 추출합니다.

```
extractAccountCodeFromDetail(detail)
```

| 조건 | 추출 규칙 | 예시 |
|-----|---------|-----|
| `50`으로 시작 | 좌측 3자리 | `501대출상환` → `501` |
| `50` 다음이 숫자 아님 | **매칭 실패** → 검토필요 | `50원` → null |
| 그 외 숫자 시작 | 좌측 2자리 | `42청소년부` → `42` |

**추출 성공 시:**
- `account_code`: 추출된 숫자
- `note`: 숫자 이후 나머지 문자열 (예: `청소년부현수막`)

#### [2순위] 매칭규칙 시트 키워드 매칭

1순위 실패 시, 매칭규칙 시트(매칭규칙 탭)에서 키워드 검색:
- 검색 대상: `tx.detail + " " + tx.description`
- `rule_type = 'bank_expense'`인 규칙만 적용
- `confidence >= 0.8`인 규칙만 자동 매칭

#### [3순위] 검토필요 (needsReview)

1, 2순위 모두 실패 시:
- 사용자에게 수동 검토 요청
- 추천 규칙 최대 3개 제공

### 3.3 매칭규칙 시트 구조

| 필드 | 설명 | 예시 |
|-----|-----|-----|
| `id` | 규칙 ID | `RULE-001` |
| `rule_type` | 규칙 유형 | `bank_expense` |
| `pattern` | 매칭 키워드 | `전기요금` |
| `target_type` | 대상 유형 | `expense` |
| `target_code` | 계정코드 | `45` |
| `target_name` | 계정명 | `수도광열비` |
| `confidence` | 신뢰도 | `0.9` |
| `usage_count` | 사용 횟수 | `15` |

---

## 4. 카테고리 코드 체계

### 4.1 수입부 코드 (offering_code)

| 대분류 | 코드 | 항목 |
|-------|-----|-----|
| 10 (경상수입) | 11 | 주일헌금 |
| | 12 | 십일조헌금 |
| | 13 | 감사헌금 |
| | 14 | 특별헌금 |
| 20 (지정헌금) | 21 | 선교헌금 |
| | 22 | 구제헌금 |
| | 24 | 지정헌금 |
| 30 (기타수입) | 32 | 기타잡수입 |
| 50 (건축회계) | 501 | 건축헌금 |

### 4.2 지출부 코드 (account_code)

| 대분류 | 코드 | 항목 |
|-------|-----|-----|
| 40 (인건비) | 41 | 목사사례 |
| | 42 | 교역자사례 |
| | 43 | 사무원급여 |
| 50 (건축회계) | 501 | 건축헌금지출 |
| | 502 | 대출상환 |
| | 503 | 이자비용 |

> 전체 코드는 Google Sheets의 `수입부코드`, `지출부코드` 탭 참조

---

## 5. 처리 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                    은행원장 업로드                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1단계: 은행원장에 반영                                      │
│  - 거래 데이터 저장                                          │
│  - 거래 ID 생성 (BANK-timestamp-random)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2단계: 원장 매칭 (/api/match/auto)                          │
└─────────────────────────────────────────────────────────────┘
        │                     │                      │
        ▼                     ▼                      ▼
┌───────────────┐   ┌─────────────────┐    ┌────────────────┐
│ 입금 (deposit) │   │ 출금 (withdrawal)│    │  헌금함 입금    │
└───────────────┘   └─────────────────┘    └────────────────┘
        │                     │                      │
        ▼                     ▼                      ▼
┌───────────────┐   ┌─────────────────┐    ┌────────────────┐
│ 키워드 매칭    │   │ 1순위: detail    │    │ 금액 비교       │
│ (memo+detail) │   │   숫자 추출      │    │ (수입부 헌금함) │
└───────────────┘   └─────────────────┘    └────────────────┘
        │           ┌───────┴───────┐              │
        │           │               │              │
        ▼           ▼               ▼              ▼
┌───────────────┐  성공           실패      ┌────────────────┐
│ 수입부 레코드  │   │               │       │ 일치 → 말소    │
│ 생성          │   │               ▼       │ 불일치 → 검토   │
└───────────────┘   │    ┌─────────────────┐ └────────────────┘
                    │    │ 2순위: 매칭규칙  │
                    │    │   키워드 검색    │
                    │    └─────────────────┘
                    │    ┌───────┴───────┐
                    │    │               │
                    │    ▼               ▼
                    │   성공           실패
                    │    │               │
                    ▼    ▼               ▼
              ┌──────────────┐  ┌────────────────┐
              │ 지출부 레코드 │  │ 검토필요       │
              │ 생성         │  │ (needsReview)  │
              └──────────────┘  └────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3단계: 정식 반영 (/api/match/confirm)                       │
│  - 수입부/지출부 시트에 레코드 저장                           │
│  - 은행원장 matched_status 업데이트                          │
│  - 매칭규칙 usage_count 증가                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 검토필요(needsReview) 처리

### 6.1 검토필요 발생 조건

**수입부:**
- 헌금함 입금인데 금액 불일치

**지출부:**
- detail이 숫자로 시작하지 않음
- `50`으로 시작하는데 3번째 자리가 숫자가 아님 (예: `50원`)
- 매칭규칙 키워드 매칭 실패 또는 confidence < 0.8

### 6.2 검토필요 항목 처리

사용자가 UI에서:
1. 계정코드 직접 입력
2. 거래처/적요 수정
3. 확인 시 → `needsReview` → `matched`로 전환, 레코드 자동 생성

---

## 7. 참고: 관련 파일

| 파일 | 역할 |
|-----|-----|
| `src/types/index.ts` | 타입 정의 |
| `src/app/api/match/auto/route.ts` | 자동 매칭 로직 |
| `src/app/api/match/confirm/route.ts` | 정식 반영 API |
| `src/components/data-entry/BankUpload.tsx` | UI 컴포넌트 |
| `src/lib/google-sheets.ts` | Google Sheets 연동 |
| `src/lib/matching-engine.ts` | 매칭 엔진 유틸리티 |

---

*문서 작성일: 2026-01-20*
*작성자: Claude (자동 생성)*
