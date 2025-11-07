import { verifyAdminToken } from '../../../lib/adminAuth.js';
import { getDeviceRequests } from '../../../lib/db.js';

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

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
}
