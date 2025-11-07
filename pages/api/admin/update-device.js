import { verifyAdminToken } from '../../../lib/adminAuth';
import { updateDeviceId } from '../../../lib/db';

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

  const { employeeId, deviceId } = req.body || {};

  if (!employeeId || !deviceId) {
    return res.status(400).json({ ok: false, message: '사번과 기기 ID를 모두 입력해주세요.' });
  }

  try {
    const count = await updateDeviceId(String(employeeId).trim(), String(deviceId).trim());
    if (count === 0) {
      return res.status(404).json({ ok: false, message: '해당 사번의 등록 기록을 찾을 수 없습니다.' });
    }
    return res.status(200).json({ ok: true, updated: count, message: '기기 ID가 업데이트되었습니다.' });
  } catch (err) {
    console.error('update-device error:', err);
    return res.status(500).json({ ok: false, message: '업데이트 실패' });
  }
}
