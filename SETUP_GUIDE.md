# Render + UptimeRobot 설정 가이드

## 📋 작업 분담

### ✅ AI가 완료한 작업
- [x] Express 서버 생성 (`server/index.js`)
- [x] API 라우트 변환 (attend, admin, consent, ip-status)
- [x] package.json 업데이트
- [x] Render 설정 파일 생성 (`render.yaml`)
- [x] 마이그레이션 가이드 문서 작성

### 👤 사용자가 해야 할 작업

## 1단계: 의존성 설치 (로컬)

```bash
npm install
```

## 2단계: Render 배포

### 2-1. Render 계정 생성
1. [Render](https://render.com) 접속
2. "Get Started for Free" 클릭
3. GitHub 계정으로 로그인 (권장)

### 2-2. 프로젝트 생성
1. Render 대시보드에서 "New +" 클릭
2. "Web Service" 선택
3. GitHub 저장소 연결:
   - "Connect account" (처음이면)
   - `dlrntm-png/bangguy` 저장소 선택
   - "Connect" 클릭

### 2-3. 서비스 설정
다음 정보를 입력하세요:

- **Name**: `bangguy` (또는 원하는 이름)
- **Region**: `Singapore` (또는 가장 가까운 지역)
- **Branch**: `main` (또는 기본 브랜치)
- **Root Directory**: `.` (루트 디렉토리)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm run start:server`
- **Plan**: `Free` 선택

### 2-4. 환경 변수 설정
"Advanced" 섹션 → "Add Environment Variable"에서 다음 변수들을 추가:

**필수 환경 변수:**
```
POSTGRES_URL=postgres://neondb_owner:npg_0pmZMx7yFQTB@ep-floral-thunder-a7s838ow-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

```
BLOB_READ_WRITE_TOKEN=발급받은_Vercel_Blob_토큰
```

```
ADMIN_PASSWORD_HASH=생성한_관리자_비밀번호_해시
```

```
ADMIN_JWT_SECRET=임의의_긴_문자열_시크릿
```

```
OFFICE_IPS=121.181.222.0/24,121.181.223.0/24
```

**선택 환경 변수:**
```
POSTGRES_SSL=require
UPLOAD_MAX_WIDTH=1280
UPLOAD_WEBP_QUALITY=80
NODE_ENV=production
```

### 2-5. 배포 시작
1. "Create Web Service" 클릭
2. 배포 진행 상황 확인 (약 5-10분 소요)
3. 배포 완료 후 기본 도메인 확인: `프로젝트명.onrender.com`
   - 예: `bangguy.onrender.com`

### 2-6. 배포 확인
1. 배포된 URL로 접속: `https://프로젝트명.onrender.com`
2. 사용자 페이지 확인 (`/`)
3. 관리자 페이지 확인 (`/admin.html`)

## 3단계: UptimeRobot 설정 (슬립 모드 방지)

### 3-1. UptimeRobot 계정 생성
1. [UptimeRobot](https://uptimerobot.com) 접속
2. "Sign Up" 클릭
3. 무료 계정 생성 (이메일 또는 Google 계정)

### 3-2. 모니터 생성
1. 로그인 후 대시보드에서 "Add New Monitor" 클릭
2. 다음 정보 입력:

   **Monitor Type:**
   - `HTTP(s)` 선택

   **Friendly Name:**
   - `bangguy-keepalive` (또는 원하는 이름)

   **URL:**
   - `https://프로젝트명.onrender.com/api/ip-status`
   - 예: `https://bangguy.onrender.com/api/ip-status`

   **Monitoring Interval:**
   - `5 minutes` 선택 (5분마다 체크)

   **Alert Contacts (선택):**
   - 이메일 알림 받으려면 설정 (선택사항)

3. "Create Monitor" 클릭

### 3-3. 모니터 확인
1. 대시보드에서 모니터 상태 확인
2. "Status"가 "Up"으로 표시되는지 확인
3. 몇 분 후 "Last Checked" 시간이 업데이트되는지 확인

### 3-4. 슬립 모드 방지 확인
- UptimeRobot이 5분마다 자동으로 요청을 보냅니다
- 15분 비활성 전에 요청이 들어가므로 슬립 모드가 발생하지 않습니다
- 첫 요청 지연 없이 항상 빠른 응답을 받을 수 있습니다

## 4단계: 기능 테스트

### 4-1. 기본 기능 테스트
- [ ] 사용자 페이지 접속 확인 (`/`)
- [ ] IP 상태 확인 API 테스트 (`/api/ip-status`)
- [ ] 관리자 페이지 접속 확인 (`/admin.html`)

### 4-2. 출퇴근 등록 테스트
- [ ] 사번, 이름, 사진 입력
- [ ] 등록 성공 확인
- [ ] 데이터베이스에 기록 저장 확인

### 4-3. 관리자 기능 테스트
- [ ] 관리자 로그인
- [ ] 기록 조회
- [ ] 기록 삭제
- [ ] CSV 다운로드

### 4-4. 슬립 모드 방지 확인
- [ ] 15분 이상 대기
- [ ] 페이지 접속 시 즉시 로드되는지 확인 (지연 없음)
- [ ] UptimeRobot 대시보드에서 정기 요청 확인

## 5단계: 커스텀 도메인 연결 (선택)

### 5-1. Render에서 도메인 추가
1. Render 대시보드 → 프로젝트 → Settings
2. "Custom Domains" 섹션
3. "Add Custom Domain" 클릭
4. 도메인 입력 (예: `bangguy.yourdomain.com`)

### 5-2. DNS 설정
Render가 제공하는 DNS 레코드를 도메인 제공업체에 설정:
- CNAME 레코드 추가
- Render가 제공한 값 입력

### 5-3. DNS 전파 대기
- 보통 몇 분~몇 시간 소요
- 최대 24시간까지 걸릴 수 있음

## 6단계: Vercel 마이그레이션 (선택)

Railway/Render 배포가 정상 작동하면:
- [ ] Vercel 프로젝트 유지 또는 삭제 결정
- [ ] 도메인 완전 전환 (필요시)

## 문제 해결

### 배포 실패
1. Render 로그 확인: Dashboard → Logs
2. 환경 변수 누락 확인
3. `package.json`의 `"type": "module"` 확인

### API 오류
1. Render 로그에서 에러 확인
2. 데이터베이스 연결 확인 (`POSTGRES_URL`)
3. Blob 토큰 확인 (`BLOB_READ_WRITE_TOKEN`)

### UptimeRobot 작동 안 함
1. URL이 올바른지 확인 (`/api/ip-status`)
2. Render 서비스가 실행 중인지 확인
3. 모니터링 간격이 5분인지 확인

### 슬립 모드 여전히 발생
1. UptimeRobot 모니터 상태 확인 (Up인지)
2. 모니터링 간격이 5분 이하인지 확인
3. URL이 올바른지 확인

## 완료 체크리스트

- [ ] Render 계정 생성 완료
- [ ] Render 프로젝트 생성 완료
- [ ] 환경 변수 모두 설정 완료
- [ ] 배포 성공 확인
- [ ] UptimeRobot 계정 생성 완료
- [ ] UptimeRobot 모니터 생성 완료
- [ ] 슬립 모드 방지 확인
- [ ] 모든 기능 정상 작동 확인
- [ ] 도메인 연결 완료 (선택)

## 참고 문서

- `RENDER_MIGRATION.md` - 상세 마이그레이션 가이드
- `RENDER_SLEEP_MODE.md` - 슬립 모드 상세 설명
- `RENDER_CHECKLIST.md` - 작업 체크리스트

---

**작업 순서:**
1. `npm install` 실행
2. Render 배포 (2단계)
3. UptimeRobot 설정 (3단계)
4. 기능 테스트 (4단계)

**예상 소요 시간:** 약 20-30분

