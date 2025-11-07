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
DEBUG=false
```

설명:
- `TRUST_PROXY`: 로드밸런서/NGINX 뒤라면 해당 프록시만 신뢰하도록 설정
- `OFFICE_IPS`: 사내 공인 IP 화이트리스트(단일 IP 또는 CIDR, 쉼표 구분)
- `ADMIN_PASSWORD`: 관리자 비밀번호 (기본값: admin123)
- `DEBUG`: 디버깅 로그 활성화 여부 (true/false, 기본값: false)

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
  - 파일 크기 제한: 5MB
  - 허용 파일 형식: JPEG, PNG, GIF, WebP
  - 중복 등록 방지: 같은 사번은 5분 내 재등록 불가
  - 사진 중복 감지: 동일한 사진 재사용 불가
  - 기기 ID 바인딩: 다른 기기에서 등록된 기록이 있으면 차단
- `POST /attend/request-device-update`: 기기 재등록 요청 제출

### 관리자
- `POST /admin/login`: 관리자 로그인 (비밀번호 필요)
- `GET /admin/check`: 관리자 토큰 확인
- `GET /admin/records`: 등록 기록 조회 (사번 필터링 가능)
- `POST /admin/update-device`: 기기 ID 업데이트 (다른 기기에서 등록된 경우)
- `POST /admin/delete-records`: 선택한 또는 전체 등록 기록 삭제 (연결된 사진 파일도 함께 삭제)
- `GET /admin/download-csv`: CSV 파일 다운로드
- `GET /admin/device-requests`: 기기 재등록 요청 목록 조회 (상태 필터링 가능)
- `POST /admin/approve-device-request`: 기기 재등록 요청 승인
- `POST /admin/reject-device-request`: 기기 재등록 요청 거부

## 관리자 페이지

관리자 페이지에 접속하여 등록 기록을 조회하고 기기 ID를 업데이트할 수 있습니다.

### 접속 방법
1. 브라우저에서 접속: `http://localhost:3000/admin.html`
2. 관리자 비밀번호 입력 (기본값: `admin123`)
3. 로그인 후 다음 기능 사용 가능:
   - **등록 기록 조회**: 전체 또는 사번별 조회 (한국 시간 표시)
   - **등록 기록 삭제**: 체크박스로 선택 삭제, 전체 삭제 시 모든 기록 및 사진 일괄 제거 (복구 불가)
   - **기기 ID 업데이트**: 다른 기기에서 등록된 기록이 있는 경우 새 기기 ID로 업데이트
   - **기기 재등록 요청 관리**: 사용자가 제출한 기기 재등록 요청 승인/거부
   - **CSV 다운로드**: 등록 기록을 CSV 파일로 다운로드

### 기기 재등록 요청 방법 (일반 사용자)

1. 등록 시도 시 "다른 기기에서 등록된 기록이 있습니다" 메시지가 표시되면
2. 화면에 나타나는 "기기 재등록 요청" 섹션에서:
   - 사번과 이름이 자동으로 입력됨 (확인 후 수정 가능)
   - "기기 재등록 요청" 버튼 클릭
3. 요청 제출 완료 → 관리자 승인 대기

### 기기 재등록 요청 승인 방법 (관리자)

1. 관리자 페이지 접속 (`http://localhost:3000/admin.html`)
2. "기기 재등록 요청 관리" 섹션에서:
   - 상태 필터로 "대기 중" 요청 확인
   - 요청 목록에서 사번, 이름, 기기 ID 확인
   - "승인" 또는 "거부" 버튼 클릭
3. 승인 시:
   - 해당 사번의 모든 등록 기록의 기기 ID가 자동 업데이트됨
   - 사용자가 즉시 다시 등록 가능

### 기기 ID 수동 업데이트 방법 (관리자)

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

## 주요 기능

### 보안 기능
- **IP 기반 인증**: 사내 공인 IP 화이트리스트로 접근 제어
- **사진 중복 감지**: MD5 해시를 사용하여 동일한 사진 재사용 방지
- **기기 ID 바인딩**: 사용자별 기기 고유 ID를 localStorage에 저장하여 다른 기기에서의 등록 차단
- **중복 등록 방지**: 같은 사번은 5분 내 재등록 불가
- **파일 검증**: 파일 크기(5MB) 및 타입(이미지만) 검증

### 사용자 경험
- **사진 미리보기**: 등록 전 사진 확인 가능
- **입력 필드 자동 초기화**: 등록 성공 후 3초 뒤 자동 초기화
- **명확한 에러 메시지**: 각 에러 상황에 대한 구체적인 안내 메시지
- **한국 시간 표시**: 모든 시간 정보를 KST(UTC+9)로 표시

