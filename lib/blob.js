import path from 'path';
import { promises as fs } from 'fs';
import { Buffer } from 'node:buffer';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 또는 S3 호환 스토리지 사용
const SHOULD_USE_MOCK_BLOB =
  process.env.MOCK_BLOB === 'true' ||
  (!process.env.R2_ACCOUNT_ID && !process.env.S3_ENDPOINT && process.env.NODE_ENV !== 'production');

if (SHOULD_USE_MOCK_BLOB) {
  console.warn('[blob] Using mock blob storage. Files are written to public/mock-uploads (gitignored).');
}

const MOCK_BASE_DIR = path.join(process.cwd(), 'public', 'mock-uploads');

// S3/R2 클라이언트 초기화
let s3Client = null;

function getS3Client() {
  if (SHOULD_USE_MOCK_BLOB) {
    return null;
  }

  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : process.env.S3_ENDPOINT);
    const region = process.env.R2_REGION || process.env.S3_REGION || 'auto';

    if (!accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME 환경변수가 필요합니다.');
    }

    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true // R2는 path-style 사용
    });
  }

  return s3Client;
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'bangguy-storage';
}

function getPublicUrl(pathname) {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `https://${publicDomain}/${pathname}`;
  }
  // R2 커스텀 도메인이 없으면 signed URL 사용 (임시)
  return null;
}

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

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: pathname,
    Body: buffer,
    ContentType: contentType || options.fallbackContentType || 'application/octet-stream',
    CacheControl: options.cacheControl || 'public, max-age=31536000, immutable'
  });

  await client.send(command);

  const publicUrl = getPublicUrl(pathname);
  const url = publicUrl || pathname; // 커스텀 도메인이 없으면 pathname 반환 (나중에 signed URL로 변환)

  return {
    url,
    pathname,
    size: buffer?.length || 0,
    contentType: contentType || options.fallbackContentType || 'application/octet-stream',
    etag: null
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

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: pathname,
    Body: buffer,
    ContentType: options.contentType || 'text/plain; charset=utf-8',
    CacheControl: options.cacheControl || 'private, max-age=0, must-revalidate'
  });

  await client.send(command);

  const publicUrl = getPublicUrl(pathname);
  const url = publicUrl || pathname;

  return {
    url,
    pathname,
    size: buffer.length
  };
}

export async function deleteBlob(pathname) {
  if (!pathname) return;
  if (SHOULD_USE_MOCK_BLOB) {
    await deleteMockFile(pathname);
    return;
  }

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: pathname
  });

  try {
    await client.send(command);
  } catch (err) {
    console.warn(`[deleteBlob] Failed to delete: ${pathname}`, err?.message);
    // 404는 무시 (이미 삭제됨)
    if (err?.$metadata?.httpStatusCode !== 404) {
      throw err;
    }
  }
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

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: pathname
  });

  try {
    await client.send(command);
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
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

  const client = getS3Client();
  const bucketName = getBucketName();

  const blobs = [];
  let continuationToken = null;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix || '',
      ContinuationToken: continuationToken
    });

    const response = await client.send(command);
    
    if (response.Contents) {
      blobs.push(
        ...response.Contents.map((item) => ({
          pathname: item.Key,
          size: item.Size || 0,
          uploadedAt: item.LastModified?.toISOString() || new Date().toISOString()
        }))
      );
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return blobs;
}

export async function readBlobText(pathname) {
  if (!pathname) throw new Error('pathname is required');
  if (SHOULD_USE_MOCK_BLOB) {
    const filePath = path.join(MOCK_BASE_DIR, pathname);
    return fs.readFile(filePath, 'utf-8');
  }

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: pathname
  });

  try {
    const response = await client.send(command);
    const text = await response.Body.transformToString();
    return text;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      throw Object.assign(new Error(`Blob not found: ${pathname}`), { code: 'BLOB_NOT_FOUND' });
    }
    throw err;
  }
}

export async function createSignedBlobDownload(pathname, expiresIn = 60) {
  if (SHOULD_USE_MOCK_BLOB) {
    return { url: `/mock-uploads/${pathname}` };
  }

  const client = getS3Client();
  const bucketName = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: pathname
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return { url };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      throw Object.assign(new Error(`Blob not found: ${pathname}`), { code: 'BLOB_NOT_FOUND' });
    }
    throw err;
  }
}
