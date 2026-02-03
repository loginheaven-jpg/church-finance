# 작업 원칙 (필수 준수)

## 0. 듀얼 프로젝트 워크스페이스 (⚠️ 최우선 확인)

이 워크스페이스는 **교적부**와 **재정부** 두 개의 독립적인 프로젝트를 동시에 관리합니다.

### 프로젝트 경로 및 Git 리포지토리

| 프로젝트 | 경로 | Git 리포지토리 | 기본 브랜치 |
|----------|------|---------------|------------|
| **교적부** | `/workspaces/saint-record-v2` | https://github.com/loginheaven-jpg/saint-record-v2 | main |
| **재정부** | `/workspaces/church-finance` | https://github.com/loginheaven-jpg/church-finance | master |

### Git 작업 시 필수 규칙

1. **커밋/푸시 전 반드시 확인**:
   ```bash
   # 현재 디렉토리 확인
   pwd
   # 리모트 확인
   git remote -v
   ```

2. **교적부 작업 시**:
   ```bash
   cd /workspaces/saint-record-v2
   git push origin main
   ```

3. **재정부 작업 시**:
   ```bash
   cd /workspaces/church-finance
   git push origin master
   ```

4. **절대 금지**: 리모트 확인 없이 push 실행

### 현재 프로젝트: 재정부 (church-finance)
- 이 파일은 재정부 프로젝트의 CLAUDE.md입니다
- Git 리포지토리: https://github.com/loginheaven-jpg/church-finance
- 기본 브랜치: master

### 프로젝트별 아키텍처 문서

- 교적부: `/workspaces/saint-record-v2/ARCHITECTURE.md`
- 재정부: `/workspaces/church-finance/ARCHITECTURE.md`

---

## 1. TodoWrite 필수 사용
- 3개 이상의 작업이 있으면 반드시 TodoWrite로 등록
- 각 작업 완료 시 즉시 completed로 변경
- 모든 작업이 completed 되기 전까지 commit 금지

## 2. Commit 전 체크리스트
- 계획한 모든 항목이 완료되었는지 확인
- TodoWrite 목록에 pending/in_progress 항목이 없어야 함
- 미완료 항목이 있으면 commit 하지 말고 사용자에게 보고

## 3. 임의 판단 금지
- 작업 범위를 임의로 축소/변경하지 않음
- "이건 나중에" 또는 "이건 별도로" 판단 금지
- 불확실하면 반드시 사용자에게 질문

## 4. 작업 완료 기준
- 계획한 모든 항목 구현 완료
- 빌드 에러 없음
- 사용자가 요청한 기능이 모두 동작

## 5. 코드 수정 원칙 (원상복구 방지)
- 수정 전 반드시 해당 파일 Read로 확인
- 참고할 UI/패턴이 있으면 해당 파일도 먼저 확인
- 에러 발생 시 즉시 수정, 다음 작업으로 넘어가지 않음

### 5-1. Edit 직전 필수 Read
- Edit 호출 직전에 반드시 해당 파일을 Read (5분 전에 읽었더라도 다시 읽기)
- "File has been modified since read" 에러 발생 시 반드시 다시 Read 후 Edit

### 5-2. Edit 후 즉시 검증
- Edit 완료 후 해당 부분을 다시 Read하여 의도대로 반영되었는지 확인
- 특히 여러 곳을 수정할 때는 각 Edit 후 검증 필수

### 5-3. 다중 파일 수정 시 순차 처리
- 파일 A 수정 → 파일 A 검증 → 파일 B 수정 → 파일 B 검증
- 병렬 Edit 금지 (한 번에 여러 파일 Edit 호출 금지)
- 이전 파일 수정이 확인된 후에만 다음 파일로 이동

### 5-4. 코드 축약/재작성 금지
- 기존 코드 수정 시 "재작성" 금지
- 반드시 정확한 old_string으로 최소 범위만 부분 교체
- 기존 코드의 디테일한 로직/예외처리/주석을 임의로 생략하지 않음
- 긴 코드를 "비슷하게" 다시 쓰지 않고, 정확히 복사하여 필요한 부분만 변경

### 5-5. 연쇄 수정 시 이전 수정 보존 확인
- A 문제 해결 후 B 문제 해결 시, B 수정 전에 A 수정이 유지되는지 확인
- old_string은 반드시 현재 파일 상태 기준으로 작성 (기억 의존 금지)

### 5-6. 대규모 수정 전 git log 필수 확인
- 파일 전체를 수정하거나 10줄 이상 변경 시, 먼저 실행:
  `git log --oneline -5 -- 파일경로`
- 최근 커밋 메시지를 읽고 의도적 수정 사항 파악
- 특히 "style:", "fix:" 커밋은 주의 깊게 확인

### 5-7. 전체 재작성 금지
- 기존 코드를 "참고하여 새로 작성" 절대 금지
- 반드시 Edit의 old_string/new_string으로 부분 수정만 수행
- 모바일 반응형 추가 시에도 기존 클래스 유지하면서 추가만 허용

## 6. 데이터 처리 원칙
- Google Sheets API 호출 최소화 (캐싱 활용)
- 에러 발생 시 사용자에게 명확한 에러 메시지 제공
- 데이터 변경 전 항상 확인 단계 추가

## 7. 자동 commit & push
- 위의 모든 수정작업이 위 원칙대로 완료되면 묻지 않고 자동으로 commit 하고 push 까지 진행한뒤 보고한다.

## 8. 근거 파일
- 항상 ARCHITECTURE.md 파일을 기준으로 작업을 시작하고 작업이 마쳤을 때 내용의 변경이 있으면 ARCHITECTURE.md 파일을 업데이트하여 최신개발사항이 반영되어 있도록 해야한다.

## 9. 프로젝트 특성
- Google Sheets를 데이터베이스로 사용하는 구조 이해 필수
- 교적부(saint-record-v2)와 SSO 연동되어 있음
- 쿠키 도메인 `.yebom.org` 사용 (프로덕션)
- finance_role 권한 체계: super_admin, admin, deacon, member
