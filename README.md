# 출퇴근 인증 시스템 (Next.js + Vercel)

사번, 이름, 사진을 기반으로 출퇴근을 기록하고, 요청자의 공인 IP가 사내망에 속하는지 판정하는 시스템입니다. 기존 Express 서버 구조를 Vercel에서 동작하도록 전면 개편하여 **서버리스 함수 + 인메모리 저장소 + Vercel Blob** 조합으로 동작합니다.

## 핵심 기능
- **사내망 판정**: `OFFICE_IPS` 화이트리스트(CIDR 지원)를 사용하여 접속 IP의 사내망 여부 판단
- **KST 타임스탬프**: 모든 기록은 한국 시간(KST, UTC+9)으로 저장 및 표시
- **중복 방지**
  - 동일 사번 5분 내 재등록 차단
  - 사진 MD5 해시를 활용한 중복 사진 감지
  - 기기 ID(localStorage) 바인딩 검증
- **기기 재등록 워크플로우**: 사용자는 재등록 요청 → 관리자는 승인/거부 후 자동 반영
- **관리자 페이지**
  - 등록 기록 검색/다운로드
  - 사진 미리보기 및 삭제
  - 선택/전체 기록 삭제 (연결된 사진 Blob도 함께 제거)
- **자동 파일 관리**: 업로드 이미지는 Vercel Blob에 저장되며, 레코드 삭제 시 Blob도 함께 제거
- **이미지 최적화**: 업로드 이미지는 자동으로 WebP로 압축(기본 1280px, 80% 품질)되며 크기/해상도 메타데이터를 함께 저장
- **월별 정리 자동화**: 매월 1일 이전에 백업 알림 메일 발송, CSV 백업 생성 후 자동으로 사진 파일 정리

## 기술 스택
- **Frontend**: 정적 HTML (`public/index.html`, `public/admin.html`)
- **Backend**: Next.js API Routes (서버리스 함수)
- **Storage**: 인메모리 저장소(재시작 시 초기화), Vercel Blob (이미지 파일)
- **인증**: 관리자 JWT (24시간 만료)

## 프로젝트 구조
```
├── lib/                 # 공통 유틸 (DB, IP 판정, Blob 업로드 등)
├── pages/api/           # Next.js API 라우트
│   ├── attend/          # 출퇴근 등록 관련 엔드포인트
│   └── admin/           # 관리자 전용 엔드포인트
├── public/              # 정적 페이지 (사용자/관리자)
├── next.config.mjs      # Next.js 설정
├── package.json
└── README.md
```

## 환경 변수
`.env.local` (로컬) / Vercel Project Environment에 아래 값을 설정하세요.

| 변수 | 설명 |
| --- | --- |
| `OFFICE_IPS` | 허용할 공인 IP 또는 CIDR 목록 (예: `121.181.222.0/24,121.181.223.0/24`)
| `ADMIN_PASSWORD` | 관리자 로그인용 비밀번호 (예: `superSecret123!`)
| `ADMIN_PASSWORD_HASH` | `npm run admin:hash -- "비밀번호"` 명령으로 생성한 PBKDF2 해시. 설정되면 평문 `ADMIN_PASSWORD` 대신 사용됨 (미설정 시 기본 해시가 사용됨)
| `ADMIN_JWT_SECRET` | 관리자 JWT 서명용 시크릿 문자열 (임의의 긴 문자열, 로컬 Mock 모드에서는 미설정 시 기본 시크릿 사용)
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 프로젝트에서 발급한 Read/Write 토큰 |
| `UPLOAD_MAX_WIDTH` | (선택) 업로드 이미지 최대 가로폭(px). 기본 1280 |
| `UPLOAD_WEBP_QUALITY` | (선택) WebP 품질(1~100). 기본 80 |
| `MOCK_DB` | (선택) `true` 로 설정하면 관리자 인증에서 개발용 기본 비밀번호 허용 |
| `MOCK_BLOB` | (선택) `true` 로 설정하면 Vercel Blob 대신 `public/mock-uploads/`에 파일을 저장 |
| `RESEND_API_KEY` | (선택) Resend 이메일 API 키. 월별 정리 알림에 사용 |
| `RESEND_FROM_EMAIL` | (선택) 발신자 이메일 주소. 기본값 `noreply@attendance.local` |
| `CLEANUP_NOTIFY_EMAILS` | (선택) 월별 백업 알림을 받을 이메일 목록 (콤마 구분) |
| `CLEANUP_SECRET` | 월별 정리 API를 호출할 때 사용하는 보안 토큰 (Vercel Cron에서 사용) |
| `BLOB_PUBLIC_BASE_URL` | (선택) Blob 다운로드용 커스텀 도메인이 있을 때 설정 |
| `ALLOW_DEV_ADMIN_PASSWORD` | (선택) `false`로 설정하면 개발 환경에서도 기본 관리자 비밀번호 사용을 차단 |

