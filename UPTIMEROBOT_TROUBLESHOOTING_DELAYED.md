# UptimeRobot 체크 지연 문제 해결

## 문제 상황

- ⚠️ 5분 이상 지났는데도 "Last check: Coming soon" 상태
- ⚠️ 첫 체크가 실행되지 않음
- ⚠️ 모니터가 정상적으로 작동하지 않을 수 있음

## 가능한 원인

### 1. 모니터 설정 오류
- URL이 잘못되었을 수 있음
- 모니터 타입이 잘못 설정되었을 수 있음
- Interval 설정이 잘못되었을 수 있음

### 2. 서버 응답 문제
- 서버가 응답하지 않을 수 있음
- 타임아웃이 발생할 수 있음
- 오류 응답을 반환할 수 있음

### 3. UptimeRobot 서비스 문제
- UptimeRobot 서비스 자체의 지연
- 모니터가 활성화되지 않았을 수 있음

## 해결 방법

### 1단계: 서버 직접 테스트 (가장 중요)

브라우저에서 다음 URL을 직접 접속:

```
https://bangguy.onrender.com/api/ip-status
```

**예상 응답:**
```json
{"ip":"...","office":true}
```

**정상 응답이면:**
- ✅ 서버는 정상 작동 중
- ❌ UptimeRobot 설정 문제 가능
- → 모니터 설정 확인 필요

**오류 응답이면:**
- ❌ 서버 문제
- ❌ Render 로그 확인 필요
- → 서버 문제 해결 필요

### 2단계: 모니터 설정 확인

UptimeRobot 대시보드에서:

1. 모니터 클릭 → "Edit" 클릭
2. 다음 항목 정확히 확인:

**Monitor Type:**
- `HTTP(s)` 선택 ✅

**URL:**
- `https://bangguy.onrender.com/api/ip-status` ✅
- 끝에 슬래시(`/`) 없어야 함
- `http://`가 아닌 `https://` 사용
- 오타가 없는지 확인

**Monitoring Interval:**
- `5 minutes` 선택 ✅

**Status:**
- 모니터가 "Paused" 상태가 아닌지 확인
- "Active" 상태여야 함

3. "Save Changes" 클릭

### 3단계: 모니터 재생성 (권장)

문제가 계속되면 모니터를 재생성:

1. 기존 모니터 삭제
2. 새 모니터 생성:
   - **Type**: `HTTP(s)`
   - **Friendly Name**: `bangguy-keepalive`
   - **URL**: `https://bangguy.onrender.com/api/ip-status`
   - **Interval**: `5 minutes`
   - **Alert Contacts**: 설정 (선택)
3. "Create Monitor" 클릭
4. 5-10분 대기 후 상태 확인

### 4단계: 다른 엔드포인트 테스트

모니터 URL을 다른 엔드포인트로 변경해 테스트:

**옵션 1: 루트 페이지**
- URL: `https://bangguy.onrender.com/`
- HTML 응답 반환

**옵션 2: 관리자 페이지**
- URL: `https://bangguy.onrender.com/admin.html`
- HTML 응답 반환

**옵션 3: IP 상태 API (권장)**
- URL: `https://bangguy.onrender.com/api/ip-status`
- JSON 응답 반환

### 5단계: Render 로그 확인

Render 대시보드에서:

1. 프로젝트 → "Logs" 탭
2. 최근 로그 확인:
   - `/api/ip-status` 요청이 들어오는지 확인
   - 오류 메시지가 있는지 확인
   - 응답 시간이 정상인지 확인

## 체크리스트

- [ ] 브라우저에서 `/api/ip-status` 직접 접속 테스트
- [ ] JSON 응답 확인
- [ ] 모니터 설정 확인 (URL, Type, Interval)
- [ ] 모니터 상태 확인 (Active/Paused)
- [ ] Render 로그 확인
- [ ] 모니터 재생성 (필요시)

## 예상 결과

**정상 작동 시:**
- ✅ 서버 응답: JSON 형식
- ✅ 모니터 상태: "Up" (초록색)
- ✅ "Last check": 몇 분 전
- ✅ "Uptime": 업데이트됨

**문제가 있는 경우:**
- ❌ 서버 응답: 오류 또는 타임아웃
- ❌ 모니터 상태: "Down" (빨간색) 또는 "Coming soon"
- ❌ "Last check": 업데이트되지 않음

## 다음 단계

1. **지금 바로**: 브라우저에서 `/api/ip-status` 직접 접속 테스트
2. **모니터 설정 확인**: URL, Type, Interval 정확히 확인
3. **모니터 재생성**: 문제가 계속되면 재생성
4. **Render 로그 확인**: 서버 측 문제 확인

---

**중요:**
- 5분 이상 지났는데도 "Coming soon"이면 문제가 있을 수 있습니다
- 먼저 서버가 정상 작동하는지 확인하세요
- 서버가 정상이면 모니터 설정을 확인하세요

