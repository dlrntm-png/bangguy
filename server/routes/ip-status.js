import express from 'express';
import { getClientIp, isOfficeIp } from '../../lib/ip.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const ip = getClientIp(req);
    
    // DB 오류 시 기본값 사용 (서버가 응답할 수 있도록)
    let office = false;
    try {
      office = isOfficeIp(ip);
    } catch (err) {
      console.warn('[ip-status] IP 체크 실패, 기본값 사용:', err.message);
    }
    
    // UptimeRobot 요청 추적을 위한 로깅
    const userAgent = req.headers['user-agent'] || '';
    const isUptimeRobot = userAgent.includes('UptimeRobot') || userAgent.includes('Uptime');
    if (isUptimeRobot) {
      console.log(`[UptimeRobot] IP status check - IP: ${ip}, Office: ${office}`);
    }
    
    res.status(200).json({ ip, office });
  } catch (err) {
    console.error('[ip-status] 에러:', err);
    // 에러 발생 시에도 응답 (서버가 살아있음을 알림)
    const ip = getClientIp(req) || 'unknown';
    res.status(200).json({ 
      ip, 
      office: false,
      error: 'IP check failed'
    });
  }
});

export default router;

