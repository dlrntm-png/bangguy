import { verifyAdminToken } from '../../../lib/adminAuth.js';

export default function handler(req, res) {
  try {
    verifyAdminToken(req);
    return res.status(200).json({ ok: true, message: '인증됨' });
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }
}
