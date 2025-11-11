import { Pool } from 'pg';

const SHOULD_USE_MOCK =
  process.env.MOCK_DB === 'true' ||
  (!process.env.POSTGRES_URL && !process.env.SUPABASE_PROJECT_ID && process.env.NODE_ENV !== 'production');

if (SHOULD_USE_MOCK) {
  console.warn('[db] Using in-memory mock database. Data will reset when the server restarts.');
}

let pool;

function normalizeHost(rawHost = '') {
  let host = rawHost.trim();
  if (!host) return '';
  host = host.replace(/^https?:\/\//i, '');
  host = host.replace(/\/$/, '');
  // Supabase API 도메인을 넣은 경우 자동으로 db. 접두사를 붙임
  if (!host.startsWith('db.')) {
    host = `db.${host}`;
  }
  return host;
}

function resolveConnectionString() {
  const direct = process.env.POSTGRES_URL?.trim();
  if (direct && direct.startsWith('postgres')) {
    return direct;
  }

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const port = process.env.SUPABASE_DB_PORT || '5432';

  let host = '';

  if (direct) {
    host = normalizeHost(direct);
  } else if (process.env.SUPABASE_PROJECT_ID) {
    host = normalizeHost(`${process.env.SUPABASE_PROJECT_ID}.supabase.co`);
  }

  if (!host || !password) {
    if (SHOULD_USE_MOCK) return null;
    throw new Error('POSTGRES_URL 또는 SUPABASE_PROJECT_ID/SUPABASE_DB_PASSWORD 환경변수를 설정해주세요.');
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function getPool() {
  if (SHOULD_USE_MOCK) {
    throw new Error('Mock DB 모드에서는 실제 Postgres 풀을 사용할 수 없습니다.');
  }

  if (!pool) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error('유효한 Postgres 연결 문자열이 없습니다.');
    }
    const sslMode = (process.env.POSTGRES_SSL || 'require').toLowerCase();
    const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString, ssl });
  }
  return pool;
}

let initialized = false;

