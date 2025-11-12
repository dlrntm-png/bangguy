const https = require('https');
const readline = require('readline');

const BASE_URL = process.env.BASE_URL || 'https://bangguy.vercel.app';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function main() {
  console.log('🗑️  모든 Blob 파일 삭제 스크립트');
  console.log('='.repeat(50));
  console.log('⚠️  경고: 이 작업은 모든 Blob 파일을 삭제합니다!');
  console.log('   데이터베이스 레코드와 무관하게 모든 파일이 삭제됩니다.\n');
  
  // 관리자 비밀번호 입력
  let password = process.env.ADMIN_PASSWORD || process.argv[2];
  
  if (!password) {
    password = await question('관리자 비밀번호를 입력하세요: ');
  }
  
  if (!password) {
    console.log('❌ 비밀번호가 입력되지 않았습니다.');
    console.log('   사용법: node scripts/delete-all-blobs.js [비밀번호]');
    console.log('   또는: ADMIN_PASSWORD=비밀번호 node scripts/delete-all-blobs.js');
    rl.close();
    return;
  }

  // prefix 옵션
  const prefix = process.argv[3] || await question('삭제할 Blob의 prefix를 입력하세요 (전체 삭제는 Enter): ');

  console.log('\n📡 관리자 로그인 중...');
  
  // 로그인
  const loginResult = await makeRequest(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: { password }
  });

  if (loginResult.status !== 200 || !loginResult.data.ok) {
    console.log('❌ 로그인 실패:', loginResult.data.message || '알 수 없는 오류');
    rl.close();
    return;
  }

  const token = loginResult.data.token;
  console.log('✅ 로그인 성공\n');

  // 확인
  console.log('⚠️  경고: 모든 Blob 파일이 삭제됩니다!');
  if (prefix) {
    console.log(`   Prefix: "${prefix}"로 시작하는 파일만 삭제됩니다.`);
  } else {
    console.log('   모든 Blob 파일이 삭제됩니다.');
  }
  const confirm = await question('\n정말로 삭제를 진행하시겠습니까? (DELETE_ALL_BLOBS 입력): ');
  
  if (confirm !== 'DELETE_ALL_BLOBS') {
    console.log('❌ 삭제가 취소되었습니다.');
    rl.close();
    return;
  }

  console.log('\n🗑️  Blob 삭제 진행 중...');
  console.log('   이 작업은 시간이 걸릴 수 있습니다...\n');
  
  // Blob 삭제
  const deleteResult = await makeRequest(`${BASE_URL}/api/admin/delete-all-blobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: {
      prefix: prefix || undefined,
      confirm: 'DELETE_ALL_BLOBS'
    }
  });

  console.log(`\n📊 응답 상태 코드: ${deleteResult.status}`);
  console.log(`📋 응답 데이터:`, JSON.stringify(deleteResult.data, null, 2));

  if (deleteResult.status === 200 && deleteResult.data.ok) {
    console.log('\n✅ Blob 삭제 완료!');
    console.log(`   - 총 Blob 수: ${deleteResult.data.total}개`);
    console.log(`   - 삭제된 파일: ${deleteResult.data.deleted}개`);
    if (deleteResult.data.failed > 0) {
      console.log(`   - 실패한 파일: ${deleteResult.data.failed}개`);
      if (deleteResult.data.errors && deleteResult.data.errors.length > 0) {
        console.log('\n   실패한 파일 목록 (최대 10개):');
        deleteResult.data.errors.forEach((err, idx) => {
          console.log(`   ${idx + 1}. ${err.pathname}: ${err.error}`);
        });
      }
    }
  } else {
    console.log('\n❌ 삭제 실패');
    console.log(`   상태 코드: ${deleteResult.status}`);
    console.log(`   메시지: ${deleteResult.data.message || '알 수 없는 오류'}`);
    if (deleteResult.data.error) {
      console.log(`   오류 상세: ${deleteResult.data.error}`);
    }
    if (deleteResult.data) {
      console.log(`   전체 응답:`, JSON.stringify(deleteResult.data, null, 2));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('❌ 오류 발생:', err.message);
  rl.close();
  process.exit(1);
});

