// server/index.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import ipaddr from 'ipaddr.js';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ESM에서 __dirname 생성
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 신뢰 프록시 설정(운영 환경에 맞게 조정)
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// 정적 파일 제공
const publicDir = path.join(__dirname, '..', 'public');
app.use('/', express.static(publicDir));

// 업로드 디렉터리 준비
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 파일 업로드 설정 (크기 제한: 5MB, 이미지 파일만 허용)
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP)'), false);
    }
  }
});

// 로그 디렉터리/파일 준비
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'attendance.csv');
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, 'server_time,employee_id,name,ip,file,office,device_id,image_hash\n', { encoding: 'utf8' });
}

// 기기 재등록 요청 파일 준비
const deviceRequestsFile = path.join(logsDir, 'device_requests.json');
if (!fs.existsSync(deviceRequestsFile)) {
  fs.writeFileSync(deviceRequestsFile, '[]', { encoding: 'utf8' });
}

// 화이트리스트 IP/CIDR 로드
const OFFICE_IPS = (process.env.OFFICE_IPS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 디버깅 모드 (환경변수로 제어)
const DEBUG = process.env.DEBUG === 'true';

// 디버깅: 환경변수 및 로드된 IP 확인 (조건부)
if (DEBUG) {
  console.log('=== IP 화이트리스트 디버깅 ===');
  console.log('OFFICE_IPS from .env:', process.env.OFFICE_IPS);
  console.log('Loaded OFFICE_IPS array:', OFFICE_IPS);
  console.log('OFFICE_IPS count:', OFFICE_IPS.length);
}

function getClientIp(req) {
  let ip = req.ip || req.socket?.remoteAddress || '';
  ip = ip.replace('::ffff:', '');
  
  // IPv6 localhost를 IPv4로 변환 (표시용)
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

function isOfficeIp(clientIp) {
  if (!clientIp) {
    if (DEBUG) console.log('[isOfficeIp] clientIp is empty');
    return false;
  }
  
  if (DEBUG) {
    console.log('[isOfficeIp] Checking IP:', clientIp);
    console.log('[isOfficeIp] Against whitelist:', OFFICE_IPS);
  }
  
  try {
    const addr = ipaddr.parse(clientIp);
    if (DEBUG) {
      console.log('[isOfficeIp] Parsed address kind:', addr.kind());
      console.log('[isOfficeIp] Parsed address:', addr.toString());
    }
    
    for (const entry of OFFICE_IPS) {
      if (DEBUG) console.log('[isOfficeIp] Checking entry:', entry);
      
      if (!entry.includes('/')) {
        // 단일 IP 매칭
        const target = ipaddr.parse(entry);
        if (DEBUG) console.log('[isOfficeIp] Single IP comparison - client:', addr.toString(), 'target:', target.toString());
        
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
          const v4 = addr.toIPv4Address();
          if (v4.toString() === target.toString()) {
            if (DEBUG) console.log('[isOfficeIp] ✅ MATCH (IPv6 mapped to IPv4)');
            return true;
          }
        }
        if (addr.kind() === target.kind() && addr.toNormalizedString() === target.toNormalizedString()) {
          if (DEBUG) console.log('[isOfficeIp] ✅ MATCH (exact match)');
          return true;
        }
        if (DEBUG) console.log('[isOfficeIp] ❌ No match for single IP entry:', entry);
        continue;
      }
      
      // CIDR 매칭
      const [range, prefix] = entry.split('/');
      const prefixLen = parseInt(prefix, 10);
      if (DEBUG) {
        console.log('[isOfficeIp] CIDR check - range:', range, 'prefix:', prefixLen);
        console.log('[isOfficeIp] Address kind:', addr.kind());
      }
      
      try {
        // parseCIDR을 사용하여 CIDR 범위 파싱
        const subnet = ipaddr.parseCIDR(entry);
        if (DEBUG) console.log('[isOfficeIp] Parsed CIDR subnet:', subnet);
        
        if (addr.kind() === subnet[0].kind()) {
          const matchResult = addr.match(subnet);
          if (DEBUG) console.log('[isOfficeIp] CIDR match result (same kind):', matchResult);
          if (matchResult) {
            if (DEBUG) console.log('[isOfficeIp] ✅ MATCH (CIDR match)');
            return true;
          }
        }
        
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress() && subnet[0].kind() === 'ipv4') {
          const v4 = addr.toIPv4Address();
          const v4Subnet = ipaddr.parseCIDR(range + '/' + prefix);
          const matchResult = v4.match(v4Subnet);
          if (DEBUG) console.log('[isOfficeIp] CIDR match result (IPv6 mapped to IPv4):', matchResult);
          if (matchResult) {
            if (DEBUG) console.log('[isOfficeIp] ✅ MATCH (IPv6 mapped to IPv4, CIDR match)');
            return true;
          }
        }
      } catch (cidrErr) {
        if (DEBUG) console.log('[isOfficeIp] CIDR parse error for entry:', entry, 'error:', cidrErr.message);
      }
      if (DEBUG) console.log('[isOfficeIp] ❌ No match for CIDR entry:', entry);
    }
  } catch (err) {
    console.error('[isOfficeIp] ❌ ERROR:', err.message);
    if (DEBUG) console.error('[isOfficeIp] Error stack:', err.stack);
    return false;
  }
  
  if (DEBUG) console.log('[isOfficeIp] ❌ No match found for IP:', clientIp);
  return false;
}

