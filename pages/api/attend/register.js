import formidable from 'formidable';
import fs from 'fs/promises';
import { getClientIp, isOfficeIp } from '../../../lib/ip';
import { getKoreaISOString } from '../../../lib/time';
import { md5 } from '../../../lib/hash';
import {
  getLastRecordByEmployee,
  findRecordByHash,
  insertAttendanceRecord
} from '../../../lib/db';
import { uploadPhotoBuffer } from '../../../lib/blob';

export const config = {
  api: {
    bodyParser: false
  }
};

function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

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

    const buffer = await fs.readFile(actualPhoto.filepath);
    const imageHash = md5(buffer);

    if (!office) {
      await safeRemoveTemp(actualPhoto.filepath);
      return res.status(200).json({
        ok: false,
        reason: 'NOT_OFFICE_IP',
        message: '사내 공인 IP가 아닙니다. 사내 Wi‑Fi/VPN 접속 후 다시 시도해주세요.',
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

      if (lastRecord.device_id && lastRecord.device_id !== deviceId) {
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

    const uploadResult = await uploadPhotoBuffer(buffer, actualPhoto.originalFilename || 'photo.jpg', actualPhoto.mimetype);

    await safeRemoveTemp(actualPhoto.filepath);

    const record = await insertAttendanceRecord({
      serverTime,
      employeeId,
      name,
      ip,
      photoUrl: uploadResult.url,
      photoBlobPath: uploadResult.pathname,
      office,
      deviceId,
      imageHash
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
}

async function safeRemoveTemp(filepath) {
  if (!filepath) return;
  try {
    await fs.unlink(filepath);
  } catch (err) {
    // ignore
  }
}
