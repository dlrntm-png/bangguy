console.warn('[db] Using in-memory mock database only. 모든 데이터는 서버 재시작 시 초기화됩니다.');

const mockData = {
  attendanceRecords: [],
  deviceRequests: [],
  cleanupJobs: [],
  adminCredentials: null
};

let recordSeq = 1;
let deviceRequestSeq = 1;
let cleanupJobSeq = 1;

export async function getAdminPasswordHash() {
  return mockData.adminCredentials
    ? { ...mockData.adminCredentials }
    : null;
}

export async function setAdminPasswordHash(hash) {
  mockData.adminCredentials = {
    password_hash: hash,
    updated_at: new Date().toISOString()
  };
}

export async function getLastRecordByEmployee(employeeId) {
  return (
    mockData.attendanceRecords
      .filter((r) => r.employee_id === employeeId)
      .sort((a, b) => new Date(b.server_time) - new Date(a.server_time))[0] || null
  );
}

export async function findRecordByHash(imageHash) {
  return mockData.attendanceRecords.find((r) => r.image_hash === imageHash) || null;
}

export async function insertAttendanceRecord(record) {
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

export async function getRecords(employeeId) {
  const list = [...mockData.attendanceRecords];
  list.sort((a, b) => new Date(b.server_time) - new Date(a.server_time));
  if (employeeId) {
    return list.filter((record) => record.employee_id === employeeId);
  }
  return list;
}

export async function updateDeviceId(employeeId, deviceId) {
  let count = 0;
  mockData.attendanceRecords.forEach((record) => {
    if (record.employee_id === employeeId) {
      record.device_id = deviceId;
      count += 1;
    }
  });
  return count;
}

export async function insertDeviceRequest(request) {
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

export async function findPendingDeviceRequest(employeeId, deviceId) {
  return (
    mockData.deviceRequests.find(
      (req) => req.employee_id === employeeId && req.device_id === deviceId && req.status === 'pending'
    ) || null
  );
}

export async function getDeviceRequests(status) {
  const list = [...mockData.deviceRequests];
  list.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
  if (status && status !== 'all') {
    return list.filter((req) => req.status === status);
  }
  return list;
}

export async function getDeviceRequestById(requestId) {
  return mockData.deviceRequests.find((req) => req.request_id === requestId) || null;
}

export async function completeDeviceRequest(requestId, status) {
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
}

export async function deleteRecordsByIds(recordIds) {
  const ids = recordIds.map(Number).filter((n) => Number.isInteger(n));
  if (ids.length === 0) return [];

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

export async function deleteAllRecords() {
  const removed = mockData.attendanceRecords.map((record) => ({ photo_blob_path: record.photo_blob_path }));
  mockData.attendanceRecords = [];
  return removed;
}

export async function clearPhotoFields(recordId) {
  const record = mockData.attendanceRecords.find((r) => r.id === recordId);
  if (!record) return;
  record.photo_url = null;
  record.photo_blob_path = null;
  record.image_hash = null;
  record.photo_deleted_at = new Date().toISOString();
}

export async function getRecordById(recordId) {
  return mockData.attendanceRecords.find((record) => record.id === recordId) || null;
}

export async function getStats() {
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

export async function getAllRecordsRaw() {
  const list = [...mockData.attendanceRecords];
  list.sort((a, b) => new Date(a.server_time) - new Date(b.server_time));
  return list;
}

export async function getRecordsForCleanup(startISO, endISO) {
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

export async function markRecordsAfterCleanup(recordIds, options = {}) {
  if (!Array.isArray(recordIds) || recordIds.length === 0) return 0;

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

export async function createCleanupJob(job) {
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

export async function updateCleanupJob(jobId, patch) {
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

export async function getLatestCleanupJob(periodStart, periodEnd) {
  const list = mockData.cleanupJobs
    .filter((job) => job.period_start === periodStart && job.period_end === periodEnd)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list[0] || null;
}

function camelToSnake(str = '') {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
