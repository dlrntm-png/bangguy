## Artillery 부하 테스트 가이드

> ⚠️ 운영 트래픽에 직접 영향을 줄 수 있으니, 반드시 테스트 전 관계자에게 공유하고 모니터링을 준비하세요.

### 1. 환경 준비

1. **Artillery 설치**
   ```bash
   npm install -g artillery
   ```
2. **테스트 자산 준비**
   - `tests/load/assets/` 폴더를 만들고, 1MB 이하의 테스트용 셀피 이미지를 최소 3개 넣어주세요.
   - 파일명은 `photo1.jpg`, `photo2.jpg`, `photo3.jpg`와 같이 맞춰 주세요. (다른 이름을 쓰려면 `processor.js`의 `PHOTOS` 배열을 수정해야 합니다.)
3. **환경 변수 설정**
   
   **로컬 테스트 환경 변수** (Artillery 실행 시):
   - `BASE_URL`: 테스트할 배포 주소. 예) `https://bangguy.vercel.app`
   - `ADMIN_TOKEN`: `/api/admin/login`으로 발급한 JWT.
   - (선택) `ADMIN_QUERY_MONTH`: 관리자 조회 테스트에서 사용할 월(기본값은 현재 월).

   **Vercel 환경 변수** (부하 테스트를 위해 반드시 설정):
   - `ALLOW_LOAD_TEST`: `true`로 설정하면 `X-Load-Test: true` 헤더가 있는 요청은 IP 화이트리스트 체크를 우회합니다.
     - ⚠️ **보안 주의**: 이 변수를 `true`로 설정하면 외부에서도 IP 체크 없이 등록이 가능하므로, 테스트 후 반드시 `false`로 되돌리거나 삭제하세요.

   로컬 환경 변수는 아래와 같이 PowerShell/CMD에서 설정합니다:

   ```powershell
   # PowerShell
   $env:BASE_URL = "https://bangguy.vercel.app"
   $env:ADMIN_TOKEN = "ey..."
   $env:ADMIN_QUERY_MONTH = "2025-11"
   ```

   ```cmd
   # CMD
   set BASE_URL=https://bangguy.vercel.app
   set ADMIN_TOKEN=ey...
   set ADMIN_QUERY_MONTH=2025-11
   ```

### 2. 사용자 등록 API 테스트

```bash
artillery run tests/load/register.yml
```

- **시나리오**: 초당 10명 → 20명 → 30명 단계적으로 6분간 요청
- **내용**: 무작위 사번·이름·기기 ID, 준비한 이미지 파일로 `/api/attend/register`를 호출
- **결과 해석**: `latency`, `errors` 항목을 확인하고, 테스트 시간대에 Vercel Functions / Neon Metrics에서 에러 및 커넥션 수를 모니터링하세요.

### 3. 관리자 기록 조회 테스트

```bash
artillery run tests/load/admin-records.yml
```

- **시나리오**: 초당 5명 → 15명, 총 3분
- **내용**: `/api/admin/records?month=YYYY-MM` 호출 (월은 `ADMIN_QUERY_MONTH`로 제어)
- **필수**: `ADMIN_TOKEN` 환경 변수를 반드시 설정하세요.

### 4. 모니터링 체크리스트

| 구분 | 확인 위치 | 주의할 지표 |
| --- | --- | --- |
| Neon DB | Neon Console → Metrics | Active Connections, CPU, 오류 |
| Vercel | Vercel → Analytics → Functions | Duration, Error rate, Throttling |
| 프런트 | Chrome DevTools Network | 이미지 다운로드 지연, 응답 사이즈 |

### 5. 테스트 강도 조절

- `register.yml` / `admin-records.yml` 의 `phases` 값(`duration`, `arrivalRate`)을 수정하면 테스트 강도를 쉽게 바꿀 수 있습니다.
- 더 짧거나 긴 테스트를 하고 싶으면 `warmup`, `stress` 단계를 추가/제거하면 됩니다.

### 6. 참고 사항

- 테스트는 실제 사용량에 맞춰 이미지, 사번, 이름 데이터를 조정하세요.
- 같은 이미지를 계속 사용하면 중복 이미지 검사(DUPLICATE_PHOTO)에 걸릴 수 있으므로 테스트용 이미지는 다양하게 준비하세요.
- 필요 시 Vercel의 Preview 환경이나 Neon 브랜치를 만들어 별도 환경에서 먼저 부하 테스트를 진행하는 것을 권장합니다.