// 한국 시간(KST, UTC+9)을 ISO 형식으로 반환
function getKoreaTime() {
  const now = new Date();
  // 한국 시간으로 변환 (UTC+9)
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return koreaTime.toISOString();
}

// 이미지 해시 계산 함수
function getImageHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch {
    return null;
  }
}

// CSV에서 해시 중복 확인 함수
function isDuplicateHash(imageHash) {
  try {
    if (!imageHash || !fs.existsSync(logFile)) return false;
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    // 헤더 제외하고 각 줄에서 해시 확인
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 8 && cols[7] && cols[7].trim() === imageHash) {
        return true; // 중복 발견
      }
    }
    return false;
  } catch {
    return false;
  }
}

// 기기 ID 바인딩 확인 함수
function checkDeviceBinding(employeeId, deviceId) {
  try {
    if (!fs.existsSync(logFile)) return { allowed: true, message: null };
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    
    // 최근 등록 기록에서 같은 사번의 기기 ID 확인 (역순으로 검색)
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',');
      if (cols.length >= 7 && cols[1] === employeeId) {
        const lastDeviceId = (cols[6] || '').trim();
        if (lastDeviceId && lastDeviceId !== deviceId) {
          return { 
            allowed: false, 
            message: '다른 기기에서 등록된 기록이 있습니다. 본인 기기에서 등록해주세요.' 
          };
        }
        break; // 첫 번째 매칭만 확인
      }
    }
    return { allowed: true, message: null };
  } catch {
    return { allowed: true, message: null };
  }
}

// 중복 등록 방지 함수 (같은 사번이 짧은 시간 내 중복 등록 방지)
// 기본값: 5분 (300초) 내 중복 등록 방지
function checkDuplicateRegistration(employeeId, timeWindowSeconds = 300) {
  try {
    if (!fs.existsSync(logFile)) return { allowed: true, message: null };
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    const now = new Date();
    
    // 최근 등록 기록 확인 (역순으로 검색)
    for (let i = lines.length - 1; i >= 1; i--) {
      const cols = lines[i].split(',');
      if (cols.length >= 1 && cols[1] === employeeId) {
        try {
          const lastRegistrationTime = new Date(cols[0]);
          const diffSeconds = (now - lastRegistrationTime) / 1000;
          
          if (diffSeconds < timeWindowSeconds && diffSeconds >= 0) {
            const remainingSeconds = Math.ceil(timeWindowSeconds - diffSeconds);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            return {
              allowed: false,
              message: `최근에 등록하셨습니다. ${minutes}분 ${seconds}초 후에 다시 시도해주세요.`
            };
          }
        } catch (dateErr) {
          // 날짜 파싱 실패 시 무시하고 계속 진행
          if (DEBUG) console.log('[checkDuplicateRegistration] Date parse error:', dateErr.message);
        }
        break; // 첫 번째 매칭만 확인
      }
    }
    return { allowed: true, message: null };
  } catch (err) {
    if (DEBUG) console.error('[checkDuplicateRegistration] Error:', err.message);
    return { allowed: true, message: null };
  }
}

