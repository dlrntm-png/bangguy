# 출퇴근 인증(사내 공인 IP 확인)

이 프로젝트는 URL 접속을 막지 않고, 인증(등록) 시점에 서버가 본 클라이언트의 공인 IP를 표시하고 사내망 여부를 판정합니다.

## 구성
- `server/index.js`: Express 서버
- `public/index.html`: 브라우저 페이지(현재 IP/사내망 여부 표시 + 사번/이름/사진 등록)

## 환경변수
`.env` 파일 생성:

```
PORT=3000
TRUST_PROXY=loopback
OFFICE_IPS=203.0.113.10,198.51.100.20,203.0.113.0/24
ADMIN_PASSWORD=admin123
```

설명:
- `TRUST_PROXY`: 로드밸런서/NGINX 뒤라면 해당 프록시만 신뢰하도록 설정
- `OFFICE_IPS`: 사내 공인 IP 화이트리스트(단일 IP 또는 CIDR, 쉼표 구분)
- `ADMIN_PASSWORD`: 관리자 비밀번호 (기본값: admin123)

## 실행
```
npm install
npm run start
```

실행 후 `http://localhost:3000` 접속 → 초기 화면에서 현재 IP/사내망 여부 확인 → 사번/이름/사진 등록

## 엔드포인트

### 일반 사용자
- `GET /ip-status`: 현재 요청의 공인 IP 및 사내망 여부 반환 `{ ip, office }`
- `POST /attend/register`: 사번/이름/사진 등록. 응답에 `{ ok, ip, office, message }` 포함

### 관리자
- `POST /admin/login`: 관리자 로그인 (비밀번호 필요)
- `GET /admin/check`: 관리자 토큰 확인
- `GET /admin/records`: 등록 기록 조회 (사번 필터링 가능)
- `POST /admin/update-device`: 기기 ID 업데이트 (다른 기기에서 등록된 경우)
- `GET /admin/download-csv`: CSV 파일 다운로드

## 관리자 페이지

관리자 페이지에 접속하여 등록 기록을 조회하고 기기 ID를 업데이트할 수 있습니다.

### 접속 방법
1. 브라우저에서 접속: `http://localhost:3000/admin.html`
2. 관리자 비밀번호 입력 (기본값: `admin123`)
3. 로그인 후 다음 기능 사용 가능:
   - **등록 기록 조회**: 전체 또는 사번별 조회
   - **기기 ID 업데이트**: 다른 기기에서 등록된 기록이 있는 경우 새 기기 ID로 업데이트
   - **CSV 다운로드**: 등록 기록을 CSV 파일로 다운로드

### 기기 ID 업데이트 방법
1. 관리자 페이지 접속
2. "기기 ID 업데이트" 섹션에서:
   - 사번 입력
   - 새 기기 ID 입력 (사용자가 localStorage에서 확인한 기기 ID)
3. "기기 ID 업데이트" 버튼 클릭
4. 업데이트 완료 후 해당 사번으로 다시 등록 가능

## 버전 관리 (Git)

이 프로젝트는 Git으로 버전 관리됩니다.

### 초기 설정
```bash
# Git 사용자 정보 설정 (처음 한 번만)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 기본 명령어
```bash
# 변경사항 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "feat: 기능 설명"

# 커밋 히스토리 확인
git log

# 원격 저장소 연결 (GitHub 등)
git remote add origin <repository-url>
git push -u origin master
```

### 제외된 파일
- `node_modules/` - npm 패키지
- `.env` - 환경 변수 (민감 정보)
- `server/logs/` - 로그 파일
- `server/uploads/` - 업로드된 사진

자세한 규칙은 `PROJECT_RULES.md` 참고

## 운영 팁
- 처음부터 URL 접근은 차단하지 않되, 등록 시 서버가 본 IP/사내망 여부를 응답에 포함하여 화면에 표시
- 프록시/로드밸런서 뒤라면 `trust proxy`를 정확히 설정해야 `req.ip`가 올바른 공인 IP를 반영
- 업로드 저장은 데모로 로컬을 사용. 운영에서는 S3로 전환하고 보존 기간/자동 삭제 정책 권장
- 관리자용 간단 조회 페이지를 추가해 등록 이력 확인/다운로드 제공 권장


