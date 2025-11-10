import { storeConsentLogIfAbsent } from '../../../lib/consent';

function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  try {
    const { employeeId, name, deviceId } = req.body || {};

    if (!employeeId || !deviceId) {
      return res.status(400).json({
        ok: false,
        message: 'employeeId와 deviceId는 필수입니다.'
      });
    }

    const ip = extractClientIp(req);
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
}