### 관리 기능
- **기기 재등록 요청 시스템**: 사용자가 기기 변경 시 관리자 승인을 받아 재등록 가능
- **자동 파일 정리**: 30일 이상 된 업로드 파일 자동 삭제 (24시간마다 실행)
- **향상된 관리자 UI**: 상태 배지, 시간 포맷팅, 로딩 상태 표시 등
- **기록 삭제 제어**: 선택 또는 전체 삭제로 기록과 연계된 사진을 일괄 정리 (복구 불가 주의)

## 운영 팁
- 처음부터 URL 접근은 차단하지 않되, 등록 시 서버가 본 IP/사내망 여부를 응답에 포함하여 화면에 표시
- 프록시/로드밸런서 뒤라면 `trust proxy`를 정확히 설정해야 `req.ip`가 올바른 공인 IP를 반영
- 업로드 저장은 데모로 로컬을 사용. 운영에서는 S3로 전환하고 보존 기간/자동 삭제 정책 권장
- 디버깅이 필요할 때는 `.env`에 `DEBUG=true` 설정하여 상세 로그 확인 가능
- 오래된 파일은 자동으로 정리되지만, 필요시 `server/uploads/` 디렉터리를 수동으로 정리할 수 있음


## 사내 환경 이전 및 배포 가이드

### 1. 준비 (집 컴퓨터)
- `server/`, `public/`, `package.json`, `.env`만 복사합니다. (`node_modules/`, `.git/` 제외)
- USB, 클라우드 등 편한 방법으로 파일을 옮깁니다.
- `.env`에는 사내 IP 대역 정보가 있으므로 반드시 함께 이동하거나 사내에서 새로 작성합니다.

### 2. 사내 컴퓨터 설정
```powershell
# 프로젝트 복사 후 실행할 명령어 예시
cd C:\attendance-system\my-first-project
node --version
npm --version
npm install
```
- Node.js가 설치되어 있지 않다면 https://nodejs.org 에서 LTS 버전을 설치합니다.
- `.env`에서 `OFFICE_IPS`, `ADMIN_PASSWORD`, `PORT` 등을 사내 기준에 맞춰 수정합니다.

### 3. 실행 및 점검
```powershell
npm run start
```
- 브라우저에서 `http://localhost:3000` 접속해 정상 동작을 확인합니다.
- 같은 네트워크의 다른 기기에서 `http://사내PC_IP:3000`으로 접속 테스트합니다. (방화벽에서 포트 허용 필요)
- IP 매칭이 되지 않으면 `ipconfig`로 사내 IP를 확인해 `.env`의 `OFFICE_IPS`를 업데이트합니다.

### 4. 자동 실행 (선택 사항)
- Windows 작업 스케줄러: 부팅/로그온 시 `node server/index.js` 자동 실행
- NSSM 또는 PM2: 백그라운드 서비스 형태로 실행, 로그/모니터링 강화

### 5. 운영 권장 사항
- `.env`는 안전하게 보관하고 주기적으로 백업합니다.
- `ADMIN_PASSWORD`를 강력한 비밀번호로 교체합니다.
- 정기적으로 `npm run start` 로그와 `server/uploads` 디렉터리를 점검합니다.
- 필요 시 Git으로 버전 관리하고, 업데이트 시 동일한 절차로 배포합니다.

### Windows 작업 스케줄러로 자동 실행하기
1. Windows 검색창에서 “작업 스케줄러”를 입력해 실행합니다.
2. “작업 만들기…”를 클릭하고 이름(예: Attendance Server)을 지정합니다.
3. “가장 높은 권한으로 실행”을 체크합니다.
4. “트리거” 탭에서 “새로 만들기” → “작업 시작”을 “컴퓨터가 켜질 때” 또는 “사용자가 로그온할 때”로 설정합니다.
5. “동작” 탭에서 “새로 만들기” → 프로그램/스크립트에 `C:\Program Files\nodejs\node.exe`를 입력합니다.
6. “인수 추가”에는 `C:\Users\kk\Desktop\my-first-project\server\index.js`를 입력하고, “시작 위치”에는 `C:\Users\kk\Desktop\my-first-project`를 입력합니다.
7. 나머지는 기본값으로 두고 “확인”을 눌러 저장합니다. (필요 시 계정 암호 입력)
8. 작업 목록에서 만든 작업을 선택해 “실행”을 누르면 즉시 테스트할 수 있습니다.

이렇게 설정하면 Windows 기본 기능만으로 부팅 후 자동으로 Node 서버가 실행됩니다.

서버시작 방법
cd C:\Users\kk\Desktop\my-first-project
npm run start

node server\index.js 서버재시작