import { verifyAdminToken } from './adminAuth';

export function authorizeCronOrAdmin(req) {
  try {
    verifyAdminToken(req);
    return { type: 'admin' };
  } catch (err) {
    const cronHeader = req.headers['x-vercel-cron'];
    if (cronHeader) {
      return { type: 'cron' };
    }
    const secret = process.env.CLEANUP_SECRET;
    if (!secret) {
      throw new Error('CLEANUP_SECRET 환경변수가 설정되지 않았습니다.');
    }
    const provided =
      req.headers['x-cron-secret'] ||
      req.headers['x-vercel-signature'] ||
      req.query.secret ||
      req.body?.secret;
    if (provided !== secret) {
      const error = new Error('권한이 없습니다.');
      error.statusCode = 401;
      throw error;
    }
    return { type: 'cron' };
  }
}

