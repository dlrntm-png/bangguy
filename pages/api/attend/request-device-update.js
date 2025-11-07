import { getKoreaISOString } from '../../../lib/time';
import {
  findPendingDeviceRequest,
  insertDeviceRequest
} from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

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
}
