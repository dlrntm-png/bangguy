# UptimeRobot 문제 해결 가이드

## 현재 상황

- ✅ 사용자 페이지 및 관리자 페이지 정상 작동
- ⚠️ UptimeRobot이 정상 작동하지 않음
- ⚠️ "Action Required: Update firewall for new monitoring IPs" 경고

## 경고 메시지 해석

**"Action Required: Update firewall for new monitoring IPs"**

이 경고는:
- UptimeRobot의 모니터링 인프라 업데이트 알림
- **Render는 방화벽 설정이 없으므로 무시해도 됨**
- Render는 모든 IP에서 접근 가능

## UptimeRobot 설정 확인

### 1단계: 모니터 상태 확인

1. UptimeRobot 대시보드 접속
2. 모니터 목록에서 `bangguy.onrender.com` 확인
3. 상태 확인:
   - **Up (초록색)**: 정상 작동 ✅
   - **Down (빨간색)**: 문제 있음 ❌
   - **Paused (회색)**: 일시 정지됨 ⏸️

### 2단계: URL 확인

**올바른 URL:**
```
https://bangguy.onrender.com/api/ip-status
```

**잘못된 URL 예시:**
- `https://bangguy.onrender.com` (루트 경로 - HTML 반환)
- `https://bangguy.onrender.com/api/ip-status/` (끝에 슬래시)
- `http://bangguy.onrender.com/api/ip-status` (HTTP - HTTPS 필요)

### 3단계: 모니터 설정 확인

1. 모니터 클릭 → "Edit" 클릭
2. 다음 항목 확인:

**Monitor Type:**
- `HTTP(s)` 선택 ✅

**URL:**
- `https://bangguy.onrender.com/api/ip-status` ✅
- 끝에 슬래시(`/`) 없어야 함

**Monitoring Interval:**
- `5 minutes` 선택 ✅

**Alert Contacts:**
- 이메일 알림 설정 (선택)

### 4단계: 테스트

**브라우저에서 직접 테스트:**
1. `https://bangguy.onrender.com/api/ip-status` 접속
2. JSON 응답 확인:
```json
{"ip":"...","office":true}
```

**정상 응답이면:**
- UptimeRobot 설정 문제
- 모니터 재생성 또는 수정 필요

**오류 응답이면:**
- Render 서버 문제
- 로그 확인 필요

## 일반적인 문제와 해결

### 문제 1: 모니터가 "Down" 상태

**원인:**
- URL 오류
- 서버 오류
- 슬립 모드 (일시적)

**해결:**
1. URL 정확히 확인
2. 브라우저에서 직접 접속 테스트
3. 몇 분 대기 후 다시 확인 (슬립 모드에서 깨어나는 시간)

### 문제 2: 모니터가 "Paused" 상태

**원인:**
- 모니터가 일시 정지됨

**해결:**
1. 모니터 클릭 → "Resume" 클릭
2. 또는 모니터 재생성

### 문제 3: 경고 메시지가 계속 표시됨

**원인:**
- UptimeRobot의 인프라 업데이트 알림
- Render는 방화벽이 없으므로 무시 가능

**해결:**
- 경고 무시 (Render는 모든 IP 허용)
- 또는 "View IP list" 클릭하여 IP 확인 (필요 없음)

### 문제 4: 모니터가 생성되지 않음

**해결:**
1. UptimeRobot 대시보드 → "Add New Monitor"
2. 설정:
   - Type: `HTTP(s)`
   - URL: `https://bangguy.onrender.com/api/ip-status`
   - Interval: `5 minutes`
3. "Create Monitor" 클릭

## 단계별 해결 방법

### 방법 1: 모니터 재생성 (권장)

1. 기존 모니터 삭제
2. 새 모니터 생성:
   - Type: `HTTP(s)`
   - URL: `https://bangguy.onrender.com/api/ip-status`
   - Interval: `5 minutes`
3. 저장 후 몇 분 대기
4. 상태 확인

### 방법 2: 모니터 수정

1. 모니터 클릭 → "Edit"
2. URL 확인: `https://bangguy.onrender.com/api/ip-status`
3. Interval 확인: `5 minutes`
4. "Save Changes" 클릭
5. 몇 분 대기 후 상태 확인

### 방법 3: 다른 엔드포인트 테스트

**대안 URL:**
- `https://bangguy.onrender.com/` (루트 - HTML 반환)
- `https://bangguy.onrender.com/api/ip-status` (권장 - JSON 반환)

## 확인 체크리스트

- [ ] UptimeRobot 대시보드 접속 확인
- [ ] 모니터 생성 또는 존재 확인
- [ ] URL 정확히 확인 (`/api/ip-status`)
- [ ] Interval 5분으로 설정 확인
- [ ] 브라우저에서 직접 접속 테스트
- [ ] 몇 분 대기 후 상태 확인
- [ ] "Last Checked" 시간 업데이트 확인

## 예상 결과

**정상 작동 시:**
- 모니터 상태: "Up" (초록색)
- "Last Checked": 몇 분 전
- "Uptime": 99% 이상
- 경고 메시지: 무시 가능

**문제가 있는 경우:**
- 모니터 상태: "Down" (빨간색)
- "Last Checked": 오래됨 또는 없음
- 에러 메시지 확인 필요

---

**다음 단계:**
1. UptimeRobot 대시보드에서 모니터 상태 확인
2. URL 정확히 확인
3. 브라우저에서 직접 접속 테스트
4. 문제가 계속되면 모니터 재생성

