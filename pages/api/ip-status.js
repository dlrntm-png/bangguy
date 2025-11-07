import { getClientIp, isOfficeIp } from '../../lib/ip';

export default function handler(req, res) {
  const ip = getClientIp(req);
  const office = isOfficeIp(ip);
  res.status(200).json({ ip, office });
}
