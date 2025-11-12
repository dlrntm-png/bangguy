# 빠른 시작 가이드

## 🚀 3단계로 완료

### 1️⃣ Render 배포 (15분)

1. [Render](https://render.com) 가입 → GitHub 로그인
2. "New +" → "Web Service"
3. 저장소 연결: `dlrntm-png/bangguy`
4. 설정:
   - Name: `bangguy`
   - Region: `Singapore`
   - Build Command: `npm install`
   - Start Command: `npm run start:server`
   - Plan: `Free`
5. 환경 변수 추가 (5개 필수):
   - `POSTGRES_URL` (Neon DB 연결 문자열)
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob 토큰)
   - `ADMIN_PASSWORD_HASH` (관리자 비밀번호 해시)
   - `ADMIN_JWT_SECRET` (JWT 시크릿)
   - `OFFICE_IPS` (허용 IP CIDR)
6. "Create Web Service" 클릭
7. 배포 완료 대기 (5-10분)

### 2️⃣ UptimeRobot 설정 (5분)

1. [UptimeRobot](https://uptimerobot.com) 가입
2. "Add New Monitor" 클릭
3. 설정:
   - Type: `HTTP(s)`
   - URL: `https://프로젝트명.onrender.com/api/ip-status`
   - Interval: `5 minutes`
4. "Create Monitor" 클릭

### 3️⃣ 테스트 (5분)

1. 배포된 URL 접속 확인
2. 사용자 페이지 테스트
3. 관리자 로그인 테스트
4. 출퇴근 등록 테스트

## ✅ 완료!

이제 완전 무료로 사용할 수 있습니다:
- ✅ 자동 결제 없음
- ✅ 슬립 모드 방지 (UptimeRobot)
- ✅ 첫 요청 지연 없음

## 📚 상세 가이드

- `SETUP_GUIDE.md` - 단계별 상세 가이드
- `RENDER_MIGRATION.md` - 전체 마이그레이션 정보
- `RENDER_SLEEP_MODE.md` - 슬립 모드 설명

