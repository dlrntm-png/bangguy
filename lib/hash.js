import crypto from 'crypto';

export function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}
