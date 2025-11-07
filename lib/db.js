import { sql } from '@vercel/postgres';

let initialized = false;

async function ensureTables() {
  if (initialized) return;

  await sql`
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
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_employee_time
      ON attendance_records (employee_id, server_time DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_image_hash
      ON attendance_records (image_hash)
  `;

  await sql`
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
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_device_requests_status
      ON device_requests (status)
  `;

  initialized = true;
}

export async function getLastRecordByEmployee(employeeId) {
  await ensureTables();
  const { rows } = await sql`
    SELECT id, server_time, device_id
    FROM attendance_records
    WHERE employee_id = ${employeeId}
    ORDER BY server_time DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function findRecordByHash(imageHash) {
  await ensureTables();
  const { rows } = await sql`
    SELECT id FROM attendance_records WHERE image_hash = ${imageHash} LIMIT 1
  `;
  return rows[0] || null;
}

export async function insertAttendanceRecord(record) {
  await ensureTables();
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

  const { rows } = await sql`
    INSERT INTO attendance_records (server_time, employee_id, name, ip, photo_url, photo_blob_path, office, device_id, image_hash)
    VALUES (${serverTime}, ${employeeId}, ${name}, ${ip}, ${photoUrl}, ${photoBlobPath}, ${office}, ${deviceId}, ${imageHash})
    RETURNING *
  `;
  return rows[0];
}

export async function getRecords(employeeId) {
  await ensureTables();
  if (employeeId) {
    const { rows } = await sql`
      SELECT * FROM attendance_records
      WHERE employee_id = ${employeeId}
      ORDER BY server_time DESC
    `;
    return rows;
  }
  const { rows } = await sql`
    SELECT * FROM attendance_records
    ORDER BY server_time DESC
  `;
  return rows;
}

export async function updateDeviceId(employeeId, deviceId) {
  await ensureTables();
  const { rowCount } = await sql`
    UPDATE attendance_records
    SET device_id = ${deviceId}
    WHERE employee_id = ${employeeId}
  `;
  return rowCount;
}

export async function insertDeviceRequest(request) {
  await ensureTables();
  const { rows } = await sql`
    INSERT INTO device_requests (request_id, employee_id, name, device_id, requested_at, status)
    VALUES (${request.requestId}, ${request.employeeId}, ${request.name}, ${request.deviceId}, ${request.requestedAt}, ${request.status})
    RETURNING *
  `;
  return rows[0];
}

export async function findPendingDeviceRequest(employeeId, deviceId) {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM device_requests
    WHERE employee_id = ${employeeId}
      AND device_id = ${deviceId}
      AND status = 'pending'
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getDeviceRequests(status) {
  await ensureTables();
  if (status && status !== 'all') {
    const { rows } = await sql`
      SELECT * FROM device_requests
      WHERE status = ${status}
      ORDER BY requested_at DESC
    `;
    return rows;
  }
  const { rows } = await sql`
    SELECT * FROM device_requests
    ORDER BY requested_at DESC
  `;
  return rows;
}

export async function getDeviceRequestById(requestId) {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM device_requests WHERE request_id = ${requestId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function completeDeviceRequest(requestId, status) {
  await ensureTables();
  const timestamp = new Date();
  if (status === 'approved') {
    await sql`
      UPDATE device_requests
      SET status = 'approved', approved_at = ${timestamp}, rejected_at = NULL
      WHERE request_id = ${requestId}
    `;
  } else if (status === 'rejected') {
    await sql`
      UPDATE device_requests
      SET status = 'rejected', rejected_at = ${timestamp}, approved_at = NULL
      WHERE request_id = ${requestId}
    `;
  }
}

export async function deleteRecordsByIds(recordIds) {
  await ensureTables();
  const { rows } = await sql`
    DELETE FROM attendance_records
    WHERE id = ANY(${recordIds})
    RETURNING photo_blob_path
  `;
  return rows;
}

export async function deleteAllRecords() {
  await ensureTables();
  const { rows } = await sql`
    DELETE FROM attendance_records
    RETURNING photo_blob_path
  `;
  return rows;
}

export async function clearPhotoFields(recordId) {
  await ensureTables();
  await sql`
    UPDATE attendance_records
    SET photo_url = NULL,
        photo_blob_path = NULL,
        image_hash = NULL
    WHERE id = ${recordId}
  `;
}

export async function getRecordById(recordId) {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM attendance_records WHERE id = ${recordId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function getStats() {
  await ensureTables();
  const { rows } = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN DATE(server_time) = CURRENT_DATE THEN 1 END) AS today
    FROM attendance_records
  `;
  const base = rows[0] || { total: '0', today: '0' };

  const pending = await sql`
    SELECT COUNT(*) AS pending
    FROM device_requests
    WHERE status = 'pending'
  `;

  return {
    total: Number(base.total),
    today: Number(base.today),
    pending: Number(pending.rows[0]?.pending || 0)
  };
}

export async function getAllRecordsRaw() {
  await ensureTables();
  const { rows } = await sql`
    SELECT * FROM attendance_records ORDER BY server_time ASC
  `;
  return rows;
}
