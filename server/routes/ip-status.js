import express from 'express';
import { getClientIp, isOfficeIp } from '../../lib/ip.js';

const router = express.Router();

router.get('/', (req, res) => {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  
  // UptimeRobot 요청 추적을 위한 로깅
  const userAgent = req.headers['user-agent'] || '';
  const isUptimeRobot = userAgent.includes('UptimeRobot') || userAgent.includes('Uptime');
  if (isUptimeRobot) {
    console.log(`[UptimeRobot] IP status check - IP: ${ip}, Office: ${office}`);
  }
  
  res.status(200).json({ ip, office });
});

export default router;

