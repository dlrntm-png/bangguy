import express from 'express';
import { verifyAdminToken } from '../../lib/adminAuth.js';
import { getAdminPasswordHash } from '../../lib/db.js';
import {
  DEFAULT_ADMIN_PASSWORD_HASH,
  verifyPasswordHash
} from '../../lib/password.js';
import { issueAdminToken } from '../../lib/adminAuth.js';
import { getRecords, getAllRecordsRaw } from '../../lib/db.js';
import {
  deleteRecordsByIds,
  deleteAllRecords
} from '../../lib/db.js';
import { deleteBlob } from '../../lib/blob.js';
import { getDeviceRequests, getDeviceRequestById, completeDeviceRequest, updateDeviceId } from '../../lib/db.js';
import { getRecordById, clearPhotoFields } from '../../lib/db.js';
import { buildCsv } from '../../lib/csv.js';
import { listBlobs, getStorageUsage, createSignedBlobDownload, getPublicUrl, readBlobBuffer } from '../../lib/blob.js';
import { getConsentLogs } from '../../lib/consent.js';
import { getAllowedIps, addAllowedIp, removeAllowedIp } from '../../lib/db.js';
import { invalidateAllowedIpsCache, refreshAllowedIpsCache, getClientIp } from '../../lib/ip.js';

const router = express.Router();

// 관리자 인증 미들웨어
const requireAdmin = (req, res, next) => {
  try {
    verifyAdminToken(req);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }
};

// 로그인
router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const isDevMode = process.env.NODE_ENV !== 'production';
  const allowFallback =
    isDevMode && process.env.ALLOW_DEV_ADMIN_PASSWORD !== 'false';
  const fallbackPassword =
    allowFallback && (process.env.ADMIN_PASSWORD || 'admin123');

  if (!password) {
    return res.status(400).json({ ok: false, message: '비밀번호를 입력해주세요.' });
  }

  try {
    const record = await getAdminPasswordHash();
    const envHash =
      (process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH || '').trim() ||
      null;
    const storedHash = record?.password_hash || envHash;

    if (storedHash) {
      const valid = verifyPasswordHash(password, storedHash);
      if (!valid) {
        return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
      }
    } else if (fallbackPassword) {
      if (password !== fallbackPassword) {
        return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
      }
    } else {
      return res.status(503).json({
        ok: false,
        message:
          '관리자 비밀번호가 초기화되지 않았습니다. 환경 변수 ADMIN_PASSWORD_HASH 를 설정하거나 비밀번호 변경 API로 초기 비밀번호를 등록하세요.'
      });
    }
  } catch (err) {
    console.error('login error (password lookup):', err);
    return res.status(500).json({ ok: false, message: '로그인 정보를 확인할 수 없습니다.' });
  }

  try {
    const token = issueAdminToken();
    return res.status(200).json({ ok: true, token, message: '로그인 성공' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, message: '토큰 발급 실패' });
  }
});

// 인증 확인
router.get('/check', requireAdmin, (req, res) => {
  res.status(200).json({ ok: true, message: '인증됨' });
});

