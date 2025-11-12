import ipaddr from 'ipaddr.js';
import { getAllowedIps } from './db.js';

const DEFAULT_OFFICE_IPS = [
  '175.120.139.0/24', // 175.120.139.* 사내망 CIDR
  '118.235.80.0/24', // 118.235.80.* 사내망 추가 CIDR
  '127.0.0.1/32', // 로컬 테스트용 IPv4 루프백
  '::1/128', // 로컬 테스트용 IPv6 루프백
  '121.150.126.163/32' // 재택 개발용 공인 IP
];

const configured = (process.env.OFFICE_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 환경 변수에서 가져온 IP 목록 (기본값 또는 설정값)
const ENV_OFFICE_IPS = configured.length > 0 ? configured : DEFAULT_OFFICE_IPS;

// 데이터베이스에서 가져온 IP 목록 캐시
let dbIpsCache = [];
let dbIpsCacheTime = 0;
const DB_IPS_CACHE_TTL = 60000; // 1분

// 허용된 IP 목록을 가져오는 함수 (환경 변수 + 데이터베이스 병합)
async function getAllowedIpsList() {
  // 캐시가 유효하면 캐시 사용
  const now = Date.now();
  if (dbIpsCache.length > 0 && (now - dbIpsCacheTime) < DB_IPS_CACHE_TTL) {
    return [...ENV_OFFICE_IPS, ...dbIpsCache];
  }

  // 데이터베이스에서 IP 목록 가져오기
  try {
    const dbIps = await getAllowedIps();
    dbIpsCache = dbIps.map((ip) => ip.ip_cidr);
    dbIpsCacheTime = now;
  } catch (err) {
    console.error('[getAllowedIpsList] DB 조회 실패:', err.message);
    // DB 조회 실패 시 환경 변수만 사용
  }

  return [...ENV_OFFICE_IPS, ...dbIpsCache];
}

// 캐시 무효화 함수 (IP 추가/삭제 시 호출)
export function invalidateAllowedIpsCache() {
  dbIpsCache = [];
  dbIpsCacheTime = 0;
}

// 캐시 강제 갱신 함수
export async function refreshAllowedIpsCache() {
  try {
    const dbIps = await getAllowedIps();
    dbIpsCache = dbIps.map((ip) => ip.ip_cidr);
    dbIpsCacheTime = Date.now();
    console.log(`[ip] 허용된 IP 캐시 갱신: DB ${dbIpsCache.length}개`);
  } catch (err) {
    console.error('[ip] 캐시 갱신 실패:', err.message);
  }
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded || '');
  const direct = req.socket?.remoteAddress || '';
  const ip = raw || direct;
  return ip.split(',')[0].trim().replace('::ffff:', '');
}

// 동기 버전 (기존 호환성 유지, 캐시된 IP 사용)
// 캐시가 비어있으면 백그라운드에서 로드 시도
export function isOfficeIp(ip) {
  if (!ip) return false;

  // 캐시가 비어있고 아직 로드 중이 아니면 백그라운드에서 로드 시도
  if (dbIpsCache.length === 0 && dbIpsCacheTime === 0) {
    // 비동기로 로드 시도 (결과는 다음 요청에 반영됨)
    getAllowedIpsList().catch((err) => {
      console.error('[isOfficeIp] 백그라운드 캐시 로드 실패:', err.message);
    });
  }

  try {
    const addr = ipaddr.parse(ip);

    // 환경 변수 + 캐시된 DB IP 목록 사용
    const allIps = [...ENV_OFFICE_IPS, ...dbIpsCache];

    for (const entry of allIps) {
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

// 비동기 버전 (DB IP 포함 최신 목록 사용)
export async function isOfficeIpAsync(ip) {
  if (!ip) return false;

  try {
    const addr = ipaddr.parse(ip);
    const allIps = await getAllowedIpsList();

    for (const entry of allIps) {
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
    console.error('[isOfficeIpAsync] error:', err.message);
  }

  return false;
}

// 서버 시작 시 DB IP 목록 강제 로드 (캐시 무시)
async function initializeIpCache() {
  try {
    const dbIps = await getAllowedIps();
    dbIpsCache = dbIps.map((ip) => ip.ip_cidr);
    dbIpsCacheTime = Date.now();
    console.log(`[ip] 허용된 IP 목록 로드 완료: 환경 변수 ${ENV_OFFICE_IPS.length}개 + DB ${dbIpsCache.length}개`);
  } catch (err) {
    console.error('[ip] 초기 IP 목록 로드 실패:', err.message);
  }
}

// 서버 시작 시 즉시 로드
initializeIpCache();