async function ensureTables() {
  if (SHOULD_USE_MOCK) return;
  if (initialized) return;

  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id SERIAL PRIMARY KEY,
      server_time TIMESTAMPTZ NOT NULL,
      employee_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      photo_url TEXT,
      photo_blob_path TEXT,
      office BOOLEAN NOT NULL,
      device_id TEXT,
      image_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      photo_content_type TEXT,
      photo_size BIGINT,
      photo_width INTEGER,
      photo_height INTEGER,
      cleanup_scheduled_at TIMESTAMPTZ,
      photo_deleted_at TIMESTAMPTZ,
      backup_blob_path TEXT,
      backup_generated_at TIMESTAMPTZ
    )
  `);

  await db.query(`
    ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS photo_content_type TEXT,
      ADD COLUMN IF NOT EXISTS photo_size BIGINT,
      ADD COLUMN IF NOT EXISTS photo_width INTEGER,
      ADD COLUMN IF NOT EXISTS photo_height INTEGER,
      ADD COLUMN IF NOT EXISTS cleanup_scheduled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS photo_deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS backup_blob_path TEXT,
      ADD COLUMN IF NOT EXISTS backup_generated_at TIMESTAMPTZ
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_employee_time
      ON attendance_records (employee_id, server_time DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_image_hash
      ON attendance_records (image_hash)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS device_requests (
      id BIGSERIAL PRIMARY KEY,
      request_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_device_requests_status
      ON device_requests (status)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id SMALLINT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cleanup_jobs (
      id BIGSERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      backup_blob_path TEXT,
      backup_download_url TEXT,
      total_records INTEGER,
      total_photos INTEGER,
      total_bytes BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      executed_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      error TEXT
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_status
      ON cleanup_jobs (status)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS consent_logs (
      employee_id TEXT PRIMARY KEY,
      name TEXT,
      device_id TEXT,
      ip TEXT,
      user_agent TEXT,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      blob_path TEXT,
      blob_size BIGINT,
      uploaded_at TIMESTAMPTZ
    )
  `);

  initialized = true;
}

// ---------------------------
// Mock database implementation
// ---------------------------

const mockData = {
  attendanceRecords: [],
  deviceRequests: [],
  cleanupJobs: [],
  adminCredentials: null,
  consentLogs: []
};

let recordSeq = 1;
let deviceRequestSeq = 1;
let cleanupJobSeq = 1;

export async function getAdminPasswordHash() {
  if (SHOULD_USE_MOCK) {
    return mockData.adminCredentials
      ? { ...mockData.adminCredentials }
      : null;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT password_hash, updated_at
     FROM admin_credentials
     WHERE id = 1
     LIMIT 1`
  );
  return rows[0] || null;
}

export async function setAdminPasswordHash(hash) {
  if (SHOULD_USE_MOCK) {
    mockData.adminCredentials = {
      password_hash: hash,
      updated_at: new Date().toISOString()
    };
    return;
  }

  await ensureTables();
  const db = getPool();
  await db.query(
    `INSERT INTO admin_credentials (id, password_hash, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         updated_at = NOW()`,
    [hash]
  );
}

export async function hasConsentLogEntry(employeeId) {
  if (!employeeId) return false;

  if (SHOULD_USE_MOCK) {
    return mockData.consentLogs.some((entry) => entry.employeeId === employeeId);
  }

  try {
    await ensureTables();
    const db = getPool();
    const { rows } = await db.query(
      `SELECT 1
       FROM consent_logs
       WHERE employee_id = $1
       LIMIT 1`,
      [employeeId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[consent] hasConsentLogEntry error:', err.message || err);
    return false;
  }
}

export async function saveConsentLogEntry(log) {
  if (!log || !log.employeeId) return;

  const payload = {
    employeeId: log.employeeId,
    name: log.name || null,
    deviceId: log.deviceId || null,
    ip: log.ip || null,
    userAgent: log.userAgent || null,
    consentedAt: log.consentedAt ? new Date(log.consentedAt).toISOString() : new Date().toISOString(),
    blobPath: log.blobPath || null,
    blobSize: typeof log.blobSize === 'number' ? log.blobSize : null,
    uploadedAt: log.uploadedAt ? new Date(log.uploadedAt).toISOString() : null
  };

  if (SHOULD_USE_MOCK) {
    const index = mockData.consentLogs.findIndex((entry) => entry.employeeId === payload.employeeId);
    if (index >= 0) {
      mockData.consentLogs[index] = { ...mockData.consentLogs[index], ...payload };
    } else {
      mockData.consentLogs.push({ ...payload });
    }
    return;
  }

  try {
    await ensureTables();
    const db = getPool();
    await db.query(
      `INSERT INTO consent_logs (
         employee_id, name, device_id, ip, user_agent,
         consented_at, blob_path, blob_size, uploaded_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (employee_id) DO UPDATE SET
         name = EXCLUDED.name,
         device_id = EXCLUDED.device_id,
         ip = EXCLUDED.ip,
         user_agent = EXCLUDED.user_agent,
         consented_at = EXCLUDED.consented_at,
         blob_path = EXCLUDED.blob_path,
         blob_size = EXCLUDED.blob_size,
         uploaded_at = EXCLUDED.uploaded_at`,
      [
        payload.employeeId,
        payload.name,
        payload.deviceId,
        payload.ip,
        payload.userAgent,
        payload.consentedAt,
        payload.blobPath,
        payload.blobSize,
        payload.uploadedAt
      ]
    );
  } catch (err) {
    console.error('[consent] saveConsentLogEntry error:', err.message || err);
  }
}

export async function getConsentLogsFromDb() {
  if (SHOULD_USE_MOCK) {
    return mockData.consentLogs.map((entry) => ({ ...entry }));
  }

  try {
    await ensureTables();
    const db = getPool();
    const { rows } = await db.query(
      `SELECT
         employee_id,
         name,
         device_id,
         ip,
         user_agent,
         consented_at,
         blob_path,
         blob_size,
         uploaded_at
       FROM consent_logs
       ORDER BY consented_at ASC`
    );

    return rows.map((row) => ({
      employeeId: row.employee_id,
      name: row.name,
      deviceId: row.device_id,
      ip: row.ip,
      userAgent: row.user_agent,
      consentedAt: row.consented_at
        ? row.consented_at.toISOString
          ? row.consented_at.toISOString()
          : row.consented_at
        : null,
      blobPath: row.blob_path,
      blobSize: row.blob_size,
      uploadedAt: row.uploaded_at
        ? row.uploaded_at.toISOString
          ? row.uploaded_at.toISOString()
          : row.uploaded_at
        : null
    }));
  } catch (err) {
    console.error('[consent] getConsentLogsFromDb error:', err.message || err);
    return [];
  }
}

export async function getLastRecordByEmployee(employeeId) {
  if (SHOULD_USE_MOCK) {
    return (
      mockData.attendanceRecords
        .filter((r) => r.employee_id === employeeId)
        .sort((a, b) => new Date(b.server_time) - new Date(a.server_time))[0] || null
    );
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, server_time, device_id
     FROM attendance_records
     WHERE employee_id = $1
     ORDER BY server_time DESC
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

export async function findRecordByHash(imageHash) {
  if (SHOULD_USE_MOCK) {
    return mockData.attendanceRecords.find((r) => r.image_hash === imageHash) || null;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id FROM attendance_records WHERE image_hash = $1 LIMIT 1`,
    [imageHash]
  );
  return rows[0] || null;
}

export async function insertAttendanceRecord(record) {
  if (SHOULD_USE_MOCK) {
    const now = new Date().toISOString();
    const mockRecord = {
      id: recordSeq++,
      server_time: record.serverTime,
      employee_id: record.employeeId,
      name: record.name,
      ip: record.ip,
      photo_url: record.photoUrl,
      photo_blob_path: record.photoBlobPath,
      photo_content_type: record.photoContentType,
      photo_size: record.photoSize,
      photo_width: record.photoWidth,
      photo_height: record.photoHeight,
      office: record.office,
      device_id: record.deviceId,
      image_hash: record.imageHash,
      cleanup_scheduled_at: record.cleanupScheduledAt,
      created_at: now,
      photo_deleted_at: null,
      backup_blob_path: null,
      backup_generated_at: null
    };
    mockData.attendanceRecords.push(mockRecord);
    return mockRecord;
  }

  await ensureTables();
  const db = getPool();
  const {
    serverTime,
    employeeId,
    name,
    ip,
    photoUrl,
    photoBlobPath,
    photoContentType,
    photoSize,
    photoWidth,
    photoHeight,
    office,
    deviceId,
    imageHash,
    cleanupScheduledAt
  } = record;

  const { rows } = await db.query(
    `INSERT INTO attendance_records
      (server_time, employee_id, name, ip, photo_url, photo_blob_path, photo_content_type, photo_size, photo_width, photo_height, office, device_id, image_hash, cleanup_scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      serverTime,
      employeeId,
      name,
      ip,
      photoUrl,
      photoBlobPath,
      photoContentType,
      photoSize,
      photoWidth,
      photoHeight,
      office,
      deviceId,
      imageHash,
      cleanupScheduledAt
    ]
  );
  return rows[0];
}

export async function getRecords(filters = {}) {
  const {
    employeeId = null,
    startISO = null,
    endISO = null,
    limit = 500
  } = filters || {};

  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(parseInt(limit, 10), 1), 2000)
    : 500;

  if (SHOULD_USE_MOCK) {
    const list = [...mockData.attendanceRecords];
    list.sort((a, b) => new Date(b.server_time) - new Date(a.server_time));
    let result = list;
    if (employeeId) {
      result = result.filter((record) => record.employee_id === employeeId);
    }
    if (startISO) {
      const start = new Date(startISO).getTime();
      if (!Number.isNaN(start)) {
        result = result.filter((record) => new Date(record.server_time).getTime() >= start);
      }
    }
    if (endISO) {
      const end = new Date(endISO).getTime();
      if (!Number.isNaN(end)) {
        result = result.filter((record) => new Date(record.server_time).getTime() < end);
      }
    }
    return result.slice(0, normalizedLimit);
  }

  await ensureTables();
  const db = getPool();
  const conditions = [];
  const values = [];
  let index = 1;

  if (employeeId) {
    conditions.push(`employee_id = $${index++}`);
    values.push(employeeId);
  }
  if (startISO) {
    conditions.push(`server_time >= $${index++}`);
    values.push(startISO);
  }
  if (endISO) {
    conditions.push(`server_time < $${index++}`);
    values.push(endISO);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT *
    FROM attendance_records
    ${whereClause}
    ORDER BY server_time DESC
    LIMIT ${normalizedLimit}
  `;

  const { rows } = await db.query(query, values);
  return rows;
}

export async function updateDeviceId(employeeId, deviceId) {
  if (SHOULD_USE_MOCK) {
    let count = 0;
    mockData.attendanceRecords.forEach((record) => {
      if (record.employee_id === employeeId) {
        record.device_id = deviceId;
        count += 1;
      }
    });
    return count;
  }

  await ensureTables();
  const db = getPool();
  const result = await db.query(
    `UPDATE attendance_records
     SET device_id = $1
     WHERE employee_id = $2`,
    [deviceId, employeeId]
  );
  return result.rowCount;
}

export async function insertDeviceRequest(request) {
  if (SHOULD_USE_MOCK) {
    const mockRequest = {
      id: deviceRequestSeq++,
      request_id: request.requestId,
      employee_id: request.employeeId,
      name: request.name,
      device_id: request.deviceId,
      requested_at: request.requestedAt,
      status: request.status,
      approved_at: null,
      rejected_at: null
    };
    mockData.deviceRequests.push(mockRequest);
    return mockRequest;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO device_requests
      (request_id, employee_id, name, device_id, requested_at, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      request.requestId,
      request.employeeId,
      request.name,
      request.deviceId,
      request.requestedAt,
      request.status
    ]
  );
  return rows[0];
}

export async function findPendingDeviceRequest(employeeId, deviceId) {
  if (SHOULD_USE_MOCK) {
    return (
      mockData.deviceRequests.find(
        (req) => req.employee_id === employeeId && req.device_id === deviceId && req.status === 'pending'
      ) || null
    );
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM device_requests
     WHERE employee_id = $1
       AND device_id = $2
       AND status = 'pending'
     LIMIT 1`,
    [employeeId, deviceId]
  );
  return rows[0] || null;
}

export async function getDeviceRequests(status) {
  if (SHOULD_USE_MOCK) {
    const list = [...mockData.deviceRequests];
    list.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    if (status && status !== 'all') {
      return list.filter((req) => req.status === status);
    }
    return list;
  }

  await ensureTables();
  const db = getPool();
  if (status && status !== 'all') {
    const { rows } = await db.query(
      `SELECT * FROM device_requests
       WHERE status = $1
       ORDER BY requested_at DESC`,
      [status]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT * FROM device_requests
     ORDER BY requested_at DESC`
  );
  return rows;
}

export async function getDeviceRequestById(requestId) {
  if (SHOULD_USE_MOCK) {
    return mockData.deviceRequests.find((req) => req.request_id === requestId) || null;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM device_requests WHERE request_id = $1 LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
}

export async function completeDeviceRequest(requestId, status) {
  if (SHOULD_USE_MOCK) {
    const target = mockData.deviceRequests.find((req) => req.request_id === requestId);
    if (!target) return;
    const timestamp = new Date().toISOString();
    if (status === 'approved') {
      target.status = 'approved';
      target.approved_at = timestamp;
      target.rejected_at = null;
    } else if (status === 'rejected') {
      target.status = 'rejected';
      target.rejected_at = timestamp;
      target.approved_at = null;
    }
    return;
  }

  await ensureTables();
  const db = getPool();
  const timestamp = new Date();
  if (status === 'approved') {
    await db.query(
      `UPDATE device_requests
       SET status = 'approved', approved_at = $1, rejected_at = NULL
       WHERE request_id = $2`,
      [timestamp, requestId]
    );
  } else if (status === 'rejected') {
    await db.query(
      `UPDATE device_requests
       SET status = 'rejected', rejected_at = $1, approved_at = NULL
       WHERE request_id = $2`,
      [timestamp, requestId]
    );
  }
}

export async function deleteRecordsByIds(recordIds) {
  const ids = recordIds.map(Number).filter((n) => Number.isInteger(n));
  if (ids.length === 0) return [];

  if (SHOULD_USE_MOCK) {
    const removed = [];
    mockData.attendanceRecords = mockData.attendanceRecords.filter((record) => {
      if (ids.includes(record.id)) {
        removed.push({ photo_blob_path: record.photo_blob_path });
        return false;
      }
      return true;
    });
    return removed;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `DELETE FROM attendance_records
     WHERE id = ANY($1::int[])
     RETURNING photo_blob_path`,
    [ids]
  );
  return rows;
}

export async function deleteAllRecords() {
  if (SHOULD_USE_MOCK) {
    const removed = mockData.attendanceRecords.map((record) => ({ photo_blob_path: record.photo_blob_path }));
    mockData.attendanceRecords = [];
    return removed;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `DELETE FROM attendance_records
     RETURNING photo_blob_path`
  );
  return rows;
}

export async function clearPhotoFields(recordId) {
  if (SHOULD_USE_MOCK) {
    const record = mockData.attendanceRecords.find((r) => r.id === recordId);
    if (!record) return;
    record.photo_url = null;
    record.photo_blob_path = null;
    record.image_hash = null;
    record.photo_deleted_at = new Date().toISOString();
    return;
  }

  await ensureTables();
  const db = getPool();
  await db.query(
    `UPDATE attendance_records
     SET photo_url = NULL,
         photo_blob_path = NULL,
         image_hash = NULL,
         photo_deleted_at = NOW()
     WHERE id = $1`,
    [recordId]
  );
}

export async function getRecordById(recordId) {
  if (SHOULD_USE_MOCK) {
    return mockData.attendanceRecords.find((record) => record.id === recordId) || null;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM attendance_records WHERE id = $1 LIMIT 1`,
    [recordId]
  );
  return rows[0] || null;
}

export async function getStats() {
  if (SHOULD_USE_MOCK) {
    const total = mockData.attendanceRecords.length;
    const today = mockData.attendanceRecords.filter((record) => {
      const date = new Date(record.server_time);
      const now = new Date();
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }).length;
    const pending = mockData.deviceRequests.filter((req) => req.status === 'pending').length;
    return { total, today, pending };
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(CASE WHEN DATE(server_time) = CURRENT_DATE THEN 1 END) AS today
     FROM attendance_records`
  );
  const base = rows[0] || { total: '0', today: '0' };

  const pending = await db.query(
    `SELECT COUNT(*) AS pending
     FROM device_requests
     WHERE status = 'pending'`
  );

  return {
    total: Number(base.total || 0),
    today: Number(base.today || 0),
    pending: Number(pending.rows[0]?.pending || 0)
  };
}

export async function getAllRecordsRaw() {
  if (SHOULD_USE_MOCK) {
    const list = [...mockData.attendanceRecords];
    list.sort((a, b) => new Date(a.server_time) - new Date(b.server_time));
    return list;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM attendance_records ORDER BY server_time ASC`
  );
  return rows;
}

export async function getRecordsForCleanup(startISO, endISO) {
  if (SHOULD_USE_MOCK) {
    return mockData.attendanceRecords
      .filter((record) => {
        const time = new Date(record.server_time).getTime();
        return (
          time >= new Date(startISO).getTime() &&
          time < new Date(endISO).getTime() &&
          record.photo_url
        );
      })
      .sort((a, b) => new Date(a.server_time) - new Date(b.server_time));
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT *
     FROM attendance_records
     WHERE server_time >= $1
       AND server_time < $2
       AND photo_url IS NOT NULL
     ORDER BY server_time ASC`,
    [startISO, endISO]
  );
  return rows;
}

export async function markRecordsAfterCleanup(recordIds, options = {}) {
  if (!Array.isArray(recordIds) || recordIds.length === 0) return 0;

  if (SHOULD_USE_MOCK) {
    let count = 0;
    recordIds.forEach((id) => {
      const record = mockData.attendanceRecords.find((r) => r.id === id);
      if (record) {
        record.photo_url = null;
        record.photo_blob_path = null;
        record.photo_deleted_at = new Date().toISOString();
        if (options.backupBlobPath) record.backup_blob_path = options.backupBlobPath;
        if (options.backupGeneratedAt) record.backup_generated_at = options.backupGeneratedAt;
        count += 1;
      }
    });
    return count;
  }

  await ensureTables();
  const db = getPool();
  const { rowCount } = await db.query(
    `UPDATE attendance_records
     SET photo_url = NULL,
         photo_blob_path = NULL,
         photo_deleted_at = NOW(),
         backup_blob_path = COALESCE($2, backup_blob_path),
         backup_generated_at = COALESCE($3, backup_generated_at)
     WHERE id = ANY($1::int[])`,
    [recordIds, options.backupBlobPath || null, options.backupGeneratedAt || null]
  );
  return rowCount;
}

export async function createCleanupJob(job) {
  if (SHOULD_USE_MOCK) {
    const now = new Date().toISOString();
    const mockJob = {
      id: cleanupJobSeq++,
      period_start: job.periodStart,
      period_end: job.periodEnd,
      status: job.status || 'pending',
      backup_blob_path: job.backupBlobPath || null,
      backup_download_url: job.backupDownloadUrl || null,
      total_records: job.totalRecords || 0,
      total_photos: job.totalPhotos || 0,
      total_bytes: job.totalBytes || 0,
      created_at: now,
      updated_at: now,
      executed_at: job.executedAt || null,
      finished_at: job.finishedAt || null,
      error: job.error || null
    };
    mockData.cleanupJobs.push(mockJob);
    return mockJob;
  }

  await ensureTables();
  const db = getPool();
  const {
    periodStart,
    periodEnd,
    status = 'pending',
    backupBlobPath = null,
    backupDownloadUrl = null,
    totalRecords = 0,
    totalPhotos = 0,
    totalBytes = 0,
    executedAt = null,
    finishedAt = null,
    error = null
  } = job;

  const { rows } = await db.query(
    `INSERT INTO cleanup_jobs
      (period_start, period_end, status, backup_blob_path, backup_download_url, total_records, total_photos, total_bytes, created_at, executed_at, finished_at, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
     RETURNING *`,
    [
      periodStart,
      periodEnd,
      status,
      backupBlobPath,
      backupDownloadUrl,
      totalRecords,
      totalPhotos,
      totalBytes,
      executedAt,
      finishedAt,
      error
    ]
  );

  return rows[0];
}

export async function updateCleanupJob(jobId, patch) {
  if (SHOULD_USE_MOCK) {
    const job = mockData.cleanupJobs.find((item) => item.id === jobId);
    if (!job) return null;
    Object.entries(patch).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeCase = camelToSnake(key);
        job[snakeCase] = value;
      }
    });
    job.updated_at = new Date().toISOString();
    return job;
  }

  await ensureTables();
  const db = getPool();

  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${camelToSnake(key)} = $${index}`);
    values.push(value);
    index += 1;
  }

  if (fields.length === 0) {
    const { rows } = await db.query(`SELECT * FROM cleanup_jobs WHERE id = $1`, [jobId]);
    return rows[0] || null;
  }

  values.push(jobId);

  const { rows } = await db.query(
    `UPDATE cleanup_jobs
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function getLatestCleanupJob(periodStart, periodEnd) {
  if (SHOULD_USE_MOCK) {
    const list = mockData.cleanupJobs
      .filter((job) => job.period_start === periodStart && job.period_end === periodEnd)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list[0] || null;
  }

  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT *
     FROM cleanup_jobs
     WHERE period_start = $1 AND period_end = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [periodStart, periodEnd]
  );
  return rows[0] || null;
}

function camelToSnake(str = '') {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
