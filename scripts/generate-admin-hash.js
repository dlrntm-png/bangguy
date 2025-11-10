import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH_BYTES = 64;
const DIGEST = 'sha512';

function createPasswordHash(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('비밀번호가 비어 있습니다.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(plainPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, DIGEST)
    .toString('hex');

  return `pbkdf2_${DIGEST}$${PBKDF2_ITERATIONS}$${salt}$${derivedKey}`;
}

function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('사용법: npm run admin:hash -- "<비밀번호>"');
    process.exit(1);
  }

  try {
    const hash = createPasswordHash(password);
    console.log('\n생성된 ADMIN_PASSWORD_HASH 값:');
    console.log(hash);
    console.log('\n환경 변수로 설정하세요 (예: Vercel → Project Settings → Environment Variables)');
  } catch (err) {
    console.error('해시 생성 실패:', err.message);
    process.exit(1);
  }
}

main();

