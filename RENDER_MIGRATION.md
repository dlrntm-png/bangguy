# Render 마이그레이션 가이드 (완전 무료)

## 개요

Railway는 크레딧 초과 시 자동 결제가 발생할 수 있어, 완전 무료 플랜을 제공하는 Render로 마이그레이션합니다.

## Render의 장점

1. **완전 무료 플랜**: 월 $5 크레딧 제한 없음
2. **자동 결제 없음**: 무료 플랜에서는 결제 정보 불필요
3. **슬립 모드**: 15분 비활성 시 자동 슬립 (무료)
4. **Railway와 동일한 Express 서버 코드 사용 가능**

## 빠른 시작

**상세 가이드는 `SETUP_GUIDE.md`를 참고하세요.**

## 사용자가 해야 할 작업

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: Render 계정 생성 및 프로젝트 생성

1. [Render](https://render.com)에 가입 (GitHub 계정으로 간편 가입)
2. "New +" → "Web Service" 클릭
3. GitHub 저장소 연결: `dlrntm-png/bangguy` 선택
4. 설정 입력:
   - **Name**: `bangguy` (또는 원하는 이름)
   - **Region**: `Singapore` (또는 가장 가까운 지역)
   - **Branch**: `main` (또는 기본 브랜치)
   - **Root Directory**: `.` (루트)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Plan**: `Free` 선택

### 3단계: 환경 변수 설정

Render 대시보드 → 프로젝트 → Environment → "Add Environment Variable"에서 설정:

**필수 환경 변수:**
- `POSTGRES_URL`: Neon 데이터베이스 연결 문자열
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob 토큰
- `ADMIN_PASSWORD_HASH`: 관리자 비밀번호 해시
- `ADMIN_JWT_SECRET`: JWT 서명용 시크릿
- `OFFICE_IPS`: 허용 IP CIDR 목록

**선택 환경 변수:**
- `POSTGRES_SSL`: `require`
- `UPLOAD_MAX_WIDTH`: `1280`
- `UPLOAD_WEBP_QUALITY`: `80`
- `NODE_ENV`: `production`

### 4단계: 배포 확인

1. "Create Web Service" 클릭
2. 배포 진행 상황 확인 (약 5-10분 소요)
3. 배포 완료 후 기본 도메인 확인: `프로젝트명.onrender.com`

### 5단계: 슬립 모드 설정 (무료 플랜)

무료 플랜은 15분 비활성 시 슬립 모드로 전환됩니다:
- 첫 요청 시 약 30초-1분 대기 시간 발생
- 이후 요청은 정상 속도

**슬립 방지 (선택):**
- Render Pro 플랜 ($7/월) 사용
- 또는 외부 서비스로 주기적 핑 (예: UptimeRobot 무료)

### 6단계: 커스텀 도메인 연결 (선택)

1. Render 대시보드 → 프로젝트 → Settings → Custom Domains
2. "Add Custom Domain" 클릭
3. 도메인 입력 및 DNS 설정 안내 따르기

### 7단계: 테스트

1. 배포된 URL로 접속하여 사용자 페이지 확인
2. 관리자 페이지 로그인 테스트
3. 출퇴근 등록 테스트
4. 관리자 기능 테스트

## Render vs Railway 비교

| 항목 | Render (무료) | Railway (무료) |
|------|---------------|----------------|
| 월 크레딧 | 무제한 (슬립 모드) | $5 크레딧 |
| 자동 결제 | 없음 | 크레딧 초과 시 가능 |
| 슬립 모드 | 15분 비활성 시 | 없음 |
| 첫 요청 지연 | 30초-1분 | 없음 |
| 커스텀 도메인 | 가능 | 가능 |

## 주의사항

1. **슬립 모드**: 무료 플랜은 15분 비활성 시 슬립됩니다
   - 첫 요청 시 약 30초-1분 대기
   - 주기적으로 사용하면 슬립되지 않음

2. **Vercel Blob**: Render에서도 계속 사용 가능

3. **데이터베이스**: Neon PostgreSQL 그대로 사용

4. **환경 변수**: Vercel과 동일한 값들 설정

## 문제 해결

### 배포 실패
- Render 로그 확인 (Dashboard → Logs)
- 환경 변수 누락 확인
- `package.json`의 `"type": "module"` 확인

### 슬립 모드 지연
- 정상 동작 (무료 플랜 특성)
- 슬립 방지하려면 Pro 플랜 ($7/월) 또는 외부 핑 서비스 사용

### API 오류
- Render 로그에서 에러 확인
- 데이터베이스 연결 확인
- Blob 토큰 확인

## 비용

- **Render 무료 플랜**: 완전 무료 (자동 결제 없음)
- **Vercel Blob**: 기존과 동일한 요금제
- **Neon PostgreSQL**: 기존과 동일 (무료 플랜 사용 가능)

## 롤백

문제 발생 시:
1. Render에서 배포 이전 버전으로 롤백
2. 또는 Railway/Vercel로 다시 전환

---

**작업 완료 후 확인 사항:**
- [ ] Render 프로젝트 생성 완료
- [ ] 환경 변수 모두 설정 완료
- [ ] 배포 성공 확인
- [ ] 도메인 연결 완료 (선택)
- [ ] 모든 기능 정상 작동 확인

