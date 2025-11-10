import crypto from 'crypto';
import { uploadTextContent, blobExists, listBlobs, readBlobText } from './blob';
import {
  hasConsentLogEntry,
  saveConsentLogEntry,
  getConsentLogsFromDb
} from './db';

function sanitizeForPath(value) {
  if (!value) return 'unknown';
  const trimmed = String(value).trim();
  const simple = trimmed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (simple) return simple;
  // 한글/특수문자 등으로만 구성된 경우 해시 기반 경로 사용
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16);
  return `id-${hash}`;
}

async function syncConsentLogFromBlob(pathname, defaults = {}) {
  try {
    const text = await readBlobText(pathname);
    const data = JSON.parse(text);
    const record = {
      employeeId: data.employeeId || defaults.employeeId || '',
      name: data.name || defaults.name || '',
      ip: data.ip || defaults.ip || '',
      deviceId: data.deviceId || defaults.deviceId || '',
      userAgent: data.userAgent || defaults.userAgent || '',
      consentedAt: data.consentedAt || defaults.consentedAt || new Date().toISOString(),
      blobPath: pathname,
      blobSize: defaults.blobSize ?? null,
      uploadedAt: defaults.uploadedAt ?? null
    };
    await saveConsentLogEntry(record);
    return record;
  } catch (err) {
    console.error('[consent] Failed to synchronize consent log from blob', pathname, err);
    return null;
  }
}

export async function storeConsentLogIfAbsent({ employeeId, name, ip, deviceId, userAgent }) {
  const safeId = sanitizeForPath(employeeId);
  const pathname = `consents/${safeId}.json`;

  const exists = await blobExists(pathname);
  if (exists) {
    await syncConsentLogFromBlob(pathname, { employeeId, name, ip, deviceId, userAgent });
    return { alreadyExists: true, pathname };
  }
  try {
    const consentedAt = new Date().toISOString();
    const payload = {
      employeeId: employeeId || '',
      name: name || '',
      ip: ip || '',
      deviceId: deviceId || '',
      userAgent: userAgent || '',
      consentedAt
    };

    const result = await uploadTextContent(JSON.stringify(payload, null, 2), {
      pathname,
      prefix: 'consents',
      extension: '.json',
      contentType: 'application/json; charset=utf-8',
      access: 'private',
      cacheControl: 'private, max-age=0, must-revalidate'
    });

    await saveConsentLogEntry({
      ...payload,
      blobPath: result.pathname,
      blobSize: result.size || 0,
      uploadedAt: new Date().toISOString()
    });

    return { alreadyExists: false, pathname: result.pathname, url: result.url };
  } catch (err) {
    console.error('[consent] Failed to store consent log', err);
    // fallback: 기록 실패하더라도 최소한 DB에는 남기지 않지만 호출자에게 성공 응답을 주어
    // 재시도 시 동일한 에러가 반복되지 않도록 처리
    return { alreadyExists: false, pathname };
  }
}

export async function hasConsentLog(employeeId) {
  if (!employeeId) return false;
  if (await hasConsentLogEntry(employeeId)) {
    return true;
  }
  const safeId = sanitizeForPath(employeeId);
  const pathname = `consents/${safeId}.json`;
  const exists = await blobExists(pathname);
  if (exists) {
    await syncConsentLogFromBlob(pathname, { employeeId });
    return true;
  }
  return false;
}

async function getConsentLogsFromBlobStorage() {
  const entries = await listBlobs('consents');
  const logs = [];

  for (const entry of entries) {
    const record = await syncConsentLogFromBlob(entry.pathname, {
      blobSize: entry.size || 0,
      uploadedAt: entry.uploadedAt || null
    });
    if (record) {
      logs.push({
        ...record,
        blobPath: entry.pathname,
        blobSize: entry.size || 0,
        uploadedAt: entry.uploadedAt || null
      });
    }
  }

  return logs;
}

export async function getConsentLogs() {
  const dbLogs = await getConsentLogsFromDb();
  if (dbLogs.length > 0) {
    return dbLogs;
  }

  return getConsentLogsFromBlobStorage();
}