// 기록 조회
router.get('/records', requireAdmin, async (req, res) => {
  function buildDayRangeKst(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const start = new Date(`${dateStr}T00:00:00+09:00`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function buildMonthRangeKst(monthStr) {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return null;
    const start = new Date(`${monthStr}-01T00:00:00+09:00`);
    if (Number.isNaN(start.getTime())) return null;
    const [yearStr, monthStrNum] = monthStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStrNum);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
    const nextMonth =
      month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const end = new Date(`${nextMonth}-01T00:00:00+09:00`);
    if (Number.isNaN(end.getTime())) return null;
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const employeeId = req.query.employeeId ? String(req.query.employeeId).trim() : null;
  const dateQuery = req.query.date ? String(req.query.date).trim() : null;
  const monthQuery = req.query.month ? String(req.query.month).trim() : null;

  if (dateQuery && monthQuery) {
    return res.status(400).json({ ok: false, message: '날짜와 월을 동시에 사용할 수 없습니다.' });
  }

  let range = null;
  if (dateQuery) {
    range = buildDayRangeKst(dateQuery);
    if (!range) {
      return res.status(400).json({ ok: false, message: '잘못된 날짜 형식입니다. (예: 2025-11-11)' });
    }
  } else if (monthQuery) {
    range = buildMonthRangeKst(monthQuery);
    if (!range) {
      return res.status(400).json({ ok: false, message: '잘못된 월 형식입니다. (예: 2025-11)' });
    }
  }

  try {
    const records = await getRecords({
      employeeId,
      startISO: range?.start,
      endISO: range?.end
    });
    // 사진 URL 생성 (B2 사용 시 프록시 URL 사용하여 CORS 문제 해결)
    const mapped = await Promise.all(records.map(async (row) => {
      let photoUrl = row.photo_url;
      
      // B2를 사용하고 pathname이 있는 경우 항상 프록시 URL 사용 (CORS 문제 해결)
      if (row.photo_blob_path && process.env.B2_ENDPOINT) {
        // Public URL이 있으면 우선 사용
        const publicUrl = getPublicUrl(row.photo_blob_path);
        if (publicUrl) {
          photoUrl = publicUrl;
        } else {
          // Public URL이 없으면 항상 프록시 URL 사용 (signed URL 무시)
          // pathname을 URL 인코딩하여 프록시 경로 생성
          const encodedPath = encodeURIComponent(row.photo_blob_path);
          photoUrl = `/api/admin/photo/${encodedPath}`;
        }
      } else if (row.photo_blob_path) {
        // 파일 시스템 사용 시 상대 경로로 변환
        if (!photoUrl || !photoUrl.startsWith('http')) {
          photoUrl = `/storage/${row.photo_blob_path.replace(/^\/+/, '')}`;
        }
      }
      
      return {
        recordId: row.id,
        server_time: row.server_time,
        employee_id: row.employee_id,
        name: row.name,
        ip: row.ip,
        file: photoUrl,
        photo_blob_path: row.photo_blob_path,
        photo_content_type: row.photo_content_type,
        photo_size: row.photo_size,
        photo_width: row.photo_width,
        photo_height: row.photo_height,
        office: row.office,
        device_id: row.device_id,
        image_hash: row.image_hash,
        cleanup_scheduled_at: row.cleanup_scheduled_at,
        photo_deleted_at: row.photo_deleted_at,
        backup_blob_path: row.backup_blob_path,
        backup_generated_at: row.backup_generated_at
      };
    }));

    return res.status(200).json({ ok: true, records: mapped });
  } catch (err) {
    console.error('records error:', err);
    return res.status(500).json({ ok: false, message: '기록 조회 실패' });
  }
});

// 기록 삭제
router.post('/delete-records', requireAdmin, async (req, res) => {
  const { recordIds, deleteAll } = req.body || {};

  try {
    let deleted = 0;
    let blobPaths = [];

    if (deleteAll) {
      const rows = await deleteAllRecords();
      deleted = rows.length;
      blobPaths = rows
        .map((row) => row.photo_blob_path)
        .filter(Boolean);
    } else {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return res.status(400).json({ ok: false, message: '삭제할 기록을 선택해주세요.' });
      }
      const ids = recordIds.map(Number).filter((n) => Number.isInteger(n));
      if (ids.length === 0) {
        return res.status(400).json({ ok: false, message: '유효한 기록 번호가 없습니다.' });
      }
      const rows = await deleteRecordsByIds(ids);
      deleted = rows.length;
      if (deleted === 0) {
        return res.status(404).json({ ok: false, message: '선택한 기록을 찾을 수 없습니다.' });
      }
      blobPaths = rows
        .map((row) => row.photo_blob_path)
        .filter(Boolean);
    }

    // 대량 삭제 시 배치 처리로 타임아웃 방지
    const BATCH_SIZE = 50;
    let deletedFiles = 0;
    let failedFiles = 0;

    if (blobPaths.length > 0) {
      for (let i = 0; i < blobPaths.length; i += BATCH_SIZE) {
        const batch = blobPaths.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((path) => deleteBlob(path).catch((err) => {
            console.warn(`[delete-records] Blob 삭제 실패: ${path}`, err?.message);
            throw err;
          }))
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            deletedFiles++;
          } else {
            failedFiles++;
          }
        });

        // 배치 간 짧은 대기 (API 제한 방지)
        if (i + BATCH_SIZE < blobPaths.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      deleted,
      deletedFiles,
      failedFiles,
      message: `${deleted}건의 기록과 ${deletedFiles}개의 파일이 삭제되었습니다.${failedFiles > 0 ? ` (${failedFiles}개 파일 삭제 실패)` : ''}`
    });
  } catch (err) {
    console.error('delete-records error:', err);
    return res.status(500).json({ ok: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
});

// 사진 삭제
router.post('/delete-photo', requireAdmin, async (req, res) => {
  const { recordId } = req.body || {};
  if (!recordId) {
    return res.status(400).json({ ok: false, message: 'recordId가 필요합니다.' });
  }

  try {
    const record = await getRecordById(Number(recordId));
    if (!record) {
      return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
    }

    if (record.photo_blob_path) {
      await deleteBlob(record.photo_blob_path);
    }

    await clearPhotoFields(record.id);

    return res.status(200).json({ ok: true, message: '사진이 삭제되었습니다.' });
  } catch (err) {
    console.error('delete-photo error:', err);
    return res.status(500).json({ ok: false, message: '파일 삭제 실패' });
  }
});

// 기기 ID 업데이트
router.post('/update-device', requireAdmin, async (req, res) => {
  const { employeeId, deviceId } = req.body || {};
  if (!employeeId || !deviceId) {
    return res.status(400).json({ ok: false, message: 'employeeId와 deviceId가 필요합니다.' });
  }

  try {
    await updateDeviceId(employeeId, deviceId);
    return res.status(200).json({ ok: true, message: '기기 ID가 업데이트되었습니다.' });
  } catch (err) {
    console.error('update-device error:', err);
    return res.status(500).json({ ok: false, message: '기기 ID 업데이트 실패' });
  }
});

// 기기 재등록 요청 조회
router.get('/device-requests', requireAdmin, async (req, res) => {
  const status = req.query.status ? String(req.query.status) : 'all';

  try {
    const requests = await getDeviceRequests(status === 'all' ? null : status);
    const mapped = requests.map((row) => ({
      id: row.request_id,
      employeeId: row.employee_id,
      name: row.name,
      deviceId: row.device_id,
      requestedAt: row.requested_at,
      status: row.status,
      approvedAt: row.approved_at,
      rejectedAt: row.rejected_at
    }));

    return res.status(200).json({ ok: true, requests: mapped });
  } catch (err) {
    console.error('device-requests error:', err);
    return res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// 기기 재등록 요청 승인
router.post('/approve-device-request', requireAdmin, async (req, res) => {
  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ ok: false, message: 'requestId가 필요합니다.' });
  }

  try {
    const request = await getDeviceRequestById(requestId);
    if (!request) {
      return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: '이미 처리된 요청입니다.' });
    }

    const updated = await updateDeviceId(request.employee_id, request.device_id);
    await completeDeviceRequest(requestId, 'approved');

    return res.status(200).json({ ok: true, updated, message: '요청이 승인되었습니다.' });
  } catch (err) {
    console.error('approve-device-request error:', err);
    return res.status(500).json({ ok: false, message: '승인 처리 실패' });
  }
});

