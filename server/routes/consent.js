import express from 'express';
import { storeConsentLogIfAbsent } from '../../lib/consent.js';
import { hasConsentLog } from '../../lib/consent.js';
import { getClientIp } from '../../lib/ip.js';

const router = express.Router();

router.post('/log', async (req, res) => {
  try {
    const { employeeId, name, deviceId } = req.body || {};

    if (!employeeId || !deviceId) {
      return res.status(400).json({
        ok: false,
        message: 'employeeId와 deviceId는 필수입니다.'
      });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await storeConsentLogIfAbsent({
      employeeId,
      name,
      deviceId,
      ip,
      userAgent
    });

    return res.status(200).json({
      ok: true,
      alreadyExists: result.alreadyExists,
      blobPath: result.pathname
    });
  } catch (err) {
    console.error('[consent] log api error:', err);
    return res.status(500).json({ ok: false, message: '동의 로그 저장에 실패했습니다.' });
  }
});

router.get('/status', async (req, res) => {
  const employeeId = req.query.employeeId;
  if (!employeeId || (Array.isArray(employeeId) && employeeId.length === 0)) {
    return res.status(400).json({ ok: false, message: 'employeeId 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const id = Array.isArray(employeeId) ? employeeId[0] : employeeId;
    const consented = await hasConsentLog(id);
    return res.status(200).json({ ok: true, consented });
  } catch (err) {
    console.error('[consent] status api error:', err);
    return res.status(500).json({ ok: false, message: '동의 여부 확인에 실패했습니다.' });
  }
});

export default router;

