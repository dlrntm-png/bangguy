import jwt from 'jsonwebtoken';

const TOKEN_EXPIRES_IN = '24h';

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV !== 'production') {
    console.warn('[adminAuth] ADMIN_JWT_SECRET 미설정: 로컬 테스트용 기본 시크릿을 사용합니다.');
    return 'local-dev-secret';
  }

  throw new Error('ADMIN_JWT_SECRET 환경변수가 설정되어 있지 않습니다.');
}

export function issueAdminToken() {
  const secret = getSecret();
  return jwt.sign({ role: 'admin' }, secret, { expiresIn: TOKEN_EXPIRES_IN });
}

export function verifyAdminToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authHeader.slice(7);
  const secret = getSecret();
  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== 'admin') {
      throw new Error('권한이 없습니다.');
    }
    return payload;
  } catch (err) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}
