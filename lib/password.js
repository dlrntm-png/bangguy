import crypto from 'crypto';

// PBKDF2 설정값: 반복 횟수, 키 길이, 해시 알고리즘
const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH_BYTES = 64;
const DIGEST = 'sha512';

/**
 * 주어진 비밀번호를 PBKDF2로 해시한 뒤, 알고리즘/설정/솔트를 포함한 문자열로 반환합니다.
 * 반환 형식: pbkdf2_sha512$<iterations>$<salt>$<derivedKeyHex>
 */
export function createPasswordHash(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('비밀번호가 비어 있습니다.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(plainPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, DIGEST)
    .toString('hex');

  return `pbkdf2_${DIGEST}$${PBKDF2_ITERATIONS}$${salt}$${derivedKey}`;
}

/**
 * 저장된 PBKDF2 해시 문자열과 비교하여 비밀번호가 일치하는지 확인합니다.
 */
export function verifyPasswordHash(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    return false;
  }

  if (typeof storedHash !== 'string' || !storedHash.startsWith(`pbkdf2_${DIGEST}$`)) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [, iterationStr, salt, derivedHex] = parts;
  const iterations = Number(iterationStr);
  if (!iterations || !salt || !derivedHex) {
    return false;
  }

  const storedBuffer = Buffer.from(derivedHex, 'hex');
  if (storedBuffer.length === 0) {
    return false;
  }

  const computed = crypto.pbkdf2Sync(
    plainPassword,
    salt,
    iterations,
    storedBuffer.length,
    DIGEST
  );

  return crypto.timingSafeEqual(storedBuffer, computed);
}


