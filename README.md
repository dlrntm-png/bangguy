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
```

설명:
- `TRUST_PROXY`: 로드밸런서/NGINX 뒤라면 해당 프록시만 신뢰하도록 설정
- `OFFICE_IPS`: 사내 공인 IP 화이트리스트(단일 IP 또는 CIDR, 쉼표 구분)

## 실행
```
npm install
npm run start
```

실행 후 `http://localhost:3000` 접속 → 초기 화면에서 현재 IP/사내망 여부 확인 → 사번/이름/사진 등록

## 엔드포인트
- `GET /ip-status`: 현재 요청의 공인 IP 및 사내망 여부 반환 `{ ip, office }`
- `POST /attend/register`: 사번/이름/사진 등록. 응답에 `{ ok, ip, office, message }` 포함

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


