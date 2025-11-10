import { hasConsentLog } from '../../../lib/consent';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

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
}