// 현재 접속 IP/사내망 여부 제공(처음부터 차단하지 않음)
app.get('/ip-status', (req, res) => {
  const ip = getClientIp(req);
  if (DEBUG) console.log('[GET /ip-status] Request from IP:', ip);
  const office = isOfficeIp(ip);
  if (DEBUG) console.log('[GET /ip-status] Result - IP:', ip, 'Office:', office);
  res.json({ ip, office });
});

// 인증(등록): 사번/이름/사진 + 서버가 본 IP/사내망 여부를 응답으로 표시
app.post('/attend/register', upload.single('photo'), async (req, res) => {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  const serverTime = getKoreaTime();
  const deviceId = String(req.body.deviceId || '').trim();

  const employeeId = String(req.body.employeeId || '').trim();
  const name = String(req.body.name || '').trim();

  // 에러 처리 헬퍼 함수
  const cleanupAndReturn = (status, data) => {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(status).json(data);
  };

  // 입력 검증
  if (!employeeId || !name) {
    return cleanupAndReturn(400, { 
      ok: false, 
      error: 'INVALID_INPUT', 
      message: '사번과 이름을 모두 입력해주세요.',
      ip, 
      office, 
      serverTime 
    });
  }
  
  if (!req.file) {
    // Multer 에러 처리
    if (req.fileValidationError) {
      return res.status(400).json({ 
        ok: false, 
        error: 'INVALID_FILE', 
        message: req.fileValidationError,
        ip, 
        office, 
        serverTime 
      });
    }
    return res.status(400).json({ 
      ok: false, 
      error: 'PHOTO_REQUIRED', 
      message: '사진을 선택해주세요.',
      ip, 
      office, 
      serverTime 
    });
  }
  
  if (!deviceId) {
    return cleanupAndReturn(400, { 
      ok: false, 
      error: 'DEVICE_ID_REQUIRED', 
      message: '기기 ID가 필요합니다. 페이지를 새로고침해주세요.',
      ip, 
      office, 
      serverTime 
    });
  }

  // 파일 크기 검증 (추가 안전장치)
  try {
    const stats = fs.statSync(req.file.path);
    if (stats.size > 5 * 1024 * 1024) {
      return cleanupAndReturn(400, {
        ok: false,
        error: 'FILE_TOO_LARGE',
        message: '파일 크기가 너무 큽니다. (최대 5MB)',
        ip,
        office,
        serverTime
      });
    }
  } catch (statErr) {
    if (DEBUG) console.error('[register] File stat error:', statErr.message);
  }

  if (!office) {
    // 처음부터 URL 접근을 막지 않고, 결과로 상태만 안내
    return cleanupAndReturn(200, {
      ok: false,
      reason: 'NOT_OFFICE_IP',
      message: '사내 공인 IP가 아닙니다. 사내 Wi‑Fi/VPN 접속 후 다시 시도해주세요.',
      ip,
      office,
      serverTime
    });
  }

  // 1. 중복 등록 방지 (시간 기반)
  const duplicateCheck = checkDuplicateRegistration(employeeId);
  if (!duplicateCheck.allowed) {
    return cleanupAndReturn(200, {
      ok: false,
      reason: 'DUPLICATE_REGISTRATION',
      message: duplicateCheck.message,
      ip,
      office,
      serverTime
    });
  }

  // 2. 사진 중복 감지
  const imageHash = getImageHash(req.file.path);
  if (imageHash && isDuplicateHash(imageHash)) {
    return cleanupAndReturn(200, {
      ok: false,
      reason: 'DUPLICATE_PHOTO',
      message: '이미 사용된 사진입니다. 새로운 사진을 촬영해주세요.',
      ip,
      office,
      serverTime
    });
  }

  // 3. 기기 ID 바인딩 확인
  const deviceCheck = checkDeviceBinding(employeeId, deviceId);
  if (!deviceCheck.allowed) {
    return cleanupAndReturn(200, {
      ok: false,
      reason: 'DEVICE_MISMATCH',
      message: deviceCheck.message,
      ip,
      office,
      serverTime
    });
  }

  // 파일 확장자/이름 정리 후 저장 (데모: 로컬 저장)
  try {
    const original = req.file.originalname || 'photo.jpg';
    const ext = path.extname(original) || '.jpg';
    const safeEmpId = employeeId.replace(/[^a-zA-Z0-9_-]/g, '');
    const saveName = `emp_${safeEmpId}_${Date.now()}${ext}`;
    const savePath = path.join(uploadDir, saveName);
    fs.renameSync(req.file.path, savePath);

    // TODO: DB 저장 { employeeId, name, photo_path: saveName, ip, created_at }
    // CSV 로그 저장 (device_id, image_hash 추가)
    const safeNameNoComma = name.replace(/,|\r|\n/g, ' ');
    const safeDeviceId = deviceId.replace(/,|\r|\n/g, '_');
    const line = `${serverTime},${safeEmpId},${safeNameNoComma},${ip},${saveName},${office},${safeDeviceId},${imageHash || ''}\n`;
    try { 
      fs.appendFileSync(logFile, line, { encoding: 'utf8' }); 
    } catch (logErr) {
      console.error('[register] CSV log write error:', logErr.message);
    }

    return res.json({ ok: true, ip, office, file: saveName, serverTime, message: '인증(등록) 완료' });
  } catch (saveErr) {
    console.error('[register] File save error:', saveErr.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ 
      ok: false, 
      error: 'SAVE_ERROR', 
      message: '파일 저장 중 오류가 발생했습니다. 다시 시도해주세요.',
      ip, 
      office, 
      serverTime 
    });
  }
});