> **주의**: 현재 버전은 모든 메타데이터를 메모리에만 보관합니다. 서버리스 함수가 재시작되거나 스케일링되면 데이터가 초기화되니, 영구 저장이 필요하면 별도의 데이터베이스 연동을 직접 구현해야 합니다.

## 로컬 개발
```bash
npm install
npm run dev
```

### 빠른 커밋 자동화
작업 요청마다 빠르게 커밋하려면 다음 스크립트를 사용하세요.

```bash
npm run commit -- "작업 메시지"
```

- 메시지를 생략하면 `auto: YYYY-MM-DD HH:mm:ss` 형식으로 자동 작성됩니다.
- 변경 사항이 없으면 “커밋할 변경 사항이 없습니다.” 메시지만 출력됩니다.
- Push는 자동으로 실행되지 않으니 필요할 때 `git push`로 올려주세요.

### 관리자 비밀번호 해시 생성
프로덕션에서는 평문 비밀번호 대신 해시를 사용하세요.

```bash
npm run admin:hash -- "강력한비밀번호!"
```

- 출력된 문자열을 `ADMIN_PASSWORD_HASH` 환경 변수로 설정합니다.
- 개발 환경에서만 `ADMIN_PASSWORD`(또는 기본값 `admin123`)이 허용됩니다. 배포 환경에서는 해시가 없으면 로그인할 수 없습니다.

- 개발 서버: `http://localhost:3000`
- 사용자 페이지: `/` → 현재 IP/사내망 여부 + 출퇴근 등록
- 관리자 페이지: `/admin.html`
- API 로그는 터미널(서버리스 함수 실행 시 콘솔)에서 확인
- 로컬에서 빠르게 확인하려면 `.env.local` 에 `MOCK_BLOB=true`, `OFFICE_IPS=175.120.139.0/24,127.0.0.1/32,::1/128` 를 지정하세요.  
  - Mock Blob은 `public/mock-uploads/` 폴더에 WebP/CSV 파일을 저장하며 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

## Vercel 배포 절차
1. **Repository 연결**: `dlrntm-png/bangguy` 저장소를 Vercel 프로젝트에 연결합니다.
2. **Environment Variables 설정**
   - `OFFICE_IPS`
   - `ADMIN_PASSWORD`
   - `ADMIN_JWT_SECRET`
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob 대시보드에서 발급)
3. **Blob 연결**
   - Vercel Dashboard → Storage → Blob 에서 Read/Write Token 발급 → 환경 변수 저장
4. **추가 설정** (선택)
   - Team/Pro 플랜이 아니라면 이미지 용량 제한(5MB)과 Blob 사용량을 모니터링하세요.
   - `vercel-build` 스크립트는 `next build`로 구성되어 있으므로 추가 설정 불필요
5. **배포**: `git push` 후 자동 빌드 또는 Vercel에서 수동 `Deploy` 실행
6. **도메인 연결** (선택): Vercel에서 `attendance.yourcompany.com` 등 커스텀 도메인을 연결 가능

## API 요약
- `GET /api/ip-status` : `{ ip, office }`
- `POST /api/attend/register` : multipart 등록, `{ ok, message, ip, office, serverTime, recordId }`
- `POST /api/attend/request-device-update`
- 관리자 전용(API 호출 시 `Authorization: Bearer <token>` 필요)
  - `POST /api/admin/login`
  - `GET /api/admin/records`
  - `POST /api/admin/update-device`
  - `GET /api/admin/download-csv`
  - `GET /api/admin/device-requests`
  - `POST /api/admin/approve-device-request`
  - `POST /api/admin/reject-device-request`
  - `POST /api/admin/delete-photo`
  - `POST /api/admin/delete-records`

