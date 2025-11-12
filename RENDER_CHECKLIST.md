# Render 마이그레이션 체크리스트

## ✅ 작업 완료 사항

- [x] Express 서버 기본 구조 생성 (`server/index.js`)
- [x] API 라우트 변환 (attend, admin, consent, ip-status)
- [x] package.json 업데이트 (express, cors 추가, 스크립트 추가)
- [x] Render 마이그레이션 가이드 문서 작성

## 📋 사용자가 해야 할 작업

### 1. 의존성 설치
```bash
npm install
```

### 2. Render 계정 및 프로젝트 생성
- [ ] [Render](https://render.com) 가입 (GitHub 계정)
- [ ] "New +" → "Web Service" 선택
- [ ] `dlrntm-png/bangguy` 저장소 연결
- [ ] 설정 입력:
  - Name: `bangguy`
  - Region: `Singapore` (또는 가까운 지역)
  - Branch: `main`
  - Root Directory: `.`
  - Runtime: `Node`
  - Build Command: `npm install`
  - Start Command: `npm run start:server`
  - Plan: `Free` 선택

### 3. 환경 변수 설정 (Render 대시보드 → Environment)

**필수:**
- [ ] `POSTGRES_URL` - Neon 데이터베이스 연결 문자열
- [ ] `BLOB_READ_WRITE_TOKEN` - Vercel Blob 토큰
- [ ] `ADMIN_PASSWORD_HASH` - 관리자 비밀번호 해시
- [ ] `ADMIN_JWT_SECRET` - JWT 서명용 시크릿
- [ ] `OFFICE_IPS` - 허용 IP CIDR 목록

**선택:**
- [ ] `POSTGRES_SSL` - `require`
- [ ] `UPLOAD_MAX_WIDTH` - `1280`
- [ ] `UPLOAD_WEBP_QUALITY` - `80`
- [ ] `NODE_ENV` - `production`

### 4. 배포 확인
- [ ] "Create Web Service" 클릭
- [ ] 배포 완료 확인 (5-10분 소요)
- [ ] 기본 도메인 확인: `프로젝트명.onrender.com`

### 5. 기능 테스트
- [ ] 사용자 페이지 접속 확인 (`/`)
- [ ] 관리자 페이지 로그인 테스트 (`/admin.html`)
- [ ] 출퇴근 등록 테스트
- [ ] 관리자 기능 테스트

### 6. 슬립 모드 이해
- [ ] 무료 플랜은 15분 비활성 시 슬립됨 (정상)
- [ ] 첫 요청 시 30초-1분 대기 시간 발생 (정상)
- [ ] 슬립 방지 필요 시 Pro 플랜 ($7/월) 또는 외부 핑 서비스 고려

### 7. 도메인 연결 (선택)
- [ ] Render Settings → Custom Domains
- [ ] 도메인 추가 및 DNS 설정
- [ ] DNS 전파 대기 및 확인

## 🔍 문제 해결

### 배포 실패
1. Render 로그 확인 (Dashboard → Logs)
2. 환경 변수 누락 확인
3. `package.json`의 `"type": "module"` 확인

### 슬립 모드 지연
- 정상 동작 (무료 플랜 특성)
- 첫 요청 시 30초-1분 대기 시간은 정상

### API 오류
1. Render 로그에서 에러 확인
2. 데이터베이스 연결 확인
3. Blob 토큰 확인

## 📝 참고 사항

- **자동 결제 없음**: Render 무료 플랜은 결제 정보 불필요
- **슬립 모드**: 15분 비활성 시 자동 슬립 (무료 플랜)
- **Vercel Blob**: Render에서도 계속 사용 가능
- **데이터베이스**: Neon PostgreSQL 그대로 사용

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 테스트 (선택)
npm run dev:server

# 3. Render에 배포
# - GitHub에 푸시하면 자동 배포
git add .
git commit -m "Add Express server for Render deployment"
git push
```

---

**작업 완료 후 이 체크리스트를 확인하세요!**

