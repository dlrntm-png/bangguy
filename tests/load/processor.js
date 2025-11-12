const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const FormData = require('form-data');
const fs = require('fs');

const PHOTOS = [
  'tests/load/assets/photo1.jpg',
  'tests/load/assets/photo2.jpg',
  'tests/load/assets/photo3.jpg'
];

function pickPhoto() {
  const idx = Math.floor(Math.random() * PHOTOS.length);
  return path.resolve(PHOTOS[idx]);
}

function sendRegisterRequest(userContext, events, done) {
  const BASE_URL = process.env.BASE_URL || 'https://bangguy.vercel.app';
  const url = new URL(`${BASE_URL}/api/attend/register`);
  
  const form = new FormData();
  form.append('employeeId', userContext.vars.employeeId);
  form.append('name', userContext.vars.employeeName);
  form.append('deviceId', userContext.vars.deviceId);
  
  const photoPath = userContext.vars.photoPath;
  if (!fs.existsSync(photoPath)) {
    return done(new Error(`Photo file not found: ${photoPath}`));
  }
  
  form.append('photo', fs.createReadStream(photoPath), {
    filename: 'loadtest-photo.jpg',
    contentType: 'image/jpeg'
  });
  
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
  
  const protocol = url.protocol === 'https:' ? https : http;
  const startTime = Date.now();
  
  const req = protocol.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      const responseTime = Date.now() - startTime;
      
      try {
        const json = JSON.parse(data);
        userContext.vars.responseOk = json.ok;
        userContext.vars.errorReason = json.reason || null;
        userContext.vars.errorCode = json.error || null;
        userContext.vars.errorMessage = json.message || null;
        
        // Artillery의 expect 플러그인을 위해 상태 코드 저장
        userContext.vars.statusCode = res.statusCode;
        userContext.vars.contentType = res.headers['content-type'] || '';
        
        // 이벤트 발생 (Artillery 메트릭 수집용)
        events.emit('counter', 'http.responses', 1);
        events.emit('histogram', 'http.response_time', responseTime);
        events.emit('counter', 'http.codes.' + res.statusCode, 1);
        
        // 다운로드된 바이트 수 (대략적인 추정)
        const downloadedBytes = Buffer.byteLength(data, 'utf8');
        events.emit('counter', 'http.downloaded_bytes', downloadedBytes);
        
        done();
      } catch (e) {
        done(new Error(`Failed to parse response: ${e.message}`));
      }
    });
  });
  
  req.on('error', (e) => {
    events.emit('counter', 'http.errors', 1);
    done(e);
  });
  
  form.pipe(req);
}

module.exports = {
  setupRegisterRequest,
  setupAdminQuery,
  sendRegisterRequest
};

/**
 * Populate variables for the register scenario.
 */
function setupRegisterRequest(userContext, events, done) {
  // 부하 테스트용: 매번 고유한 사번 생성 (기기 ID 충돌 방지)
  const baseEmployees = [
    { name: '전병관' },
    { name: '이용빈' },
    { name: '김출근' },
    { name: '박퇴근' },
    { name: '이테스트' },
    { name: '김부하' },
    { name: '박성능' },
    { name: '최확장' }
  ];

  const pick = baseEmployees[Math.floor(Math.random() * baseEmployees.length)];
  // 타임스탬프 + 랜덤으로 고유한 사번 생성 (6자리 숫자)
  const uniqueId = String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const deviceId = `dev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  userContext.vars.employeeId = uniqueId;
  userContext.vars.employeeName = pick.name;
  userContext.vars.deviceId = deviceId;
  userContext.vars.photoPath = pickPhoto();

  return done();
}

/**
 * Populate variables for the admin records scenario.
 */
function setupAdminQuery(userContext, events, done) {
  const today = new Date();
  const month = process.env.ADMIN_QUERY_MONTH
    || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  userContext.vars.queryMonth = month;
  return done();
}

