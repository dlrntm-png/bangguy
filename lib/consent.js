import { uploadTextContent, blobExists, listBlobs, readBlobText } from './blob';

function sanitizeForPath(value) {
  if (!value) return 'unknown';
  return String(value).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
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

