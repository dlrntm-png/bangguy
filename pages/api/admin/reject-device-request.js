import { verifyAdminToken } from '../../../lib/adminAuth.js';
import { getDeviceRequestById, completeDeviceRequest } from '../../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ ok: false, message: '요청 ID가 필요합니다.' });
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
}
