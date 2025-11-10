import { verifyAdminToken } from '../../../lib/adminAuth';
import { getAdminPasswordHash, setAdminPasswordHash } from '../../../lib/db';
import { createPasswordHash, verifyPasswordHash } from '../../../lib/password';

const MIN_PASSWORD_LENGTH = 8;

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

  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ ok: false, message: '모든 입력 항목을 채워주세요.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      ok: false,
      message: `새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ ok: false, message: '새 비밀번호가 서로 일치하지 않습니다.' });
  }

  const isDevMode = process.env.NODE_ENV !== 'production';
  const allowFallback =
    isDevMode && process.env.ALLOW_DEV_ADMIN_PASSWORD !== 'false';
  const fallbackPassword =
    allowFallback && (process.env.ADMIN_PASSWORD || 'admin123');

  try {
    const record = await getAdminPasswordHash();
    const storedHash = record?.password_hash || null;

    if (!storedHash && !fallbackPassword) {
      return res.status(503).json({
        ok: false,
        message:
          '관리자 비밀번호가 아직 설정되지 않았습니다. 먼저 ADMIN_PASSWORD_HASH 값을 환경 변수로 설정한 후 다시 시도하세요.'
      });
    }

    const matchesCurrent = storedHash
      ? verifyPasswordHash(currentPassword, storedHash)
      : currentPassword === fallbackPassword;

    if (!matchesCurrent) {
      return res.status(401).json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' });
    }

    if (storedHash && verifyPasswordHash(newPassword, storedHash)) {
      return res.status(400).json({ ok: false, message: '현재 비밀번호와 다른 비밀번호를 사용해주세요.' });
    }

    if (!storedHash && fallbackPassword && newPassword === fallbackPassword) {
      return res.status(400).json({ ok: false, message: '현재 비밀번호와 다른 비밀번호를 사용해주세요.' });
    }

    const newHash = createPasswordHash(newPassword);
    await setAdminPasswordHash(newHash);

    return res.status(200).json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({ ok: false, message: '비밀번호 변경에 실패했습니다.' });
  }
}