// 기기 재등록 요청 거부
router.post('/reject-device-request', requireAdmin, async (req, res) => {
  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ ok: false, message: 'requestId가 필요합니다.' });
  }

  try {
    const request = await getDeviceRequestById(requestId);
    if (!request) {
      return res.status(404).json({ ok: false, message: '요청을 찾을 수 없습니다.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: '이미 처리된 요청입니다.' });
    }

    await completeDeviceRequest(requestId, 'rejected');
    return res.status(200).json({ ok: true, message: '요청이 거부되었습니다.' });
  } catch (err) {
    console.error('reject-device-request error:', err);
    return res.status(500).json({ ok: false, message: '거부 처리 실패' });
  }
});

// CSV 다운로드
router.get('/download-csv', requireAdmin, async (req, res) => {
  try {
    const rows = await getAllRecordsRaw();
    
    function formatKst(value) {
      if (!value) return '';
      try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        return [
          `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}`,
          `${pad(kst.getHours())}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`
        ].join(' ');
      } catch {
        return String(value);
      }
    }

    const csv = buildCsv(rows, [
      { header: 'server_time', value: (row) => formatKst(row.server_time) },
      { key: 'employee_id' },
      { key: 'name' },
      { key: 'ip' },
      { key: 'photo_url' },
      { key: 'photo_blob_path' },
      { key: 'photo_content_type' },
      { key: 'photo_size' },
      { key: 'photo_width' },
      { key: 'photo_height' },
      { header: 'office', value: (row) => (row.office ? 'true' : 'false') },
      { key: 'device_id' },
      { key: 'image_hash' },
      { header: 'cleanup_scheduled_at', value: (row) => formatKst(row.cleanup_scheduled_at) },
      { header: 'photo_deleted_at', value: (row) => formatKst(row.photo_deleted_at) },
      { key: 'backup_blob_path' },
      { header: 'backup_generated_at', value: (row) => formatKst(row.backup_generated_at) }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('download-csv error:', err);
    return res.status(500).json({ ok: false, message: '다운로드 실패' });
  }
});

// 전체 Blob 삭제
router.post('/delete-all-blobs', requireAdmin, async (req, res) => {
  const { prefix, confirm } = req.body || {};

  if (confirm !== 'DELETE_ALL_BLOBS') {
    return res.status(400).json({
      ok: false,
      message: '안전을 위해 confirm 파라미터가 필요합니다. { confirm: "DELETE_ALL_BLOBS" }'
    });
  }

  try {
    console.log(`[delete-all-blobs] 시작 - prefix: ${prefix || '(전체)'}`);
    
    const blobs = await listBlobs(prefix || '');
    console.log(`[delete-all-blobs] 발견된 Blob 수: ${blobs.length}`);

    if (blobs.length === 0) {
      return res.status(200).json({
        ok: true,
        deleted: 0,
        message: '삭제할 Blob이 없습니다.'
      });
    }

    const BATCH_SIZE = 50;
    let deleted = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
      const batch = blobs.slice(i, i + BATCH_SIZE);
      console.log(`[delete-all-blobs] 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(blobs.length / BATCH_SIZE)} 처리 중... (${batch.length}개)`);
      
      const results = await Promise.allSettled(
        batch.map((blob) => deleteBlob(blob.pathname))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          deleted++;
        } else {
          failed++;
          errors.push({
            pathname: batch[idx].pathname,
            error: result.reason?.message || String(result.reason)
          });
        }
      });

      if (i + BATCH_SIZE < blobs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[delete-all-blobs] 완료 - 삭제: ${deleted}, 실패: ${failed}`);

    return res.status(200).json({
      ok: true,
      deleted,
      failed,
      total: blobs.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      message: `${deleted}개의 Blob이 삭제되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ''}`
    });
  } catch (err) {
    console.error('[delete-all-blobs] 오류:', err);
    return res.status(500).json({
      ok: false,
      message: 'Blob 삭제 처리 중 오류가 발생했습니다.',
      error: err.message
    });
  }
});

// 스토리지 사용량 조회
router.get('/storage-usage', requireAdmin, async (req, res) => {
  try {
    const usage = await getStorageUsage();
    res.json({ ok: true, ...usage });
  } catch (err) {
    console.error('[admin] storage usage error:', err);
    res.status(500).json({ ok: false, message: '사용량 조회 실패', error: err.message });
  }
});

// 동의 로그 다운로드
router.get('/download-consent-logs', requireAdmin, async (req, res) => {
  try {
    const logs = await getConsentLogs();
    if (!logs || logs.length === 0) {
      return res.status(204).end();
    }

    function formatKst(value) {
      if (!value) return '';
      try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())} ${pad(kst.getHours())}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`;
      } catch {
        return String(value);
      }
    }

    const csv = buildCsv(logs, [
      { header: 'consented_at', value: (row) => formatKst(row.consentedAt) },
      { key: 'employeeId', header: 'employee_id' },
      { key: 'name' },
      { key: 'deviceId', header: 'device_id' },
      { key: 'ip' },
      { key: 'userAgent', header: 'user_agent' },
      { key: 'blobPath', header: 'blob_path' },
      { key: 'blobSize', header: 'blob_size' },
      { header: 'uploaded_at', value: (row) => formatKst(row.uploadedAt) }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent_logs_${new Date().toISOString().split('T')[0]}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin] download consent logs error:', err);
    return res.status(500).json({ ok: false, message: '동의 로그 다운로드에 실패했습니다.' });
  }
});

