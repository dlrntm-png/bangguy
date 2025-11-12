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
  console.log('🗑️  전체 기록 삭제 스크립트');
  console.log('='.repeat(50));
  
  // 관리자 비밀번호 입력 (환경 변수 또는 명령줄 인자 또는 입력)
  let password = process.env.ADMIN_PASSWORD || process.argv[2];
  
  if (!password) {
    password = await question('관리자 비밀번호를 입력하세요: ');
  }
  
  if (!password) {
    console.log('❌ 비밀번호가 입력되지 않았습니다.');
    console.log('   사용법: node scripts/delete-all-records.js [비밀번호]');
    console.log('   또는: ADMIN_PASSWORD=비밀번호 node scripts/delete-all-records.js');
    rl.close();
    return;
  }

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
  console.log('⚠️  경고: 모든 기록과 파일이 삭제됩니다!');
  const confirm = await question('정말로 전체 삭제를 진행하시겠습니까? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ 삭제가 취소되었습니다.');
    rl.close();
    return;
  }

  console.log('\n🗑️  전체 삭제 진행 중...');
  
  // 전체 삭제
  const deleteResult = await makeRequest(`${BASE_URL}/api/admin/delete-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: { deleteAll: true }
  });

  if (deleteResult.status === 200 && deleteResult.data.ok) {
    console.log('✅ 전체 삭제 완료!');
    console.log(`   - 삭제된 기록: ${deleteResult.data.deleted}건`);
    console.log(`   - 삭제된 파일: ${deleteResult.data.deletedFiles}개`);
  } else {
    console.log('❌ 삭제 실패:', deleteResult.data.message || '알 수 없는 오류');
  }

  rl.close();
}

main().catch((err) => {
  console.error('❌ 오류 발생:', err.message);
  rl.close();
  process.exit(1);
});