## 관리자 페이지 사용법
1. `http://배포도메인/admin.html` 접속 후 비밀번호 입력
2. 기능
   - **등록 기록 조회**: 사번 검색, 사진 썸네일, 기기 ID 확인
   - **사진 삭제**: 선택 시 Blob에서 이미지 제거 + DB 필드 정리
   - **기록 삭제**
     - 체크박스로 다중 선택 삭제
     - 전체 삭제 버튼으로 일괄 처리 (Blob도 함께 삭제)
   - **CSV 다운로드**: 모든 기록을 CSV로 내려받기
   - **기기 ID 업데이트**: 사용자 요청에 맞춰 수동 수정 가능
   - **기기 재등록 요청 관리**: Pending → 승인/거부 처리

## 운영/모니터링 팁
- **로그 확인**: Vercel Functions 로그에서 API 호출 오류를 확인할 수 있습니다.
- **Blob 용량 관리**: 불필요한 기록을 주기적으로 정리하여 저장 공간 절약
- **데이터 백업**: 메모리 저장소 특성상 재시작 시 데이터가 초기화됩니다. 영구 보관이 필요하면 별도 DB 연동 또는 CSV 백업을 수동으로 관리하세요.
- **보안**: `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`은 강력한 값으로 설정하고 주기적으로 교체
- **HTTPS & 보안 헤더**: `middleware.js`를 통해 HSTS, CSP, X-Frame-Options, Referrer-Policy 등을 모든 관리자/API 응답에 적용
- **관리자 비밀번호**: `ADMIN_PASSWORD_HASH` 설정을 권장하고, 필요 시 `ALLOW_DEV_ADMIN_PASSWORD=false`로 기본 비밀번호를 비활성화
- **IP 화이트리스트**: 사내 IP 대역 변경 시 `OFFICE_IPS` 환경 변수를 업데이트 후 재배포
- **월별 백업 & 자동 삭제**
  - Vercel Blob에 `backups/<YYYY-MM>/…` 경로로 CSV 메타데이터 자동 생성
  - `/api/admin/cleanup-preview` (POST): 전월 데이터 통계 + CSV 업로드 + 알림 메일 발송  
    - 관리자 토큰 또는 `x-cron-secret: CLEANUP_SECRET` 헤더로 호출 가능  
    - Vercel Scheduled Functions로 매월 **말일 09:00 KST** 정도에 호출하면 알림 메일이 발송됩니다.
  - `/api/admin/cleanup-execute` (POST): 전월 사진 파일 삭제 및 메타데이터 정리  
    - 매월 **1일 00:10 KST** 등으로 예약 실행  
    - 삭제 후 기록은 유지되지만 `photo_url`이 제거되고 `photo_deleted_at` 타임스탬프가 남습니다.
  - 알림 메일을 받으려면 `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLEANUP_NOTIFY_EMAILS` 환경 변수를 설정하세요.
  - CSV 파일에는 사진 URL/Blob 경로가 포함되므로, 삭제 전에 다운로드하여 로컬 NAS/백업 디스크에 보관할 수 있습니다.

## 마이그레이션 참고 (이전 Express 버전 → Vercel 버전)
- 로컬 디스크에 저장하던 업로드 파일 → Vercel Blob
- CSV 기반 기록 관리 → (임시) 인메모리 저장소 보관
- Express 서버 → Next.js API Routes (자동 확장 & 서버리스 실행)
- 관리자 토큰 메모리 저장 → JWT 기반(멱등), 서버리스 환경에서도 유지

## Troubleshooting
| 증상 | 해결 방법 |
| --- | --- |
| `Error: BLOB_READ_WRITE_TOKEN` | Vercel Blob RW 토큰이 미설정 → 대시보드에서 발급 후 환경 변수 추가 |
| `Error: ADMIN_JWT_SECRET` | 관리자 JWT 비밀키 미설정 → `.env.local` 또는 Vercel 환경 변수에 추가 |
| 데이터가 사라짐 | 인메모리 저장소 특성상 함수 재시작 시 초기화 → 별도 백업/DB 연동 필요 |
| 이미지 미리보기 실패 | Blob 접근 권한 확인 (기본 `public`로 업로드), URL 차단 여부 확인 |
| 등록 시 500 오류 | Vercel Functions 로그 확인 → Blob/DB 토큰, IP 리스트, 요청 본문 검증 |

---
배포/운영 중 궁금한 점이 있으면 언제든 질문해주세요. Vercel 외의 인프라(AWS Lambda, Render 등)로 옮길 때도 동일한 구조를 응용할 수 있습니다.

cd C:\Users\82104\bangguy
   npm run dev
   http://localhost:3000
   http://localhost:3000/index.html
   http://localhost:3000/admin.html

   