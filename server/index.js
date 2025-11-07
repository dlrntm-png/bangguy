// server/index.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as ipaddr from 'ipaddr.js';
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
  fs.writeFileSync(logFile, 'server_time,employee_id,name,ip,file,office\n', { encoding: 'utf8' });
}

// 화이트리스트 IP/CIDR 로드
const OFFICE_IPS = (process.env.OFFICE_IPS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function getClientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip.replace('::ffff:', '');
}

function isOfficeIp(clientIp) {
  if (!clientIp) return false;
  try {
    const addr = ipaddr.parse(clientIp);
    for (const entry of OFFICE_IPS) {
      if (!entry.includes('/')) {
        const target = ipaddr.parse(entry);
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
          if (addr.toIPv4Address().toString() === target.toString()) return true;
        }
        if (addr.kind() === target.kind() && addr.toNormalizedString() === target.toNormalizedString()) return true;
        continue;
      }
      const [range, prefix] = entry.split('/');
      const net = ipaddr.parse(range);
      const prefixLen = parseInt(prefix, 10);
      if (addr.kind() === net.kind() && addr.match([net.toByteArray(), prefixLen])) return true;
      if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress() && net.kind() === 'ipv4') {
        const v4 = addr.toIPv4Address();
        if (v4.match([net.toByteArray(), prefixLen])) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

// 한국 시간(KST, UTC+9)을 ISO 형식으로 반환
function getKoreaTime() {
  const now = new Date();
  // 한국 시간으로 변환 (UTC+9)
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return koreaTime.toISOString();
}

// 현재 접속 IP/사내망 여부 제공(처음부터 차단하지 않음)
app.get('/ip-status', (req, res) => {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  res.json({ ip, office });
});

// 인증(등록): 사번/이름/사진 + 서버가 본 IP/사내망 여부를 응답으로 표시
app.post('/attend/register', upload.single('photo'), async (req, res) => {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  const serverTime = getKoreaTime();

  const employeeId = String(req.body.employeeId || '').trim();
  const name = String(req.body.name || '').trim();

  if (!employeeId || !name) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ ok: false, error: 'INVALID_INPUT', ip, office, serverTime });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'PHOTO_REQUIRED', ip, office, serverTime });
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

  // 파일 확장자/이름 정리 후 저장 (데모: 로컬 저장)
  const original = req.file.originalname || 'photo.jpg';
  const ext = path.extname(original) || '.jpg';
  const safeEmpId = employeeId.replace(/[^a-zA-Z0-9_-]/g, '');
  const saveName = `emp_${safeEmpId}_${Date.now()}${ext}`;
  const savePath = path.join(uploadDir, saveName);
  fs.renameSync(req.file.path, savePath);

  // TODO: DB 저장 { employeeId, name, photo_path: saveName, ip, created_at }
  // CSV 로그 저장
  const safeNameNoComma = name.replace(/,|\r|\n/g, ' ');
  const line = `${serverTime},${safeEmpId},${safeNameNoComma},${ip},${saveName},${office}\n`;
  try { fs.appendFileSync(logFile, line, { encoding: 'utf8' }); } catch {}

  return res.json({ ok: true, ip, office, file: saveName, serverTime, message: '인증(등록) 완료' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server on :${PORT}`);
});