// Multer 에러 처리 미들웨어
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        ok: false, 
        error: 'FILE_TOO_LARGE', 
        message: '파일 크기가 너무 큽니다. (최대 5MB)',
        ip: getClientIp(req),
        office: false,
        serverTime: getKoreaTime()
      });
    }
    return res.status(400).json({ 
      ok: false, 
      error: 'UPLOAD_ERROR', 
      message: '파일 업로드 중 오류가 발생했습니다.',
      ip: getClientIp(req),
      office: false,
      serverTime: getKoreaTime()
    });
  }
  if (err) {
    return res.status(400).json({ 
      ok: false, 
      error: 'VALIDATION_ERROR', 
      message: err.message || '파일 검증 실패',
      ip: getClientIp(req),
      office: false,
      serverTime: getKoreaTime()
    });
  }
  next();
});

// ==================== 관리자 기능 ====================

// 관리자 비밀번호 (환경변수에서 로드, 기본값: admin123)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 간단한 토큰 저장 (운영 환경에서는 Redis 등 사용 권장)
const adminTokens = new Set();

// 관리자 인증 미들웨어
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: '인증이 필요합니다.' });
  }
  const token = authHeader.substring(7);
  if (!adminTokens.has(token)) {
    return res.status(401).json({ ok: false, message: '유효하지 않은 토큰입니다.' });
  }
  next();
}

// 관리자 로그인
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.add(token);
    // 토큰은 24시간 후 만료 (간단한 구현)
    setTimeout(() => adminTokens.delete(token), 24 * 60 * 60 * 1000);
    return res.json({ ok: true, token, message: '로그인 성공' });
  }
  return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
});

// 관리자 토큰 확인
app.get('/admin/check', requireAdmin, (req, res) => {
  res.json({ ok: true, message: '인증됨' });
});

