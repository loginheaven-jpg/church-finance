# 예봄교회 재정시스템 (church-finance) 전용 개발 메모

이 문서는 과제 진행 중 발생하는 중요한 결정 사항, 분석 정보, 참조 아키텍처 등을 기록하기 위해 생성된 로컬 전용 메모입니다. 
(전역 폴더나 이전 프로젝트의 내용을 절대 참조하지 않고 본 폴더의 컨텍스트만 반영합니다.)

## 프로젝트 개요
- **목적**: Google Sheets를 데이터베이스로 활용하는 Next.js 기반 교회 재정 관리 시스템 
- **SSO 연동**: 교적부(saint-record-v2)와 쿠키를 통해 통합 로그인 지원

## 규칙
1. 이전 프로젝트의 정보 배제.
2. 모든 영구 기록은 이 문서나 폴더 내 다른 문서에 저장.

## 시스템 변경 이력
### 2026-04-09: 로그인 팝업 화면 지출청구 다이렉트 버튼 추가
- **요청 사항**: 초기 로그인 선택(/login) 시 상단에 '지출청구' 버튼을 클릭하면 교적부 인증을 거친 뒤 곧바로 지출청구 페이지(/expense-claim)로 이동하게 설정.
- **구현 내용**: `src/app/login/page.tsx`에 `lucide-react`의 `Receipt` 아이콘을 활용하여 보라색 테마의 버튼 추가.
- **SSO 연계**: `href="https://saint.yebom.org/login?redirect=https://finance.yebom.org/expense-claim"` 연결을 통해 기존 SSO 인증 플로우를 타도록 구성.

## 아키텍처 및 리팩토링 설계
### Step 1: Google Sheets I/O 매퍼 추상화 (SheetModelMapper)
- **문제 배경**: `src/lib/google-sheets.ts`에서 행(row)을 추가/수정할 때 `updatedRow = [row[0], updates.date ?? row[1], ...]` 처럼 고정된 Array Index로 하드코딩되어 있어, 시트 컬럼 변동 시 심각한 사이드 이펙트(데이터 덮어쓰기 오염) 발생 위험이 존재.
- **설계 구조**:
  1. **범용 Mapper 클래스/초기화기 도입**: 제네릭 `<T>` 타입을 가진 `SheetModelMapper` 클래스 작성. 
  2. **동적 헤더 매핑 (`rowToIndexMap`)**: `SheetModelMapper`가 초기화될 때 첫 번째 행(Header)을 입력받아 `Record<keyof T, number>` 형태의 맵을 생성.
  3. **안전한 Update 동작 (`mapper.updateRow`)**: `updateRow(originalRow, partialUpdates)` 메소드를 구현하여 입력받은 수정 객체의 키값을 시트의 가장 최신 인덱스에 맞게 매핑하여 교체.
  4. **A1-Notation 유닛 생성기**: `A${rowIndex}:L${rowIndex}` 같은 하드코딩된 열 범위를 헤더의 배열 길이(`headers.length`)를 바탕으로 동적 계산해주는 헬퍼(`getRangeNotation(length)`) 병행.
- **기대 효과**: 시트의 컬럼 순서, 삭제, 추가가 발생하더라도 코드 수정 없이 헤더명 일치를 통해 안전하게 매핑되므로 하위(Backward API) 호환성과 안전성을 보장할 수 있음.
