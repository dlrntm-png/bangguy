// Vercel Blob SDK를 직접 사용하여 모든 Blob 삭제
const { list, del } = require('@vercel/blob');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.log('   Vercel 대시보드에서 토큰을 확인하거나 .env.local에 설정하세요.');
  process.exit(1);
}

async function deleteAllBlobs() {
  console.log('🗑️  모든 Blob 파일 삭제 시작...\n');

  try {
    // 모든 Blob 나열
    console.log('📋 Blob 파일 목록 조회 중...');
    let cursor;
    const allBlobs = [];
    
    do {
      const result = await list({ token: BLOB_TOKEN, cursor });
      allBlobs.push(...result.blobs);
      cursor = result.cursor;
      console.log(`   발견된 Blob: ${allBlobs.length}개...`);
    } while (cursor);

    if (allBlobs.length === 0) {
      console.log('✅ 삭제할 Blob이 없습니다.');
      return;
    }

    console.log(`\n📊 총 ${allBlobs.length}개의 Blob 파일을 삭제합니다.\n`);

    // 병렬 처리로 속도 향상 (동시 요청 수 제한)
    const CONCURRENT_LIMIT = 50; // 동시에 처리할 최대 요청 수 (Rate limit 자동 처리)
    let deleted = 0;
    let failed = 0;
    const errors = [];
    const failedBlobs = []; // 재시도용

    // 오류 메시지에서 대기 시간 추출
    function extractWaitTime(errorMessage) {
      const match = errorMessage.match(/try again in (\d+) seconds?/i);
      if (match) {
        return parseInt(match[1], 10) * 1000; // 밀리초로 변환
      }
      return 3000; // 기본 3초
    }

    // Rate limit 공유 변수 (모든 워커가 공유)
    let globalRateLimitUntil = 0;
    let rateLimitLock = false;

    // 삭제 함수 (재시도 포함, rate limit 처리)
    async function deleteBlobWithRetry(pathname, retries = 5) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        // Rate limit 대기 시간 확인 (전역 공유)
        const now = Date.now();
        if (globalRateLimitUntil > now) {
          const waitTime = globalRateLimitUntil - now;
          // 다른 워커가 이미 대기 중이면 추가 대기 시간 줄임
          if (!rateLimitLock) {
            rateLimitLock = true;
            console.log(`   ⏳ Rate limit 대기 중... ${Math.ceil(waitTime / 1000)}초 남음`);
            rateLimitLock = false;
          }
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
          await del(pathname, { token: BLOB_TOKEN });
          return { success: true };
        } catch (err) {
          const errorMsg = err.message || String(err);
          
          // Rate limit 오류인 경우 메시지에서 대기 시간 추출
          if (errorMsg.includes('Too many requests') || errorMsg.includes('rate limit')) {
            const waitTime = extractWaitTime(errorMsg);
            const newWaitUntil = Date.now() + waitTime + 1000;
            // 전역 대기 시간 업데이트 (더 긴 시간으로)
            if (newWaitUntil > globalRateLimitUntil) {
              globalRateLimitUntil = newWaitUntil;
              if (!rateLimitLock) {
                rateLimitLock = true;
                console.log(`   ⚠️  Rate limit 도달! ${Math.ceil(waitTime / 1000)}초 대기 후 재시도...`);
                rateLimitLock = false;
              }
            }
            
            if (attempt < retries) {
              // 전역 대기 시간만큼 대기
              const actualWait = globalRateLimitUntil - Date.now();
              if (actualWait > 0) {
                await new Promise(resolve => setTimeout(resolve, actualWait));
              }
              continue; // 재시도
            }
          }
          
          if (attempt === retries) {
            return {
              success: false,
              error: errorMsg,
              status: err.status || err.statusCode,
              code: err.code
            };
          }
          
          // 일반 재시도 전 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
      }
    }

    // 동시성 제한을 위한 큐 처리
    const startTime = Date.now();
    async function processWithConcurrencyLimit(blobs, limit, isRetry = false) {
      const results = [];
      let currentIndex = 0;
      let processedCount = 0;

      async function processNext() {
        while (currentIndex < blobs.length) {
          const index = currentIndex++;
          const blob = blobs[index];
          
          const result = await deleteBlobWithRetry(blob.pathname);
          results[index] = { blob, result };
          processedCount++;
          
          if (!isRetry) {
            // 첫 시도만 카운팅
            if (result.success) {
              deleted++;
            } else {
              failed++;
              errors.push({
                pathname: blob.pathname,
                error: result.error,
                status: result.status,
                code: result.code
              });
              failedBlobs.push(blob);
            }
          }
          
          // 진행 상황 출력 (100개마다, 더 빠른 출력)
          if (processedCount % 100 === 0 || processedCount === blobs.length) {
            if (isRetry) {
              console.log(`   재시도 진행: ${processedCount}/${blobs.length}`);
            } else {
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const rate = (processedCount / (elapsed || 1)).toFixed(1);
              const remaining = Math.ceil((blobs.length - processedCount) / (rate || 1));
              console.log(`   진행: ${processedCount}/${blobs.length} (성공: ${deleted}, 실패: ${failed}) | 속도: ${rate}개/초 | 예상 남은 시간: ${remaining}초`);
            }
          }
        }
      }

      // 동시에 limit 개수만큼 처리
      const workers = Array(limit).fill().map(() => processNext());
      await Promise.all(workers);
      
      return results;
    }

    console.log(`🚀 병렬 처리 시작 (동시 ${CONCURRENT_LIMIT}개 요청)...\n`);
    await processWithConcurrencyLimit(allBlobs, CONCURRENT_LIMIT, false);

    // 실패한 파일 재시도 (Rate limit 오류만)
    const rateLimitErrors = failedBlobs.filter((blob) => {
      const error = errors.find(e => e.pathname === blob.pathname);
      return error && error.error.includes('Too many requests');
    });
    
    if (rateLimitErrors.length > 0) {
      console.log(`\n🔄 Rate limit로 실패한 ${rateLimitErrors.length}개 파일 재시도 중...`);
      console.log(`   (5초 대기 후 시작)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 재시도도 병렬 처리
      const retryResults = await processWithConcurrencyLimit(rateLimitErrors, CONCURRENT_LIMIT, true);
      
      let retryDeleted = 0;
      const stillFailed = [];
      
      retryResults.forEach(({ blob, result }) => {
        if (result.success) {
          retryDeleted++;
          deleted++;
          failed--;
          // 실패 목록에서 제거
          const errorIdx = errors.findIndex(e => e.pathname === blob.pathname);
          if (errorIdx >= 0) errors.splice(errorIdx, 1);
          const blobIdx = failedBlobs.findIndex(b => b.pathname === blob.pathname);
          if (blobIdx >= 0) failedBlobs.splice(blobIdx, 1);
        } else {
          stillFailed.push(blob);
        }
      });
      
      if (retryDeleted > 0) {
        console.log(`   ✅ 재시도로 ${retryDeleted}개 추가 삭제 성공`);
      }
      if (stillFailed.length > 0) {
        console.log(`   ⚠️  ${stillFailed.length}개 파일은 여전히 삭제 실패`);
      }
    }

    console.log('\n✅ 삭제 완료!');
    console.log(`   - 총 Blob 수: ${allBlobs.length}개`);
    console.log(`   - 삭제된 파일: ${deleted}개`);
    if (failed > 0) {
      console.log(`   - 실패한 파일: ${failed}개`);
      if (errors.length > 0) {
        console.log('\n   실패한 파일 상세 정보 (최대 20개):');
        errors.slice(0, 20).forEach((err, idx) => {
          console.log(`   ${idx + 1}. ${err.pathname}`);
          console.log(`      오류: ${err.error}`);
          if (err.status) console.log(`      상태: ${err.status}`);
          if (err.code) console.log(`      코드: ${err.code}`);
        });
        if (errors.length > 20) {
          console.log(`   ... 외 ${errors.length - 20}개 더`);
        }
      }
    }
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    console.error(err);
    process.exit(1);
  }
}

deleteAllBlobs();

