# Railway 마이그레이션 체크리스트

## ✅ 작업 완료 사항

- [x] Express 서버 기본 구조 생성 (`server/index.js`)
- [x] API 라우트 변환 (attend, admin, consent, ip-status)
- [x] package.json 업데이트 (express, cors 추가, 스크립트 추가)
- [x] Railway 설정 파일 생성 (`railway.json`)
- [x] 마이그레이션 가이드 문서 작성

## 📋 사용자가 해야 할 작업

### 1. 의존성 설치
```bash
npm install
```

### 2. Railway 계정 및 프로젝트 생성
- [ ] [Railway](https://railway.app) 가입
- [ ] "New Project" → "Deploy from GitHub repo" 선택
- [ ] `dlrntm-png/bangguy` 저장소 연결

### 3. 환경 변수 설정 (Railway 대시보드 → Variables)

**필수:**
- [ ] `POSTGRES_URL` - Neon 데이터베이스 연결 문자열
- [ ] `BLOB_READ_WRITE_TOKEN` - Vercel Blob 토큰
- [ ] `ADMIN_PASSWORD_HASH` - 관리자 비밀번호 해시
- [ ] `ADMIN_JWT_SECRET` - JWT 서명용 시크릿
- [ ] `OFFICE_IPS` - 허용 IP CIDR 목록

**선택:**
- [ ] `POSTGRES_SSL` - `require` (기본값)
- [ ] `UPLOAD_MAX_WIDTH` - `1280` (기본값)
- [ ] `UPLOAD_WEBP_QUALITY` - `80` (기본값)
- [ ] 기타 선택 환경 변수

### 4. 배포 확인
- [ ] Railway 자동 배포 완료 확인
- [ ] 배포 로그에서 오류 없음 확인
- [ ] 기본 도메인 확인 (예: `프로젝트명.railway.app`)

### 5. 기능 테스트
- [ ] 사용자 페이지 접속 확인 (`/`)
- [ ] 관리자 페이지 로그인 테스트 (`/admin.html`)
- [ ] 출퇴근 등록 테스트
- [ ] 관리자 기능 테스트 (기록 조회, 삭제 등)

### 6. 도메인 연결 (선택)
- [ ] Railway Settings → Networking → Custom Domain
- [ ] 도메인 추가 및 DNS 설정
- [ ] DNS 전파 대기 및 확인

### 7. Vercel 마이그레이션 (선택)
- [ ] Railway 배포 정상 작동 확인 후
- [ ] Vercel 프로젝트 유지 또는 삭제 결정
- [ ] 도메인 완전 전환 (필요시)

## 🔍 문제 해결

### 배포 실패 시
1. Railway 로그 확인 (프로젝트 → Deployments)
2. 환경 변수 누락 확인
3. `package.json`의 `"type": "module"` 확인

### API 오류 시
1. Railway 로그에서 에러 메시지 확인
2. 데이터베이스 연결 확인
3. Blob 토큰 확인

### 도메인 연결 실패 시
1. DNS 레코드 설정 확인
2. DNS 전파 대기 (최대 24시간)

## 📝 참고 사항

- **Vercel Blob**: Railway에서도 계속 사용 (별도 마이그레이션 불필요)
- **데이터베이스**: Neon PostgreSQL 그대로 사용
- **비용**: Railway 무료 플랜 ($5 크레딧/월) 사용 가능
- **도메인**: Railway 무료 플랜에서도 커스텀 도메인 연결 가능

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 테스트 (선택)
npm run dev:server

# 3. Railway에 배포
# - GitHub에 푸시하면 자동 배포
git add .
git commit -m "Add Express server for Railway deployment"
git push
```

---

**작업 완료 후 이 체크리스트를 확인하세요!**

