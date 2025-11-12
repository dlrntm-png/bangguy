import express from 'express';
import formidable from 'formidable';
import fs from 'fs/promises';
import { getClientIp, isOfficeIp } from '../../lib/ip.js';
import { getKoreaISOString, getNextMonthStartKstISO } from '../../lib/time.js';
import { md5 } from '../../lib/hash.js';
import {
  getLastRecordByEmployee,
  findRecordByHash,
  insertAttendanceRecord,
  findPendingDeviceRequest,
  insertDeviceRequest
} from '../../lib/db.js';
import { uploadPhotoBuffer } from '../../lib/blob.js';
import { compressImage } from '../../lib/image.js';

const router = express.Router();

function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

async function safeRemoveTemp(filepath) {
  if (!filepath) return;
  try {
    await fs.unlink(filepath);
  } catch (err) {
    // ignore
  }
}

router.post('/register', async (req, res) => {
  const form = formidable({
    multiples: false,
    maxFileSize: 5 * 1024 * 1024
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const employeeId = normalizeField(fields.employeeId).trim();
    const name = normalizeField(fields.name).trim();
    const deviceId = normalizeField(fields.deviceId).trim();
    const photoFile = files.photo;

    const ip = getClientIp(req);
    const office = isOfficeIp(ip);
    const serverTime = getKoreaISOString();

    if (!employeeId || !name) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_INPUT',
        message: '사번과 이름을 모두 입력해주세요.',
        ip,
        office,
        serverTime
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        ok: false,
        error: 'DEVICE_ID_REQUIRED',
        message: '기기 ID가 필요합니다. 페이지를 새로고침해주세요.',
        ip,
        office,
        serverTime
      });
    }

    if (!photoFile) {
      return res.status(400).json({
        ok: false,
        error: 'PHOTO_REQUIRED',
        message: '사진을 선택해주세요.',
        ip,
        office,
        serverTime
      });
    }

    const actualPhoto = Array.isArray(photoFile) ? photoFile[0] : photoFile;
    if (!actualPhoto.mimetype?.startsWith('image/')) {
      await safeRemoveTemp(actualPhoto.filepath);
      return res.status(400).json({
        ok: false,
        error: 'INVALID_FILE',
        message: '이미지 파일만 업로드 가능합니다.',
        ip,
        office,
        serverTime
      });
    }

    const originalBuffer = await fs.readFile(actualPhoto.filepath);
    const imageHash = md5(originalBuffer);

    // 부하 테스트 모드: X-Load-Test 헤더가 있고 환경 변수가 설정되어 있으면 IP 체크 우회
    const isLoadTest = req.headers['x-load-test'] === 'true' && process.env.ALLOW_LOAD_TEST === 'true';
    
    if (!office && !isLoadTest) {
      await safeRemoveTemp(actualPhoto.filepath);
      return res.status(200).json({
        ok: false,
        reason: 'NOT_OFFICE_IP',
        message: 'DCMC_WIFI가 아닙니다. DCMC_WIFI 접속 후 다시 시도 해주세요.',
        ip,
        office,
        serverTime
      });
    }

    const lastRecord = await getLastRecordByEmployee(employeeId);
    if (lastRecord) {
      const lastTime = new Date(lastRecord.server_time || lastRecord.serverTime || lastRecord.created_at);
      const now = new Date(serverTime);
      const diffSeconds = (now - lastTime) / 1000;
      if (diffSeconds >= 0 && diffSeconds < 300) {
        await safeRemoveTemp(actualPhoto.filepath);
        const remaining = Math.ceil(300 - diffSeconds);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return res.status(200).json({
          ok: false,
          reason: 'DUPLICATE_REGISTRATION',
          message: `최근에 등록하셨습니다. ${minutes}분 ${seconds}초 후에 다시 시도해주세요.`,
          ip,
          office,
          serverTime
        });
      }

      // 부하 테스트 모드에서는 기기 ID 체크 우회
      if (!isLoadTest && lastRecord.device_id && lastRecord.device_id !== deviceId) {
        await safeRemoveTemp(actualPhoto.filepath);
        return res.status(200).json({
          ok: false,
          reason: 'DEVICE_MISMATCH',
          message: '다른 기기에서 등록된 기록이 있습니다. 본인 기기에서 등록해주세요.',
          ip,
          office,
          serverTime
        });
      }
    }

    // 부하 테스트 모드에서는 이미지 중복 검사 우회
    if (!isLoadTest) {
      const duplicateHash = await findRecordByHash(imageHash);
      if (duplicateHash) {
        await safeRemoveTemp(actualPhoto.filepath);
        return res.status(200).json({
          ok: false,
          reason: 'DUPLICATE_PHOTO',
          message: '이미 사용된 사진입니다. 새로운 사진을 촬영해주세요.',
          ip,
          office,
          serverTime
        });
      }
    }

    const { buffer: compressedBuffer, info: compressedInfo } = await compressImage(originalBuffer);

    const uploadResult = await uploadPhotoBuffer(
      compressedBuffer,
      actualPhoto.originalFilename || 'photo.jpg',
      compressedInfo.contentType,
      {
        forceExtension: '.webp',
        fallbackContentType: compressedInfo.contentType,
        prefix: 'attendance',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    );

    await safeRemoveTemp(actualPhoto.filepath);

    const cleanupScheduledAt = getNextMonthStartKstISO(serverTime);

    const record = await insertAttendanceRecord({
      serverTime,
      employeeId,
      name,
      ip,
      photoUrl: uploadResult.url,
      photoBlobPath: uploadResult.pathname,
      photoContentType: compressedInfo.contentType,
      photoSize: compressedInfo.size,
      photoWidth: compressedInfo.width,
      photoHeight: compressedInfo.height,
      office,
      deviceId,
      imageHash,
      cleanupScheduledAt
    });

    return res.status(200).json({
      ok: true,
      ip,
      office,
      serverTime,
      file: uploadResult.url,
      message: '인증(등록) 완료',
      recordId: record.id
    });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: err.message || '서버 오류가 발생했습니다.' });
  }
});

// 기기 재등록 요청
router.post('/request-device-update', async (req, res) => {
  const { employeeId, name, deviceId } = req.body || {};

  if (!employeeId || !name || !deviceId) {
    return res.status(400).json({ ok: false, message: '필수 정보가 누락되었습니다.' });
  }

  try {
    const pending = await findPendingDeviceRequest(employeeId, deviceId);
    if (pending) {
      return res.status(200).json({ ok: false, message: '이미 대기 중인 요청이 있습니다.' });
    }

    const request = {
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      employeeId: String(employeeId).trim(),
      name: String(name).trim(),
      deviceId: String(deviceId).trim(),
      requestedAt: getKoreaISOString(),
      status: 'pending'
    };

    await insertDeviceRequest(request);

    return res.status(200).json({ ok: true, message: '요청이 제출되었습니다.' });
  } catch (err) {
    console.error('request-device-update error:', err);
    return res.status(500).json({ ok: false, message: '요청 처리 실패' });
  }
});

export default router;

