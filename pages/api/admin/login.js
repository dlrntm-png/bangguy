import { issueAdminToken } from '../../../lib/adminAuth';
import { getAdminPasswordHash } from '../../../lib/db';
import { verifyPasswordHash } from '../../../lib/password';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  const { password } = req.body || {};
  const isDevMode = process.env.NODE_ENV !== 'production';
  const allowFallback =
    isDevMode && process.env.ALLOW_DEV_ADMIN_PASSWORD !== 'false';
  const fallbackPassword =
    allowFallback && (process.env.ADMIN_PASSWORD || 'admin123');

  if (!password) {
    return res.status(400).json({ ok: false, message: '비밀번호를 입력해주세요.' });
  }

  try {
    const record = await getAdminPasswordHash();
    if (record?.password_hash) {
      const valid = verifyPasswordHash(password, record.password_hash);
      if (!valid) {
        return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
      }
    } else if (fallbackPassword) {
      if (password !== fallbackPassword) {
        return res.status(401).json({ ok: false, message: '비밀번호가 올바르지 않습니다.' });
      }
    } else {
      return res.status(503).json({
        ok: false,
        message:
          '관리자 비밀번호가 초기화되지 않았습니다. 환경 변수 ADMIN_PASSWORD_HASH 를 설정하거나 비밀번호 변경 API로 초기 비밀번호를 등록하세요.'
      });
    }
  } catch (err) {
    console.error('login error (password lookup):', err);
    return res.status(500).json({ ok: false, message: '로그인 정보를 확인할 수 없습니다.' });
  }

  try {
    const token = issueAdminToken();
    return res.status(200).json({ ok: true, token, message: '로그인 성공' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, message: '토큰 발급 실패' });
  }
}
