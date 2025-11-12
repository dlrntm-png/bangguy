# Render Bad Gateway 빠른 해결

## 즉시 확인할 사항

### 1. Render 로그 확인 (필수!)

1. Render 대시보드 → 프로젝트 선택
2. **"Logs" 탭 클릭**
3. 에러 메시지 확인

**정상 로그:**
```
🚀 Server running on port 10000
```

**오류 로그 예시:**
- `Error: Cannot find module`
- `POSTGRES_URL 환경변수가 설정되지 않았습니다`
- `SyntaxError`

### 2. 환경 변수 확인

Render 대시보드 → 프로젝트 → "Environment"에서:

**필수 5개 확인:**
- `POSTGRES_URL` ✅
- `BLOB_READ_WRITE_TOKEN` ✅
- `ADMIN_PASSWORD_HASH` ✅
- `ADMIN_JWT_SECRET` ✅
- `OFFICE_IPS` ✅

### 3. 서버 재시작

1. Render 대시보드 → 프로젝트
2. "Manual Deploy" → "Deploy latest commit"
3. 로그에서 오류 확인

## 가장 흔한 원인

### 원인 1: 환경 변수 누락
**해결:** 모든 필수 환경 변수 추가

### 원인 2: 의존성 설치 실패
**해결:** 
- `package.json` 확인
- `render.yaml`의 `buildCommand` 확인

### 원인 3: 서버 시작 오류
**해결:** 로그에서 정확한 에러 메시지 확인

## 다음 단계

1. **Render 로그 확인** (가장 중요!)
2. 에러 메시지 복사
3. 위의 해결 방법 시도

로그의 에러 메시지를 알려주시면 더 정확히 도와드릴 수 있습니다!

