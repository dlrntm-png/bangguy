# Railway 마이그레이션 가이드

## 개요

Vercel의 "Advanced Operations" 제한을 피하기 위해 Express 서버로 전환하여 Railway에 배포합니다.

## 변경 사항

### 1. Express 서버 추가
- `server/index.js`: Express 서버 메인 파일
- `server/routes/`: API 라우트 모듈
  - `attend.js`: 출퇴근 등록 관련
  - `admin.js`: 관리자 기능
  - `consent.js`: 동의 로그
  - `ip-status.js`: IP 상태 확인

### 2. package.json 업데이트
- `"type": "module"` 추가 (ESM 모듈 사용)
- `express`, `cors` 의존성 추가
- `start:server`, `dev:server` 스크립트 추가

### 3. Railway 설정
- `railway.json`: Railway 배포 설정 파일

## 사용자가 해야 할 작업

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: Railway 계정 생성 및 프로젝트 생성

1. [Railway](https://railway.app)에 가입
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. `dlrntm-png/bangguy` 저장소 선택

### 3단계: 환경 변수 설정

Railway 대시보드 → 프로젝트 → Variables 탭에서 다음 환경 변수들을 설정:

**필수 환경 변수:**
- `POSTGRES_URL`: Neon 데이터베이스 연결 문자열
  - 예: `postgres://neondb_owner:npg_0pmZMx7yFQTB@ep-floral-thunder-a7s838ow-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob 토큰 (기존과 동일)
- `ADMIN_PASSWORD_HASH`: 관리자 비밀번호 해시
- `ADMIN_JWT_SECRET`: JWT 서명용 시크릿
- `OFFICE_IPS`: 허용할 IP CIDR 목록 (예: `121.181.222.0/24,121.181.223.0/24`)

**선택 환경 변수:**
- `POSTGRES_SSL`: `require` (기본값)
- `UPLOAD_MAX_WIDTH`: `1280` (기본값)
- `UPLOAD_WEBP_QUALITY`: `80` (기본값)
- `ALLOW_LOAD_TEST`: `true` (부하 테스트용, 필요시)
- `RESEND_API_KEY`: 이메일 알림용 (선택)
- `RESEND_FROM_EMAIL`: 발신자 이메일 (선택)
- `CLEANUP_NOTIFY_EMAILS`: 백업 알림 수신자 (선택)
- `CLEANUP_SECRET`: 월별 정리 API 보안 토큰 (선택)

### 4단계: 배포 확인

1. Railway가 자동으로 배포를 시작합니다
2. 배포 완료 후 "Settings" → "Networking"에서 도메인 확인
3. 기본 도메인: `프로젝트명.railway.app`

### 5단계: 커스텀 도메인 연결 (선택)

**기존 `bangguy.vercel.app` 도메인을 Railway로 연결:**

1. Railway 대시보드 → 프로젝트 → Settings → Networking
2. "Custom Domain" 섹션에서 "Add Domain" 클릭
3. 도메인 입력: `bangguy.vercel.app` (또는 원하는 도메인)
4. Railway가 제공하는 DNS 레코드를 설정:
   - Vercel 도메인 설정에서 DNS 레코드 수정
   - 또는 새로운 서브도메인 사용 (예: `bangguy.railway.app`)

**참고:** Vercel 도메인을 Railway로 직접 연결하는 것은 불가능할 수 있습니다. 대신:
- 새로운 서브도메인 사용 (예: `bangguy.railway.app`)
- 또는 자신의 도메인을 사용 (예: `bangguy.yourdomain.com`)

### 6단계: 테스트

1. 배포된 URL로 접속하여 사용자 페이지 확인
2. 관리자 페이지 로그인 테스트
3. 출퇴근 등록 테스트
4. 관리자 기능 테스트

### 7단계: Vercel에서 마이그레이션 (선택)

Railway 배포가 정상 작동하면:
1. Vercel 프로젝트는 유지하거나 삭제 가능
2. 도메인을 Railway로 완전히 전환하려면 DNS 설정 변경

## 로컬 테스트

Express 서버를 로컬에서 테스트하려면:

```bash
npm run dev:server
```

서버는 `http://localhost:3000`에서 실행됩니다.

## 주의사항

1. **Vercel Blob**: Railway에서도 Vercel Blob을 계속 사용합니다 (별도 마이그레이션 불필요)
2. **데이터베이스**: Neon PostgreSQL은 그대로 사용합니다
3. **환경 변수**: Vercel과 Railway 모두에 동일한 환경 변수를 설정해야 합니다
4. **도메인**: Railway 무료 플랜에서도 커스텀 도메인 연결이 가능합니다

## 문제 해결

### 배포 실패
- Railway 로그 확인: 프로젝트 → Deployments → 로그 확인
- 환경 변수 누락 확인
- `package.json`의 `"type": "module"` 확인

### API 오류
- Railway 로그에서 에러 메시지 확인
- 데이터베이스 연결 확인 (`POSTGRES_URL`)
- Blob 토큰 확인 (`BLOB_READ_WRITE_TOKEN`)

### 도메인 연결 실패
- DNS 레코드 설정 확인 (Railway가 제공한 값과 일치하는지)
- DNS 전파 대기 (최대 24시간, 보통 몇 분)

## 비용

- **Railway 무료 플랜**: 
  - 월 $5 크레딧 제공
  - 사용량이 적으면 무료로 사용 가능
  - "Advanced Operations" 제한 없음
- **Vercel Blob**: 기존과 동일한 요금제 사용

## 롤백

문제가 발생하면:
1. Railway에서 배포 이전 버전으로 롤백
2. 또는 Vercel로 다시 전환 (기존 코드 유지)

---

**작업 완료 후 확인 사항:**
- [ ] Railway 프로젝트 생성 완료
- [ ] 환경 변수 모두 설정 완료
- [ ] 배포 성공 확인
- [ ] 도메인 연결 완료 (선택)
- [ ] 모든 기능 정상 작동 확인