// 등록 기록 조회
app.get('/admin/records', requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(logFile)) {
      return res.json({ ok: true, records: [] });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine || !rawLine.trim()) continue;
      const cols = rawLine.split(',');
      if (cols.length >= 8) {
        const record = {
          recordId: i,
          server_time: cols[0],
          employee_id: cols[1],
          name: cols[2],
          ip: cols[3],
          file: cols[4],
          office: cols[5],
          device_id: cols[6],
          image_hash: cols[7]
        };

        const empId = req.query.employeeId;
        if (!empId || record.employee_id === empId) {
          records.push(record);
        }
      }
    }

    records.reverse();

    return res.json({ ok: true, records });
  } catch (err) {
    console.error('기록 조회 오류:', err);
    return res.status(500).json({ ok: false, message: '기록 조회 실패' });
  }
});

app.post('/admin/delete-records', requireAdmin, (req, res) => {
  const { recordIds, deleteAll } = req.body || {};

  try {
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ ok: false, message: '등록 기록이 없습니다.' });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');

    if (deleteAll) {
      let deletedCount = 0;
      const filesToDelete = new Set();

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine || !rawLine.trim()) continue;
        deletedCount++;
        const cols = rawLine.split(',');
        const fileName = (cols[4] || '').trim();
        if (fileName && fileName !== '-') {
          filesToDelete.add(fileName);
        }
      }

      fs.writeFileSync(logFile, `${lines[0] || 'server_time,employee_id,name,ip,file,office,device_id,image_hash'}\n`, { encoding: 'utf8' });

      filesToDelete.forEach(file => {
        const filePath = path.join(uploadDir, file);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            if (DEBUG) console.log(`[delete-records] 파일 삭제: ${file}`);
          } catch (fileErr) {
            console.error(`[delete-records] 파일 삭제 오류 (${file}):`, fileErr.message);
          }
        }
      });

      return res.json({ ok: true, deleted: deletedCount, deletedFiles: filesToDelete.size });
    }

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ ok: false, message: '삭제할 기록을 선택해주세요.' });
    }

    const numericIds = [...new Set(recordIds.map(Number))].filter(n => Number.isInteger(n) && n > 0);
    if (numericIds.length === 0) {
      return res.status(400).json({ ok: false, message: '유효한 기록 번호가 없습니다.' });
    }

    const targets = new Set(numericIds);
    const filesToDelete = new Set();
    const newLines = [lines[0] || 'server_time,employee_id,name,ip,file,office,device_id,image_hash'];
    let deletedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;

      if (targets.has(i) && rawLine.trim()) {
        deletedCount++;
        const cols = rawLine.split(',');
        const fileName = (cols[4] || '').trim();
        if (fileName && fileName !== '-') {
          filesToDelete.add(fileName);
        }
        continue;
      }

      newLines.push(rawLine);
    }

    if (deletedCount === 0) {
      return res.status(404).json({ ok: false, message: '선택한 기록을 찾을 수 없습니다.' });
    }

    fs.writeFileSync(logFile, newLines.join('\n'), { encoding: 'utf8' });

    filesToDelete.forEach(file => {
      const filePath = path.join(uploadDir, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          if (DEBUG) console.log(`[delete-records] 파일 삭제: ${file}`);
        } catch (fileErr) {
          console.error(`[delete-records] 파일 삭제 오류 (${file}):`, fileErr.message);
        }
      }
    });

    return res.json({ ok: true, deleted: deletedCount, deletedFiles: filesToDelete.size });
  } catch (err) {
    console.error('등록 기록 삭제 오류:', err);
    return res.status(500).json({ ok: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
});

// 기기 ID 업데이트
app.post('/admin/update-device', requireAdmin, (req, res) => {
  const { employeeId, deviceId } = req.body;
  
  if (!employeeId || !deviceId) {
    return res.status(400).json({ ok: false, message: '사번과 기기 ID를 모두 입력해주세요.' });
  }
  
  try {
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ ok: false, message: '등록 기록이 없습니다.' });
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    let updated = 0;
    const safeDeviceId = deviceId.replace(/,|\r|\n/g, '_');
    
    // 해당 사번의 모든 기록에서 기기 ID 업데이트
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 7 && cols[1] === employeeId) {
        cols[6] = safeDeviceId; // device_id 업데이트
        lines[i] = cols.join(',');
        updated++;
      }
    }
    
    if (updated === 0) {
      return res.status(404).json({ ok: false, message: '해당 사번의 등록 기록을 찾을 수 없습니다.' });
    }
    
    // 파일 다시 쓰기
    fs.writeFileSync(logFile, lines.join('\n'), { encoding: 'utf8' });
    
    return res.json({ ok: true, updated, message: '기기 ID가 업데이트되었습니다.' });
  } catch (err) {
    console.error('기기 ID 업데이트 오류:', err);
    return res.status(500).json({ ok: false, message: '업데이트 실패' });
  }
});