// 현재 IP 확인
router.get('/my-ip', requireAdmin, (req, res) => {
  const ip = getClientIp(req);
  res.status(200).json({ ok: true, ip });
});

// 허용된 IP 목록 조회
router.get('/allowed-ips', requireAdmin, async (req, res) => {
  try {
    const ips = await getAllowedIps();
    return res.status(200).json({ ok: true, ips });
  } catch (err) {
    console.error('[admin] get allowed ips error:', err);
    return res.status(500).json({ ok: false, message: 'IP 목록 조회에 실패했습니다.' });
  }
});

// IP 추가
router.post('/allowed-ips', requireAdmin, async (req, res) => {
  const { ip_cidr, description } = req.body || {};

  if (!ip_cidr || typeof ip_cidr !== 'string' || !ip_cidr.trim()) {
    return res.status(400).json({ ok: false, message: 'IP/CIDR를 입력해주세요.' });
  }

  try {
    const ip = await addAllowedIp(ip_cidr.trim(), description || null, 'admin');
    // 캐시 무효화 후 즉시 재로드
    invalidateAllowedIpsCache();
    await refreshAllowedIpsCache();
    return res.status(200).json({ ok: true, ip, message: 'IP가 추가되었습니다.' });
  } catch (err) {
    console.error('[admin] add allowed ip error:', err);
    if (err.message.includes('이미 등록된')) {
      return res.status(409).json({ ok: false, message: err.message });
    }
    return res.status(500).json({ ok: false, message: 'IP 추가에 실패했습니다.' });
  }
});

