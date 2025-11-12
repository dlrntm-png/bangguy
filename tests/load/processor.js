const path = require('path');
const crypto = require('crypto');

const PHOTOS = [
  'tests/load/assets/photo1.jpg',
  'tests/load/assets/photo2.jpg',
  'tests/load/assets/photo3.jpg'
];

function pickPhoto() {
  const idx = Math.floor(Math.random() * PHOTOS.length);
  return path.resolve(PHOTOS[idx]);
}

module.exports = {
  setupRegisterRequest,
  setupAdminQuery
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

