# Render Bad Gateway 에러 해결 가이드

## 증상
- "Bad Gateway" 에러 메시지
- 서버가 응답하지 않음
- Request ID 표시됨

## 원인 분석

Bad Gateway는 보통 다음 중 하나입니다:

1. **서버가 시작되지 않음**
   - 의존성 설치 실패
   - 코드 오류로 인한 크래시
   - 환경 변수 누락

2. **서버가 시작 중**
   - 배포가 아직 완료되지 않음
   - 첫 시작 시 시간 소요

3. **포트 바인딩 실패**
   - PORT 환경 변수 문제
   - 포트 충돌

## 해결 방법

### 1단계: Render 로그 확인 (가장 중요!)

1. Render 대시보드 접속
2. 프로젝트 선택
3. **"Logs" 탭 클릭**
4. 로그 확인

**정상적인 경우:**
```
🚀 Server running on port 10000
📁 Static files: /opt/render/project/src/public
🌐 Environment: production
```

**오류가 있는 경우:**
- 에러 메시지 확인
- 어떤 모듈을 찾을 수 없는지
- 환경 변수 관련 오류인지

### 2단계: 일반적인 오류와 해결

#### 오류 1: "Cannot find module"
**로그 예시:**
```
Error: Cannot find module 'express'
```

**해결:**
- `package.json`에 의존성이 있는지 확인
- Render가 `npm install`을 실행했는지 확인
- `render.yaml`의 `buildCommand` 확인

#### 오류 2: "POSTGRES_URL is required"
**로그 예시:**
```
Error: POSTGRES_URL 환경변수가 설정되지 않았습니다.
```

**해결:**
1. Render 대시보드 → 프로젝트 → "Environment"
2. `POSTGRES_URL` 환경 변수 추가
3. 값 확인 (Neon 데이터베이스 연결 문자열)

#### 오류 3: "SyntaxError: Unexpected token"
**로그 예시:**
```
SyntaxError: Unexpected token 'export'
```

**해결:**
- `package.json`에 `"type": "module"`이 있는지 확인
- 모든 파일이 ESM 형식인지 확인

#### 오류 4: "Port already in use"
**해결:**
- Render는 자동으로 PORT 환경 변수를 설정
- 코드에서 `process.env.PORT || 3000` 사용 확인

### 3단계: 환경 변수 확인

Render 대시보드 → 프로젝트 → "Environment"에서 다음 변수들이 모두 설정되어 있는지 확인:

**필수:**
- [ ] `POSTGRES_URL`
- [ ] `BLOB_READ_WRITE_TOKEN`
- [ ] `ADMIN_PASSWORD_HASH`
- [ ] `ADMIN_JWT_SECRET`
- [ ] `OFFICE_IPS`

**선택:**
- [ ] `POSTGRES_SSL` (기본값: `require`)
- [ ] `NODE_ENV` (기본값: `production`)

### 4단계: 서버 재시작

1. Render 대시보드 → 프로젝트
2. "Manual Deploy" → "Deploy latest commit" 클릭
3. 재배포 진행 상황 확인
4. 로그에서 오류 확인

### 5단계: 로컬 테스트

로컬에서 서버가 정상 작동하는지 확인:

```bash
npm run dev:server
```

**예상 출력:**
```
🚀 Server running on port 3000
📁 Static files: C:\Users\82104\bangguy\public
🌐 Environment: development
```

로컬에서도 오류가 발생하면 코드 문제입니다.

## 체크리스트

- [ ] Render 로그 확인 완료
- [ ] 에러 메시지 확인
- [ ] 환경 변수 모두 설정 확인
- [ ] `package.json`의 `"type": "module"` 확인
- [ ] 로컬에서 서버 테스트 완료
- [ ] 서버 재시작 시도

## Render 로그 확인 방법

1. **대시보드 접속**
   - https://dashboard.render.com

2. **프로젝트 선택**
   - 배포한 프로젝트 클릭

3. **Logs 탭**
   - 왼쪽 메뉴에서 "Logs" 클릭
   - 실시간 로그 확인

4. **에러 찾기**
   - 빨간색 에러 메시지 찾기
   - 스크롤하여 최신 로그 확인

## 로그 공유

문제가 계속되면 Render 로그의 에러 메시지를 복사해서 공유해주세요:
- 에러 메시지 전체
- 마지막 20-30줄의 로그
- 환경 변수 이름 (값은 제외)

---

**다음 단계:**
1. Render 로그 확인
2. 에러 메시지 확인
3. 위의 해결 방법 시도

