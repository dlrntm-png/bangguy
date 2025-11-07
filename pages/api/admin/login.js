import { issueAdminToken } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!password) {
    return res.status(400).json({ ok: false, message: '비밀번호를 입력해주세요.' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
  }

  try {
    const token = issueAdminToken();
    return res.status(200).json({ ok: true, token, message: '로그인 성공' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, message: '토큰 발급 실패' });
  }
}
