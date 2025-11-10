import ipaddr from 'ipaddr.js';

const DEFAULT_OFFICE_IPS = [
  '175.120.139.0/24', // 175.120.139.* 사내망 CIDR
  '127.0.0.1/32', // 로컬 테스트용 IPv4 루프백
  '::1/128' // 로컬 테스트용 IPv6 루프백
];

const configured = (process.env.OFFICE_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OFFICE_IPS = configured.length > 0 ? configured : DEFAULT_OFFICE_IPS;

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded || '');
  const direct = req.socket?.remoteAddress || '';
  const ip = raw || direct;
  return ip.split(',')[0].trim().replace('::ffff:', '');
}

export function isOfficeIp(ip) {
  if (!ip) return false;

  try {
    const addr = ipaddr.parse(ip);

    for (const entry of OFFICE_IPS) {
      if (!entry.includes('/')) {
        const target = ipaddr.parse(entry);
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
          if (addr.toIPv4Address().toString() === target.toString()) {
            return true;
          }
        }
        if (addr.kind() === target.kind() && addr.toNormalizedString() === target.toNormalizedString()) {
          return true;
        }
        continue;
      }

      const subnet = ipaddr.parseCIDR(entry);
      if (addr.kind() === subnet[0].kind()) {
        if (addr.match(subnet)) return true;
      } else if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress() && subnet[0].kind() === 'ipv4') {
        const v4 = addr.toIPv4Address();
        const v4Subnet = ipaddr.parseCIDR(entry);
        if (v4.match(v4Subnet)) return true;
      }
    }
  } catch (err) {
    console.error('[isOfficeIp] error:', err.message);
  }

  return false;
}
