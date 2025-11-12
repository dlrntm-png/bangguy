const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'https://bangguy.vercel.app';
const photoPath = path.resolve(__dirname, 'assets', 'photo1.jpg');

if (!fs.existsSync(photoPath)) {
  console.error('❌ 테스트 이미지가 없습니다:', photoPath);
  console.log('tests/load/assets/photo1.jpg 파일을 준비해주세요.');
  process.exit(1);
}

const form = new FormData();
form.append('employeeId', '170200');
form.append('name', '테스트사용자');
form.append('deviceId', `dev_${Date.now()}_test`);
form.append('photo', fs.createReadStream(photoPath), {
  filename: 'test-photo.jpg',
  contentType: 'image/jpeg'
});

const url = new URL(`${BASE_URL}/api/attend/register`);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    ...form.getHeaders(),
    'X-Load-Test': 'true'
  }
};

console.log('📤 요청 전송 중...');
console.log('URL:', BASE_URL + '/api/attend/register');
console.log('Headers:', options.headers);
console.log('Form fields:', {
  employeeId: '170200',
  name: '테스트사용자',
  deviceId: 'dev_..._test',
  photo: photoPath
});

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📥 응답 수신:');
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
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

