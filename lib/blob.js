import path from 'path';
import { put, del } from '@vercel/blob';

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN 환경변수가 설정되지 않았습니다.');
  }
  return token;
}

export async function uploadPhotoBuffer(buffer, originalName, contentType) {
  const token = requireBlobToken();
  const ext = path.extname(originalName || '') || '.jpg';
  const safeName = `attendance/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const result = await put(safeName, buffer, {
    access: 'public',
    contentType: contentType || 'image/jpeg',
    token
  });
  return {
    url: result.url,
    pathname: result.pathname
  };
}

export async function deleteBlob(pathname) {
  if (!pathname) return;
  const token = requireBlobToken();
  await del(pathname, { token });
}
