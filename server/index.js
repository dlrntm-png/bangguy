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
const upload = multer({ dest: uploadDir });

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

// 디버깅: 환경변수 및 로드된 IP 확인
console.log('=== IP 화이트리스트 디버깅 ===');
console.log('OFFICE_IPS from .env:', process.env.OFFICE_IPS);
console.log('Loaded OFFICE_IPS array:', OFFICE_IPS);
console.log('OFFICE_IPS count:', OFFICE_IPS.length);

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
    console.log('[isOfficeIp] clientIp is empty');
    return false;
  }
  
  console.log('[isOfficeIp] Checking IP:', clientIp);
  console.log('[isOfficeIp] Against whitelist:', OFFICE_IPS);
  
  try {
    const addr = ipaddr.parse(clientIp);
    console.log('[isOfficeIp] Parsed address kind:', addr.kind());
    console.log('[isOfficeIp] Parsed address:', addr.toString());
    
    for (const entry of OFFICE_IPS) {
      console.log('[isOfficeIp] Checking entry:', entry);
      
      if (!entry.includes('/')) {
        // 단일 IP 매칭
        const target = ipaddr.parse(entry);
        console.log('[isOfficeIp] Single IP comparison - client:', addr.toString(), 'target:', target.toString());
        
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
          const v4 = addr.toIPv4Address();
          if (v4.toString() === target.toString()) {
            console.log('[isOfficeIp] ✅ MATCH (IPv6 mapped to IPv4)');
            return true;
          }
        }
        if (addr.kind() === target.kind() && addr.toNormalizedString() === target.toNormalizedString()) {
          console.log('[isOfficeIp] ✅ MATCH (exact match)');
          return true;
        }
        console.log('[isOfficeIp] ❌ No match for single IP entry:', entry);
        continue;
      }
      
      // CIDR 매칭
      const [range, prefix] = entry.split('/');
      const prefixLen = parseInt(prefix, 10);
      console.log('[isOfficeIp] CIDR check - range:', range, 'prefix:', prefixLen);
      console.log('[isOfficeIp] Address kind:', addr.kind());
      
      try {
        // parseCIDR을 사용하여 CIDR 범위 파싱
        const subnet = ipaddr.parseCIDR(entry);
        console.log('[isOfficeIp] Parsed CIDR subnet:', subnet);
        
        if (addr.kind() === subnet[0].kind()) {
          const matchResult = addr.match(subnet);
          console.log('[isOfficeIp] CIDR match result (same kind):', matchResult);
          if (matchResult) {
            console.log('[isOfficeIp] ✅ MATCH (CIDR match)');
            return true;
          }
        }
        
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress() && subnet[0].kind() === 'ipv4') {
          const v4 = addr.toIPv4Address();
          const v4Subnet = ipaddr.parseCIDR(range + '/' + prefix);
          const matchResult = v4.match(v4Subnet);
          console.log('[isOfficeIp] CIDR match result (IPv6 mapped to IPv4):', matchResult);
          if (matchResult) {
            console.log('[isOfficeIp] ✅ MATCH (IPv6 mapped to IPv4, CIDR match)');
            return true;
          }
        }
      } catch (cidrErr) {
        console.log('[isOfficeIp] CIDR parse error for entry:', entry, 'error:', cidrErr.message);
      }
      console.log('[isOfficeIp] ❌ No match for CIDR entry:', entry);
    }
  } catch (err) {
    console.error('[isOfficeIp] ❌ ERROR:', err.message);
    console.error('[isOfficeIp] Error stack:', err.stack);
    return false;
  }
  
  console.log('[isOfficeIp] ❌ No match found for IP:', clientIp);
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

// 현재 접속 IP/사내망 여부 제공(처음부터 차단하지 않음)
app.get('/ip-status', (req, res) => {
  const ip = getClientIp(req);
  console.log('[GET /ip-status] Request from IP:', ip);
  const office = isOfficeIp(ip);
  console.log('[GET /ip-status] Result - IP:', ip, 'Office:', office);
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

  if (!employeeId || !name) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ ok: false, error: 'INVALID_INPUT', ip, office, serverTime });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'PHOTO_REQUIRED', ip, office, serverTime });
  }
  if (!deviceId) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ ok: false, error: 'DEVICE_ID_REQUIRED', ip, office, serverTime });
  }

  if (!office) {
    // 처음부터 URL 접근을 막지 않고, 결과로 상태만 안내
    fs.unlink(req.file.path, () => {});
    return res.status(200).json({
      ok: false,
      reason: 'NOT_OFFICE_IP',
      message: '사내 공인 IP가 아닙니다. 사내 Wi‑Fi/VPN 접속 후 다시 시도해주세요.',
      ip,
      office,
      serverTime
    });
  }

  // 1. 사진 중복 감지
  const imageHash = getImageHash(req.file.path);
  if (imageHash && isDuplicateHash(imageHash)) {
    fs.unlink(req.file.path, () => {});
    return res.status(200).json({
      ok: false,
      reason: 'DUPLICATE_PHOTO',
      message: '이미 사용된 사진입니다. 새로운 사진을 촬영해주세요.',
      ip,
      office,
      serverTime
    });
  }

  // 2. 기기 ID 바인딩 확인
  const deviceCheck = checkDeviceBinding(employeeId, deviceId);
  if (!deviceCheck.allowed) {
    fs.unlink(req.file.path, () => {});
    return res.status(200).json({
      ok: false,
      reason: 'DEVICE_MISMATCH',
      message: deviceCheck.message,
      ip,
      office,
      serverTime
    });
  }

  // 파일 확장자/이름 정리 후 저장 (데모: 로컬 저장)
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
  try { fs.appendFileSync(logFile, line, { encoding: 'utf8' }); } catch {}

  return res.json({ ok: true, ip, office, file: saveName, serverTime, message: '인증(등록) 완료' });
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
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 8) {
        const record = {
          server_time: cols[0],
          employee_id: cols[1],
          name: cols[2],
          ip: cols[3],
          file: cols[4],
          office: cols[5],
          device_id: cols[6],
          image_hash: cols[7]
        };
        
        // 사번 필터링
        const empId = req.query.employeeId;
        if (!empId || record.employee_id === empId) {
          records.push(record);
        }
      }
    }
    
    // 최신순 정렬
    records.reverse();
    
    return res.json({ ok: true, records });
  } catch (err) {
    console.error('기록 조회 오류:', err);
    return res.status(500).json({ ok: false, message: '기록 조회 실패' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server on :${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin.html`);
  console.log(`관리자 비밀번호: ${ADMIN_PASSWORD} (환경변수 ADMIN_PASSWORD로 변경 가능)`);
});


