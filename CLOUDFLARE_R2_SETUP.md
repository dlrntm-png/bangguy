# Cloudflare R2 마이그레이션 가이드

## 개요

Vercel Blob 사용량 초과로 인해 Cloudflare R2로 마이그레이션합니다.

## Cloudflare R2 장점

1. **완전 무료 플랜**: 10GB 스토리지, 무료 아웃바운드 트래픽
2. **S3 호환 API**: AWS S3와 동일한 API 사용
3. **빠른 속도**: Cloudflare 글로벌 네트워크
4. **사용량 제한 없음**: 무료 플랜에서도 제한 없음

## 사용자가 해야 할 작업

### 1단계: Cloudflare R2 버킷 생성

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. 왼쪽 메뉴에서 "R2" 클릭
3. "Create bucket" 클릭
4. 버킷 이름 입력: `bangguy-storage` (또는 원하는 이름)
5. "Create bucket" 클릭

### 2단계: R2 API 토큰 생성

1. R2 대시보드에서 "Manage R2 API Tokens" 클릭
2. "Create API token" 클릭
3. 설정:
   - **Token name**: `bangguy-r2-token`
   - **Permissions**: `Object Read & Write`
   - **TTL**: `No expiration` (또는 원하는 만료 시간)
4. "Create API Token" 클릭
5. **중요**: 다음 정보를 복사해두세요:
   - `Access Key ID`
   - `Secret Access Key`

### 3단계: R2 커스텀 도메인 설정 (선택, 권장)

1. R2 버킷 → "Settings" 탭
2. "Public access" 섹션에서 "Allow Access" 활성화
3. "Custom Domain" 섹션에서 도메인 추가 (선택)
   - 예: `storage.yourdomain.com`
   - 또는 R2 기본 도메인 사용 가능

### 4단계: Render 환경 변수 설정

Render 대시보드 → 프로젝트 → "Environment"에서 다음 변수 추가:

**필수 환경 변수:**
```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=bangguy-storage
```

**선택 환경 변수:**
```
R2_PUBLIC_DOMAIN=storage.yourdomain.com  # 커스텀 도메인이 있는 경우
R2_REGION=auto  # 기본값: auto
```

**기존 Vercel Blob 변수 제거:**
- `BLOB_READ_WRITE_TOKEN` (더 이상 필요 없음)

### 5단계: Cloudflare Account ID 확인

1. Cloudflare 대시보드 → 오른쪽 사이드바
2. "Account ID" 복사
3. `R2_ACCOUNT_ID` 환경 변수에 설정

## 환경 변수 요약

### 제거할 변수
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

### 추가할 변수
- `R2_ACCOUNT_ID` (필수)
- `R2_ACCESS_KEY_ID` (필수)
- `R2_SECRET_ACCESS_KEY` (필수)
- `R2_BUCKET_NAME` (필수)
- `R2_PUBLIC_DOMAIN` (선택, 커스텀 도메인)
- `R2_REGION` (선택, 기본값: auto)

## 코드 변경 사항

- ✅ `lib/blob.js`: Vercel Blob → Cloudflare R2 (S3 API)로 완전 교체
- ✅ `package.json`: `@vercel/blob` → `@aws-sdk/client-s3` 변경
- ✅ 모든 Blob 함수 유지 (API 호환성 유지)

## 테스트

1. Render 재배포 완료 대기
2. 사용자 페이지에서 사진 업로드 테스트
3. 관리자 페이지에서 사진 확인
4. 사진 삭제 테스트

## 비용

- **Cloudflare R2 무료 플랜**:
  - 스토리지: 10GB 무료
  - 아웃바운드 트래픽: 무료
  - Class A Operations: 1백만/월 무료
  - Class B Operations: 1천만/월 무료

## 문제 해결

### 오류: "R2_ACCESS_KEY_ID 환경변수가 필요합니다"
- 환경 변수가 설정되지 않았습니다
- Render 대시보드에서 환경 변수 확인

### 오류: "Access Denied"
- R2 API 토큰 권한 확인
- "Object Read & Write" 권한이 있는지 확인

### 이미지가 표시되지 않음
- `R2_PUBLIC_DOMAIN` 설정 확인
- 또는 커스텀 도메인 설정 확인

---

**작업 완료 후 확인 사항:**
- [ ] Cloudflare R2 버킷 생성 완료
- [ ] R2 API 토큰 생성 완료
- [ ] Render 환경 변수 모두 설정 완료
- [ ] 기존 `BLOB_READ_WRITE_TOKEN` 제거
- [ ] 재배포 완료
- [ ] 사진 업로드/다운로드 테스트 완료

