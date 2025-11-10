import crypto from 'crypto';
import { uploadTextContent, blobExists, listBlobs, readBlobText } from './blob';

function sanitizeForPath(value) {
  if (!value) return 'unknown';
  const trimmed = String(value).trim();
  const simple = trimmed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (simple) return simple;
  // 한글/특수문자 등으로만 구성된 경우 해시 기반 경로 사용
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16);
  return `id-${hash}`;
}

export async function storeConsentLogIfAbsent({ employeeId, name, ip, deviceId, userAgent }) {
  const safeId = sanitizeForPath(employeeId);
  const pathname = `consents/${safeId}.json`;

  const exists = await blobExists(pathname);
  if (exists) {
    return { alreadyExists: true, pathname };
  }

  const payload = {
    employeeId: employeeId || '',
    name: name || '',
    ip: ip || '',
    deviceId: deviceId || '',
    userAgent: userAgent || '',
    consentedAt: new Date().toISOString()
  };

  const result = await uploadTextContent(JSON.stringify(payload, null, 2), {
    pathname,
    prefix: 'consents',
    extension: '.json',
    contentType: 'application/json; charset=utf-8',
    access: 'private',
    cacheControl: 'private, max-age=0, must-revalidate'
  });

  return { alreadyExists: false, pathname: result.pathname, url: result.url };
}

export async function hasConsentLog(employeeId) {
  if (!employeeId) return false;
  const safeId = sanitizeForPath(employeeId);
  const pathname = `consents/${safeId}.json`;
  return blobExists(pathname);
}

export async function getAllConsentLogs() {
  const entries = await listBlobs('consents');
  const logs = [];

  for (const entry of entries) {
    try {
      const text = await readBlobText(entry.pathname);
      const data = JSON.parse(text);
      logs.push({
        ...data,
        blobPath: entry.pathname,
        blobSize: entry.size || 0,
        uploadedAt: entry.uploadedAt || null
      });
    } catch (err) {
      console.error('[consent] Failed to parse log', entry.pathname, err);
    }
  }

  return logs;
}