// CSV 다운로드
app.get('/admin/download-csv', requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ ok: false, message: 'CSV 파일이 없습니다.' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${new Date().toISOString().split('T')[0]}.csv"`);
    const content = fs.readFileSync(logFile, 'utf8');
    res.send(content);
  } catch (err) {
    console.error('CSV 다운로드 오류:', err);
    return res.status(500).json({ ok: false, message: '다운로드 실패' });
  }
});

// ==================== 기기 재등록 요청 기능 ====================

// 기기 재등록 요청 제출 (일반 사용자)
app.post('/attend/request-device-update', (req, res) => {
  const { employeeId, name, deviceId } = req.body;
  const serverTime = getKoreaTime();
  
  if (!employeeId || !name || !deviceId) {
    return res.status(400).json({ ok: false, message: '필수 정보가 누락되었습니다.' });
  }
  
  try {
    // 기존 요청 확인 (중복 방지)
    const requests = JSON.parse(fs.readFileSync(deviceRequestsFile, 'utf8'));
    const pendingRequest = requests.find(r => 
      r.employeeId === employeeId && 
      r.status === 'pending' &&
      r.deviceId === deviceId
    );
    
    if (pendingRequest) {
      return res.json({ ok: false, message: '이미 대기 중인 요청이 있습니다.' });
    }
    
    // 새 요청 추가
    const newRequest = {
      id: Date.now().toString(),
      employeeId: String(employeeId).trim(),
      name: String(name).trim(),
      deviceId: String(deviceId).trim(),
      requestedAt: serverTime,
      status: 'pending',
      approvedAt: null,
      rejectedAt: null
    };
    
    requests.push(newRequest);
    fs.writeFileSync(deviceRequestsFile, JSON.stringify(requests, null, 2), { encoding: 'utf8' });
    
    return res.json({ ok: true, message: '요청이 제출되었습니다.' });
  } catch (err) {
    console.error('기기 재등록 요청 오류:', err);
    return res.status(500).json({ ok: false, message: '요청 처리 실패' });
  }
});

// 대기 중인 요청 목록 조회 (관리자)
app.get('/admin/device-requests', requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(deviceRequestsFile)) {
      return res.json({ ok: true, requests: [] });
    }
    const requests = JSON.parse(fs.readFileSync(deviceRequestsFile, 'utf8'));
    const status = req.query.status || 'all';
    
    let filtered = requests;
    if (status === 'pending') {
      filtered = requests.filter(r => r.status === 'pending');
    } else if (status === 'approved') {
      filtered = requests.filter(r => r.status === 'approved');
    } else if (status === 'rejected') {
      filtered = requests.filter(r => r.status === 'rejected');
    }
    
    // 최신순 정렬
    filtered.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    
    return res.json({ ok: true, requests: filtered });
  } catch (err) {
    console.error('요청 목록 조회 오류:', err);
    return res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// 요청 승인 (관리자)
app.post('/admin/approve-device-request', requireAdmin, (req, res) => {
  const { requestId } = req.body;
  
  if (!requestId) {
    return res.status(400).json({ ok: false, message: '요청 ID가 필요합니다.' });
  }
  
  try {
    const requests = JSON.parse(fs.readFileSync(deviceRequestsFile, 'utf8'));
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: '이미 처리된 요청입니다.' });
    }
    
    // 기기 ID 업데이트 (기존 로직 재사용)
    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ ok: false, message: '등록 기록이 없습니다.' });
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    let updated = 0;
    const safeDeviceId = request.deviceId.replace(/,|\r|\n/g, '_');
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 7 && cols[1] === request.employeeId) {
        cols[6] = safeDeviceId;
        lines[i] = cols.join(',');
        updated++;
      }
    }
    
    if (updated > 0) {
      fs.writeFileSync(logFile, lines.join('\n'), { encoding: 'utf8' });
    }
    
    // 요청 상태 업데이트
    request.status = 'approved';
    request.approvedAt = getKoreaTime();
    fs.writeFileSync(deviceRequestsFile, JSON.stringify(requests, null, 2), { encoding: 'utf8' });
    
    return res.json({ ok: true, updated, message: '요청이 승인되었습니다.' });
  } catch (err) {
    console.error('요청 승인 오류:', err);
    return res.status(500).json({ ok: false, message: '승인 처리 실패' });
  }
});

