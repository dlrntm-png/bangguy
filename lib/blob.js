import path from 'path';
import { promises as fs } from 'fs';
import { Buffer } from 'node:buffer';
import { put, del, head, list, get } from '@vercel/blob';

const SHOULD_USE_MOCK_BLOB =
  process.env.MOCK_BLOB === 'true' ||
  (!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV !== 'production');

if (SHOULD_USE_MOCK_BLOB) {
  console.warn('[blob] Using mock blob storage. Files are written to public/mock-uploads (gitignored).');
}

const MOCK_BASE_DIR = path.join(process.cwd(), 'public', 'mock-uploads');

async function listMockFiles(rootDir = '') {
  const targetDir = path.join(MOCK_BASE_DIR, rootDir);
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const relPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listMockFiles(relPath)));
      } else if (entry.isFile()) {
        const fullPath = path.join(targetDir, entry.name);
        const stat = await fs.stat(fullPath);
        files.push({
          pathname: relPath.replace(/\\/g, '/'),
          size: stat.size,
          uploadedAt: stat.mtime.toISOString()
        });
      }
    }
    return files;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    if (SHOULD_USE_MOCK_BLOB) return null;
    throw new Error('BLOB_READ_WRITE_TOKEN 환경변수가 설정되지 않았습니다.');
  }
  return token;
}

function generateBlobPath(prefix, extension) {
  const ext = extension?.startsWith('.') ? extension : `.${extension || 'dat'}`;
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

async function ensureMockDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function writeMockFile(pathname, buffer) {
  const filePath = path.join(MOCK_BASE_DIR, pathname);
  await ensureMockDir(filePath);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function deleteMockFile(pathname) {
  const filePath = path.join(MOCK_BASE_DIR, pathname);
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

export async function uploadPhotoBuffer(buffer, originalName, contentType, options = {}) {
  const extFromName = path.extname(originalName || '');
  const extFromContentType = contentType && contentType.includes('/')
    ? `.${contentType.split('/')[1]}`
    : '';
  const ext = options.forceExtension || extFromName || extFromContentType || '.jpg';
  const prefix = options.prefix || 'attendance';
  const pathname = generateBlobPath(prefix, ext);

  if (SHOULD_USE_MOCK_BLOB) {
    await writeMockFile(pathname, buffer);
    return {
      url: `/mock-uploads/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer?.length || 0,
      contentType: contentType || options.fallbackContentType || 'application/octet-stream',
      etag: null
    };
  }

  const token = requireBlobToken();
  const result = await put(pathname, buffer, {
    access: options.access || 'public',
    contentType: contentType || options.fallbackContentType || 'application/octet-stream',
    cacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
    token
  });
  return {
    url: result.url,
    pathname: result.pathname,
    size: buffer?.length || 0,
    contentType: contentType || options.fallbackContentType || 'application/octet-stream',
    etag: result.etag
  };
}

export async function uploadTextContent(content, options = {}) {
  const prefix = options.prefix || 'backups';
  const extension = options.extension || '.txt';
  const pathname = options.pathname || generateBlobPath(prefix, extension);
  const buffer = Buffer.from(content, options.encoding || 'utf-8');

  if (SHOULD_USE_MOCK_BLOB) {
    await writeMockFile(pathname, buffer);
    return {
      url: `/mock-uploads/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer.length
    };
  }

  const token = requireBlobToken();
  const result = await put(pathname, buffer, {
    access: options.access || 'private',
    contentType: options.contentType || 'text/plain; charset=utf-8',
    cacheControl: options.cacheControl || 'private, max-age=0, must-revalidate',
    token
  });
  return {
    url: result.url,
    pathname: result.pathname,
    size: buffer.length
  };
}

export async function deleteBlob(pathname) {
  if (!pathname) return;
  if (SHOULD_USE_MOCK_BLOB) {
    await deleteMockFile(pathname);
    return;
  }
  const token = requireBlobToken();
  if (!token) return;
  await del(pathname, { token });
}

export async function blobExists(pathname) {
  if (!pathname) return false;
  if (SHOULD_USE_MOCK_BLOB) {
    const filePath = path.join(MOCK_BASE_DIR, pathname);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  const token = requireBlobToken();
  if (!token) return false;
  try {
    await head(pathname, { token });
    return true;
  } catch (err) {
    if (err?.status === 404 || err?.code === 'not_found' || err?.name === 'BlobNotFoundError') {
      return false;
    }
    console.warn('[blobExists] unexpected error', err?.message || err);
    return false;
  }
}

export async function listBlobs(prefix) {
  if (SHOULD_USE_MOCK_BLOB) {
    return listMockFiles(prefix || '');
  }
  const token = requireBlobToken();
  if (!token) return [];
  let cursor;
  const blobs = [];
  do {
    const res = await list({ prefix, token, cursor });
    blobs.push(
      ...res.blobs.map((blob) => ({
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }))
    );
    cursor = res.cursor;
  } while (cursor);
  return blobs;
}

export async function readBlobText(pathname) {
  if (!pathname) throw new Error('pathname is required');
  if (SHOULD_USE_MOCK_BLOB) {
    const filePath = path.join(MOCK_BASE_DIR, pathname);
    return fs.readFile(filePath, 'utf-8');
  }
  const token = requireBlobToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN이 필요합니다.');
  try {
    const blob = await get(pathname, { token });
    const response = await fetch(blob.url);
    if (!response.ok) {
      throw new Error(`Failed to read blob: ${pathname}`);
    }
    return response.text();
  } catch (err) {
    if (err?.status === 404 || err?.code === 'not_found' || err?.name === 'BlobNotFoundError') {
      throw Object.assign(new Error(`Blob not found: ${pathname}`), { code: 'BLOB_NOT_FOUND' });
    }
    throw err;
  }
}

export async function createSignedBlobDownload(pathname, expiresIn = 60) {
  if (SHOULD_USE_MOCK_BLOB) {
    return { url: `/mock-uploads/${pathname}` };
  }
  const token = requireBlobToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN이 필요합니다.');
  try {
    const blob = await get(pathname, { token });
    return { url: blob.url };
  } catch (err) {
    if (err?.status === 404 || err?.code === 'not_found' || err?.name === 'BlobNotFoundError') {
      throw Object.assign(new Error(`Blob not found: ${pathname}`), { code: 'BLOB_NOT_FOUND' });
    }
    throw err;
  }
}
