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
  const employees = [
    { id: '170200', name: '전병관' },
    { id: '210124', name: '이용빈' },
    { id: '199988', name: '김출근' },
    { id: '201045', name: '박퇴근' }
  ];

  const pick = employees[Math.floor(Math.random() * employees.length)];
  const deviceId = `dev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  userContext.vars.employeeId = pick.id;
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

