import { Pool } from 'pg';

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
    throw new Error('POSTGRES_URL 또는 SUPABASE_PROJECT_ID/SUPABASE_DB_PASSWORD 환경변수를 설정해주세요.');
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function getPool() {
  if (!pool) {
    const connectionString = resolveConnectionString();
    const sslMode = (process.env.POSTGRES_SSL || 'require').toLowerCase();
    const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString, ssl });
  }
  return pool;
}

let initialized = false;

async function ensureTables() {
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

  initialized = true;
}

export async function getLastRecordByEmployee(employeeId) {
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
  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id FROM attendance_records WHERE image_hash = $1 LIMIT 1`,
    [imageHash]
  );
  return rows[0] || null;
}

export async function insertAttendanceRecord(record) {
  await ensureTables();
  const db = getPool();
  const {
    serverTime,
    employeeId,
    name,
    ip,
    photoUrl,
    photoBlobPath,
    office,
    deviceId,
    imageHash
  } = record;

  const { rows } = await db.query(
    `INSERT INTO attendance_records
      (server_time, employee_id, name, ip, photo_url, photo_blob_path, office, device_id, image_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [serverTime, employeeId, name, ip, photoUrl, photoBlobPath, office, deviceId, imageHash]
  );
  return rows[0];
}

export async function getRecords(employeeId) {
  await ensureTables();
  const db = getPool();
  if (employeeId) {
    const { rows } = await db.query(
      `SELECT * FROM attendance_records
       WHERE employee_id = $1
       ORDER BY server_time DESC`,
      [employeeId]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT * FROM attendance_records
     ORDER BY server_time DESC`
  );
  return rows;
}

export async function updateDeviceId(employeeId, deviceId) {
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
  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM device_requests WHERE request_id = $1 LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
}

export async function completeDeviceRequest(requestId, status) {
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
  await ensureTables();
  const db = getPool();
  const ids = recordIds.map(Number).filter((n) => Number.isInteger(n));
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    `DELETE FROM attendance_records
     WHERE id = ANY($1::int[])
     RETURNING photo_blob_path`,
    [ids]
  );
  return rows;
}

export async function deleteAllRecords() {
  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `DELETE FROM attendance_records
     RETURNING photo_blob_path`
  );
  return rows;
}

export async function clearPhotoFields(recordId) {
  await ensureTables();
  const db = getPool();
  await db.query(
    `UPDATE attendance_records
     SET photo_url = NULL,
         photo_blob_path = NULL,
         image_hash = NULL
     WHERE id = $1`,
    [recordId]
  );
}

export async function getRecordById(recordId) {
  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM attendance_records WHERE id = $1 LIMIT 1`,
    [recordId]
  );
  return rows[0] || null;
}

export async function getStats() {
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
  await ensureTables();
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM attendance_records ORDER BY server_time ASC`
  );
  return rows;
}
