# 출퇴근 인증 시스템 (Next.js + Vercel)

사번, 이름, 사진을 기반으로 출퇴근을 기록하고, 요청자의 공인 IP가 사내망에 속하는지 판정하는 시스템입니다. 기존 Express 서버 구조를 Vercel에서 동작하도록 전면 개편하여 **서버리스 함수 + Vercel Postgres + Vercel Blob** 조합으로 동작합니다.

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

## 기술 스택
- **Frontend**: 정적 HTML (`public/index.html`, `public/admin.html`)
- **Backend**: Next.js API Routes (서버리스 함수)
- **Storage**: Vercel Postgres (메타데이터), Vercel Blob (이미지 파일)
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
| `ADMIN_JWT_SECRET` | 관리자 JWT 서명용 시크릿 문자열 (임의의 긴 문자열)
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 프로젝트에서 발급한 Read/Write 토큰 |
| `POSTGRES_URL` | Vercel Postgres 연결 문자열 (예: Vercel Dashboard에서 발급) |

> **로컬 개발 시** Vercel Postgres/Blob 대신 Supabase, R2, S3 등을 사용하고 싶다면 `lib/` 내부 헬퍼를 교체하면 됩니다.

## 로컬 개발
```bash
npm install
npm run dev
```

- 개발 서버: `http://localhost:3000`
- 사용자 페이지: `/` → 현재 IP/사내망 여부 + 출퇴근 등록
- 관리자 페이지: `/admin.html`
- API 로그는 터미널(서버리스 함수 실행 시 콘솔)에서 확인

## Vercel 배포 절차
1. **Repository 연결**: `dlrntm-png/bangguy` 저장소를 Vercel 프로젝트에 연결합니다.
2. **Environment Variables 설정**
   - `OFFICE_IPS`
   - `ADMIN_PASSWORD`
   - `ADMIN_JWT_SECRET`
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob 대시보드에서 발급)
   - `POSTGRES_URL` (Vercel Postgres 추가 후 Connection String 사용)
3. **Blob & Postgres 연결**
   - Vercel Dashboard → Storage → Blob / Postgres에서 신규 인스턴스 생성
   - 생성 시 `Read/Write Token`, `POSTGRES_URL`을 환경 변수에 복사
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
- **Postgres 백업**: Vercel Postgres는 자동 백업을 제공하지만, 주기적 CSV 다운로드를 권장
- **보안**: `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`은 강력한 값으로 설정하고 주기적으로 교체
- **IP 화이트리스트**: 사내 IP 대역 변경 시 `OFFICE_IPS` 환경 변수를 업데이트 후 재배포

## 마이그레이션 참고 (이전 Express 버전 → Vercel 버전)
- 로컬 디스크에 저장하던 업로드 파일 → Vercel Blob
- CSV 기반 기록 관리 → Postgres 테이블 보관
- Express 서버 → Next.js API Routes (자동 확장 & 서버리스 실행)
- 관리자 토큰 메모리 저장 → JWT 기반(멱등), 서버리스 환경에서도 유지

## Troubleshooting
| 증상 | 해결 방법 |
| --- | --- |
| `Error: BLOB_READ_WRITE_TOKEN` | Vercel Blob RW 토큰이 미설정 → 대시보드에서 발급 후 환경 변수 추가 |
| `Error: ADMIN_JWT_SECRET` | 관리자 JWT 비밀키 미설정 → `.env.local` 또는 Vercel 환경 변수에 추가 |
| `ETIMEDOUT` / DB 연결 오류 | `POSTGRES_URL` 오타, 권한 문제, Vercel Postgres 인스턴스 상태 확인 |
| 이미지 미리보기 실패 | Blob 접근 권한 확인 (기본 `public`로 업로드), URL 차단 여부 확인 |
| 등록 시 500 오류 | Vercel Functions 로그 확인 → Blob/DB 토큰, IP 리스트, 요청 본문 검증 |

---
배포/운영 중 궁금한 점이 있으면 언제든 질문해주세요. Vercel 외의 인프라(AWS Lambda, Render 등)로 옮길 때도 동일한 구조를 응용할 수 있습니다.