// IP 삭제
router.delete('/allowed-ips/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ ok: false, message: '유효하지 않은 ID입니다.' });
  }

  try {
    await removeAllowedIp(id);
    // 캐시 무효화 후 즉시 재로드
    invalidateAllowedIpsCache();
    await refreshAllowedIpsCache();
    return res.status(200).json({ ok: true, message: 'IP가 삭제되었습니다.' });
  } catch (err) {
    console.error('[admin] remove allowed ip error:', err);
    if (err.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({ ok: false, message: err.message });
    }
    return res.status(500).json({ ok: false, message: 'IP 삭제에 실패했습니다.' });
  }
});

// 사진 프록시 (CORS 문제 해결)
// 인증 없이 접근 가능하지만, pathname이 attendance/로 시작하는지 검증
router.get('/photo/:path(*)', async (req, res) => {
  // 경로에서 pathname 추출
  let pathname = req.params.path;
  
  // URL 디코딩
  if (pathname) {
    try {
      pathname = decodeURIComponent(pathname);
    } catch (err) {
      console.warn('[admin/photo] URL 디코딩 실패:', err.message);
      return res.status(400).json({ ok: false, message: '잘못된 파일 경로입니다.' });
    }
  }
  
  if (!pathname) {
    return res.status(400).json({ ok: false, message: '파일 경로가 필요합니다.' });
  }

  // 보안: attendance/로 시작하는 파일만 허용
  if (!pathname.startsWith('attendance/')) {
    return res.status(403).json({ ok: false, message: '접근 권한이 없습니다.' });
  }

  try {
    // Blob에서 이미지 읽기
    const buffer = await readBlobBuffer(pathname);
    
    // Content-Type 결정
    let contentType = 'image/webp';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (pathname.endsWith('.png')) {
      contentType = 'image/png';
    } else if (pathname.endsWith('.gif')) {
      contentType = 'image/gif';
    }
    
    // CORS 헤더 설정 및 이미지 반환
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.send(buffer);
  } catch (err) {
    console.error('[admin] photo proxy error:', err);
    if (err.code === 'BLOB_NOT_FOUND') {
      return res.status(404).json({ ok: false, message: '파일을 찾을 수 없습니다.' });
    }
    return res.status(500).json({ ok: false, message: '이미지 로드 실패' });
  }
});

export default router;

