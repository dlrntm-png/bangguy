const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Artillery와 동일한 방식으로 요청 생성
const BASE_URL = process.env.BASE_URL || 'https://bangguy.vercel.app';
const photoPath = path.resolve(__dirname, 'assets', 'photo1.jpg');

if (!fs.existsSync(photoPath)) {
  console.error('❌ 테스트 이미지가 없습니다:', photoPath);
  process.exit(1);
}

// Artillery processor.js와 동일한 방식으로 데이터 생성
const crypto = require('crypto');
const uniqueId = String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
const deviceId = `dev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
const employeeName = '테스트사용자';

console.log('📤 Artillery 형식으로 요청 전송 중...');
console.log('employeeId:', uniqueId);
console.log('name:', employeeName);
console.log('deviceId:', deviceId);
console.log('photo:', photoPath);

const form = new FormData();
form.append('employeeId', uniqueId);
form.append('name', employeeName);
form.append('deviceId', deviceId);
form.append('photo', fs.createReadStream(photoPath), {
  filename: 'loadtest-photo.jpg',
  contentType: 'image/jpeg'
});

const url = new URL(`${BASE_URL}/api/attend/register`);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    ...form.getHeaders(),
    'X-Load-Test': 'true',
    'User-Agent': 'bangguy-loadtest'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📥 응답 수신:');
    console.log('Status:', res.statusCode);
    
    try {
      const json = JSON.parse(data);
      console.log('\n📋 응답 본문:');
      console.log(JSON.stringify(json, null, 2));
      
      if (json.ok) {
        console.log('\n✅ 성공!');
      } else {
        console.log('\n❌ 실패:');
        console.log('  - reason:', json.reason || '(없음)');
        console.log('  - error:', json.error || '(없음)');
        console.log('  - message:', json.message || '(없음)');
      }
    } catch (e) {
      console.log('\n⚠️ JSON 파싱 실패:');
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 요청 오류:', e.message);
});

form.pipe(req);