// 요청 거부 (관리자)
app.post('/admin/reject-device-request', requireAdmin, (req, res) => {
  const { requestId } = req.body;
  
  if (!requestId) {
    return res.status(400).json({ ok: false, message: '요청 ID가 필요합니다.' });
  }
  
  try {
    const requests = JSON.parse(fs.readFileSync(deviceRequestsFile, 'utf8'));
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: '이미 처리된 요청입니다.' });
    }
    
    request.status = 'rejected';
    request.rejectedAt = getKoreaTime();
    fs.writeFileSync(deviceRequestsFile, JSON.stringify(requests, null, 2), { encoding: 'utf8' });
    
    return res.json({ ok: true, message: '요청이 거부되었습니다.' });
  } catch (err) {
    console.error('요청 거부 오류:', err);
    return res.status(500).json({ ok: false, message: '거부 처리 실패' });
  }
});

// 업로드된 이미지 파일 제공
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // 보안: 파일명에 경로 조작 방지
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ ok: false, message: '잘못된 파일명입니다.' });
  }
  
  const filePath = path.join(uploadDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, message: '파일을 찾을 수 없습니다.' });
  }
  
  res.sendFile(filePath);
});

// 이미지 삭제 API (관리자 전용)
app.post('/admin/delete-photo', requireAdmin, (req, res) => {
  const { filename } = req.body;
  
  if (!filename) {
    return res.status(400).json({ ok: false, message: '파일명이 필요합니다.' });
  }
  
  // 보안: 파일명에 경로 조작 방지
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ ok: false, message: '잘못된 파일명입니다.' });
  }
  
  const filePath = path.join(uploadDir, filename);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, message: '파일을 찾을 수 없습니다.' });
    }
    
    // 파일 삭제
    fs.unlinkSync(filePath);
    
    if (DEBUG) console.log(`[delete-photo] Deleted file: ${filename}`);
    
    return res.json({ ok: true, message: '파일이 삭제되었습니다.' });
  } catch (err) {
    console.error('[delete-photo] Error:', err.message);
    return res.status(500).json({ ok: false, message: '파일 삭제 실패' });
  }
});

// 오래된 업로드 파일 정리 함수 (30일 이상 된 파일 삭제)
function cleanupOldFiles() {
  try {
    if (!fs.existsSync(uploadDir)) return;
    
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30일 (밀리초)
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          if (DEBUG) console.log(`[cleanup] Deleted old file: ${file}`);
        }
      } catch (fileErr) {
        if (DEBUG) console.error(`[cleanup] Error processing file ${file}:`, fileErr.message);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[cleanup] ${deletedCount}개의 오래된 파일이 삭제되었습니다.`);
    }
  } catch (err) {
    console.error('[cleanup] Error:', err.message);
  }
}

// 서버 시작 시 정리 실행, 이후 매일 자정에 실행
cleanupOldFiles();
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000); // 24시간마다 실행

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server on :${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin.html`);
  console.log(`관리자 비밀번호: ${ADMIN_PASSWORD} (환경변수 ADMIN_PASSWORD로 변경 가능)`);
  if (DEBUG) {
    console.log('디버깅 모드: 활성화됨');
  }
});


