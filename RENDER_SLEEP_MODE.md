# Render 슬립 모드 가이드

## 슬립 모드란?

**슬립 모드(Sleep Mode)**는 Render 무료 플랜의 기능으로, 서버가 15분 동안 요청이 없으면 자동으로 일시 중지되는 기능입니다.

### 작동 방식
1. **활성 상태**: 서버가 정상적으로 요청 처리
2. **15분 비활성**: 마지막 요청 후 15분 동안 요청이 없으면
3. **슬립 모드 전환**: 서버가 자동으로 일시 중지
4. **첫 요청 시**: 슬립 모드에서 깨어나는데 약 30초~1분 소요
5. **이후 요청**: 정상 속도로 처리

## 슬립 모드의 영향

### 장점
- ✅ **완전 무료**: 리소스 절약으로 무료 플랜 제공 가능
- ✅ **자동 관리**: 수동 작업 불필요

### 단점
- ⚠️ **첫 요청 지연**: 슬립 모드에서 깨어날 때 30초~1분 대기
- ⚠️ **사용자 경험**: 첫 사용자가 느릴 수 있음

## 자동으로 깨우는 방법

### 방법 1: UptimeRobot (무료, 권장)

**UptimeRobot**은 무료 모니터링 서비스로, 주기적으로 서버에 요청을 보내 슬립 모드를 방지합니다.

#### 설정 방법:
1. [UptimeRobot](https://uptimerobot.com) 가입 (무료)
2. "Add New Monitor" 클릭
3. 설정:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `bangguy-keepalive` (원하는 이름)
   - **URL**: `https://프로젝트명.onrender.com/api/ip-status`
   - **Monitoring Interval**: `5 minutes` (5분마다 체크)
4. "Create Monitor" 클릭

**효과:**
- 5분마다 자동으로 요청 전송
- 15분 비활성 전에 요청이 들어가므로 슬립 모드 방지
- 완전 무료

### 방법 2: Render Cron Job (무료, 제한적)

Render의 Cron Job을 사용하여 주기적으로 요청을 보낼 수 있습니다.

#### 설정 방법:
1. Render 대시보드 → 프로젝트 → "Cron Jobs" 탭
2. "New Cron Job" 클릭
3. 설정:
   - **Schedule**: `*/10 * * * *` (10분마다)
   - **Command**: `curl https://프로젝트명.onrender.com/api/ip-status`
4. "Create Cron Job" 클릭

**주의사항:**
- Render 무료 플랜에서는 Cron Job이 제한적일 수 있음
- UptimeRobot이 더 간단하고 확실함

### 방법 3: 외부 서비스 (다양한 옵션)

다음 서비스들도 사용 가능합니다:

1. **Cronitor** (무료 플랜)
   - URL: https://cronitor.io
   - 무료 플랜: 5개 모니터

2. **Pingdom** (무료 플랜)
   - URL: https://www.pingdom.com
   - 무료 플랜: 1개 체크

3. **StatusCake** (무료 플랜)
   - URL: https://www.statuscake.com
   - 무료 플랜: 10개 모니터

## 추천 방법

### 🥇 UptimeRobot (가장 추천)
- ✅ 완전 무료
- ✅ 설정 간단
- ✅ 5분 간격으로 자동 요청
- ✅ 모니터링 기능도 제공

### 🥈 Render Pro 플랜 ($7/월)
- ✅ 슬립 모드 없음
- ✅ 항상 활성 상태
- ✅ 첫 요청 지연 없음
- ⚠️ 월 $7 비용

### 🥉 주기적 사용
- ✅ 추가 설정 불필요
- ⚠️ 15분마다 사용자가 접속해야 함
- ⚠️ 첫 사용자 경험 저하

## 실제 사용 시나리오

### 시나리오 1: UptimeRobot 사용 (권장)
```
사용자 접속 → 즉시 응답 (슬립 모드 아님)
↓
5분 후 UptimeRobot 요청 → 서버 활성 유지
↓
10분 후 UptimeRobot 요청 → 서버 활성 유지
↓
15분 후 UptimeRobot 요청 → 서버 활성 유지
↓
사용자 접속 → 즉시 응답
```

### 시나리오 2: 슬립 모드 발생
```
사용자 접속 → 즉시 응답
↓
15분 동안 요청 없음
↓
서버 슬립 모드 전환
↓
사용자 접속 → 30초~1분 대기 후 응답
```

## 설정 예시

### UptimeRobot 설정 예시

```
Monitor Type: HTTP(s)
Friendly Name: bangguy-keepalive
URL: https://bangguy.onrender.com/api/ip-status
Monitoring Interval: 5 minutes
Alert Contacts: (선택)
```

### API 엔드포인트 선택

슬립 모드를 방지하기 위해 가벼운 API를 사용하는 것이 좋습니다:

- ✅ `/api/ip-status` - 가장 가벼움 (권장)
- ✅ `/api/admin/check` - 관리자 인증 필요 (비권장)
- ❌ `/` - HTML 파일 로드 (무거움)

## 비용 비교

| 방법 | 비용 | 슬립 모드 | 첫 요청 지연 |
|------|------|-----------|--------------|
| UptimeRobot | 무료 | 없음 | 없음 |
| Render Pro | $7/월 | 없음 | 없음 |
| 슬립 모드 허용 | 무료 | 있음 | 30초~1분 |

## 결론

**추천: UptimeRobot 사용**
- 완전 무료
- 설정 간단 (5분 소요)
- 슬립 모드 완전 방지
- 추가 비용 없음

---

**설정 후 확인:**
- [ ] UptimeRobot 계정 생성
- [ ] 모니터 생성 완료
- [ ] 5분 간격으로 요청 확인
- [ ] 슬립 모드 발생하지 않음 확인

