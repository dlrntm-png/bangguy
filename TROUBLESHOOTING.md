# 문제 해결 가이드

## UptimeRobot 502 에러 해결

### 증상
- UptimeRobot에서 "HTTP Down" 상태
- 502 Bad Gateway 에러
- 서버가 응답하지 않음

### 원인 분석

502 에러는 보통 다음 중 하나입니다:

1. **Render 서버가 아직 배포 중**
   - 배포가 완료되지 않았을 수 있음
   - 해결: Render 대시보드에서 배포 상태 확인

2. **Render 서버가 슬립 모드**
   - 15분 비활성 후 슬립 모드 전환
   - 첫 요청 시 30초~1분 대기 필요
   - 해결: UptimeRobot이 자동으로 깨워줌 (정상)

3. **서버 오류**
   - Express 서버가 시작되지 않음
   - 환경 변수 누락
   - 데이터베이스 연결 실패

4. **URL 경로 오류**
   - `/api/ip-status` 엔드포인트가 없음
   - 라우트 설정 오류

### 해결 방법

#### 1단계: Render 배포 상태 확인

1. Render 대시보드 접속
2. 프로젝트 선택
3. "Events" 또는 "Logs" 탭 확인
4. 배포가 완료되었는지 확인
5. 에러 메시지가 있는지 확인

#### 2단계: Render 로그 확인

Render 대시보드 → 프로젝트 → "Logs" 탭에서:

**정상적인 경우:**
```
🚀 Server running on port 10000
📁 Static files: /opt/render/project/src/public
🌐 Environment: production
```

**오류가 있는 경우:**
- 환경 변수 누락 오류
- 데이터베이스 연결 오류
- 포트 바인딩 오류

#### 3단계: 직접 접속 테스트

브라우저에서 직접 접속해보세요:

1. `https://bangguy.onrender.com` 접속
2. 사용자 페이지가 로드되는지 확인
3. `https://bangguy.onrender.com/api/ip-status` 접속
4. JSON 응답이 오는지 확인

**예상 응답:**
```json
{"ip":"...","office":true}
```

#### 4단계: 환경 변수 확인

Render 대시보드 → 프로젝트 → "Environment"에서 필수 환경 변수 확인:

- [ ] `POSTGRES_URL` 설정됨
- [ ] `BLOB_READ_WRITE_TOKEN` 설정됨
- [ ] `ADMIN_PASSWORD_HASH` 설정됨
- [ ] `ADMIN_JWT_SECRET` 설정됨
- [ ] `OFFICE_IPS` 설정됨

#### 5단계: 서버 재시작

1. Render 대시보드 → 프로젝트
2. "Manual Deploy" → "Deploy latest commit" 클릭
3. 재배포 완료 대기

### 일반적인 오류와 해결

#### 오류 1: "Cannot find module"
**원인:** 의존성 설치 실패
**해결:**
- Render 로그에서 `npm install` 오류 확인
- `package.json`의 `"type": "module"` 확인

#### 오류 2: "Port already in use"
**원인:** 포트 설정 오류
**해결:**
- Render는 자동으로 `PORT` 환경 변수를 설정
- 코드에서 `process.env.PORT || 3000` 사용 확인

#### 오류 3: "Database connection failed"
**원인:** `POSTGRES_URL` 오류
**해결:**
- 환경 변수 값 확인
- Neon 데이터베이스 연결 문자열 확인

#### 오류 4: "ENOENT: no such file or directory"
**원인:** 파일 경로 오류
**해결:**
- `server/index.js`의 `__dirname` 설정 확인
- 정적 파일 경로 확인

### UptimeRobot 설정 확인

1. **URL 확인:**
   - `https://bangguy.onrender.com/api/ip-status`
   - 끝에 `/` 없이 확인

2. **모니터링 간격:**
   - 5분으로 설정되어 있는지 확인

3. **모니터 타입:**
   - `HTTP(s)` 선택되어 있는지 확인

### 슬립 모드 관련

502 에러가 간헐적으로 발생한다면:

1. **정상 동작일 수 있음:**
   - 슬립 모드에서 깨어날 때 30초~1분 소요
   - UptimeRobot이 자동으로 깨워줌
   - 이후 요청은 정상 처리

2. **확인 방법:**
   - UptimeRobot 대시보드에서 "Last Checked" 시간 확인
   - 5분 간격으로 요청이 가는지 확인
   - 일시적인 502는 정상 (슬립 모드 전환 중)

### 완전한 해결 체크리스트

- [ ] Render 배포 완료 확인
- [ ] Render 로그에서 서버 시작 메시지 확인
- [ ] 브라우저에서 직접 접속 테스트
- [ ] `/api/ip-status` 엔드포인트 직접 테스트
- [ ] 환경 변수 모두 설정 확인
- [ ] UptimeRobot URL 정확한지 확인
- [ ] UptimeRobot 모니터링 간격 5분 확인
- [ ] 서버 재시작 시도

### 여전히 해결되지 않으면

1. **Render 로그 전체 확인:**
   - 에러 메시지 복사
   - 환경 변수 값 확인 (민감 정보 제외)

2. **로컬 테스트:**
   ```bash
   npm run dev:server
   ```
   - 로컬에서 서버가 정상 작동하는지 확인

3. **GitHub에 푸시 확인:**
   - 최신 코드가 GitHub에 푸시되었는지 확인
   - Render가 최신 커밋을 배포했는지 확인

---

**현재 상황:**
- UptimeRobot 모니터 설정 완료 ✅
- 서버가 502 에러 발생 중 ⚠️
- 위의 해결 방법을 순서대로 시도해보세요

