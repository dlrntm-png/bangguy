import express from 'express';
import { getClientIp, isOfficeIp } from '../../lib/ip.js';

const router = express.Router();

router.get('/', (req, res) => {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  res.status(200).json({ ip, office });
});

export default router;

