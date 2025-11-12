# Render Start Command 수정 가이드

## 문제

로그에서 확인된 문제:
```
==> Running 'npm run start'
> next start
```

**문제:** Next.js 서버가 실행되고 있음 (우리가 원하는 건 Express 서버)

## 해결 방법

### Render 대시보드에서 Start Command 수정

1. **Render 대시보드 접속**
   - https://dashboard.render.com

2. **프로젝트 선택**
   - 배포한 프로젝트 클릭

3. **Settings 탭 클릭**
   - 왼쪽 메뉴에서 "Settings" 클릭

4. **Build & Deploy 섹션 찾기**
   - 스크롤하여 "Build & Deploy" 섹션 찾기

5. **Start Command 수정**
   - "Start Command" 필드 찾기
   - 현재 값: `npm run start` (또는 `next start`)
   - **변경할 값:** `npm run start:server`
   - "Save Changes" 클릭

6. **자동 재배포**
   - 변경사항 저장 시 자동으로 재배포 시작
   - 로그에서 Express 서버 시작 확인

## 확인

재배포 후 로그에서 다음 메시지가 보여야 합니다:

**정상:**
```
🚀 Server running on port 10000
📁 Static files: /opt/render/project/src/public
🌐 Environment: production
```

**오류 (Next.js):**
```
▲ Next.js 14.2.33
- Local:        http://localhost:10000
```

## Vercel Blob 사용량 초과 관련

### 질문: Vercel Blob 사용량 초과면 변경해야 하나요?

**답변: 아니요, 변경할 필요 없습니다.**

**이유:**
1. **Vercel Blob은 독립적인 서비스**
   - Render 배포와 무관
   - Render에서도 Vercel Blob 계속 사용 가능

2. **사용량 초과는 Vercel Blob의 문제**
   - Vercel Blob 무료 플랜 제한
   - Render로 마이그레이션해도 해결되지 않음

3. **해결 방법:**
   - **옵션 1:** Vercel Blob Pro 플랜 업그레이드
   - **옵션 2:** 다른 Blob 스토리지로 마이그레이션
     - AWS S3
     - Cloudflare R2
     - Google Cloud Storage
   - **옵션 3:** 사용량 모니터링 및 정리

### Vercel Blob 사용량 확인

1. Vercel 대시보드 → 프로젝트
2. Storage → Blob
3. 사용량 확인

### Vercel Blob 대안 (필요시)

사용량 초과로 문제가 발생하면 다음으로 마이그레이션 가능:
- AWS S3 (무료 플랜: 5GB)
- Cloudflare R2 (무료 플랜: 10GB)
- Google Cloud Storage (무료 플랜: 5GB)

하지만 현재는 Render 배포가 우선입니다.

## 체크리스트

- [ ] Render 대시보드 접속
- [ ] 프로젝트 → Settings
- [ ] Start Command를 `npm run start:server`로 변경
- [ ] Save Changes 클릭
- [ ] 재배포 완료 대기
- [ ] 로그에서 Express 서버 시작 확인

---

**다음 단계:**
1. Render Start Command 수정
2. 재배포 완료 대기
3. 서버 정상 작동 확인

