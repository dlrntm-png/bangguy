import path from 'path';
import { promises as fs } from 'fs';
import { Buffer } from 'node:buffer';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Render 파일 시스템 사용 (결제 정보 불필요, 완전 무료)
// B2/R2/S3 환경 변수가 없으면 자동으로 파일 시스템 사용
const SHOULD_USE_MOCK_BLOB =
  process.env.MOCK_BLOB === 'true' ||
  (!process.env.B2_ENDPOINT && !process.env.R2_ACCOUNT_ID && !process.env.S3_ENDPOINT);

// Backblaze B2 무료 플랜 제한 (10GB = 10 * 1024 * 1024 * 1024 bytes)
const FREE_TIER_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB
const FREE_TIER_WARNING_THRESHOLD = 0.8; // 80% 도달 시 경고

if (SHOULD_USE_MOCK_BLOB) {
  console.warn('[blob] Using Render file system storage. Files are written to storage/ directory.');
}

// Render 파일 시스템 저장 경로
// 프로덕션에서는 Render의 영구 볼륨 또는 서버 파일 시스템 사용
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const MOCK_BASE_DIR = STORAGE_DIR;

// S3/R2 클라이언트 초기화
let s3Client = null;

function getS3Client() {
  if (SHOULD_USE_MOCK_BLOB) {
    return null;
  }

  if (!s3Client) {
    // Backblaze B2 설정 우선 확인
    const b2Endpoint = process.env.B2_ENDPOINT;
    const b2KeyId = process.env.B2_APPLICATION_KEY_ID;
    const b2Key = process.env.B2_APPLICATION_KEY;
    const b2Bucket = process.env.B2_BUCKET_NAME;
    const b2Region = process.env.B2_REGION;

    // Cloudflare R2 설정
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2KeyId = process.env.R2_ACCESS_KEY_ID;
    const r2Key = process.env.R2_SECRET_ACCESS_KEY;
    const r2Bucket = process.env.R2_BUCKET_NAME;
    const r2Endpoint = process.env.R2_ENDPOINT || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : null);

    // 일반 S3 설정
    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3KeyId = process.env.S3_ACCESS_KEY_ID;
    const s3Key = process.env.S3_SECRET_ACCESS_KEY;
    const s3Bucket = process.env.S3_BUCKET_NAME;

    let accessKeyId, secretAccessKey, bucketName, endpoint, region;

    // Backblaze B2 우선 사용
    if (b2Endpoint && b2KeyId && b2Key && b2Bucket) {
      accessKeyId = b2KeyId;
      secretAccessKey = b2Key;
      bucketName = b2Bucket;
      endpoint = b2Endpoint;
      region = b2Region || 'us-west-004'; // Backblaze B2 기본 지역
      console.log('[blob] Backblaze B2 스토리지 사용 중');
    } else if (r2Endpoint && r2KeyId && r2Key && r2Bucket) {
      // Cloudflare R2 사용
      accessKeyId = r2KeyId;
      secretAccessKey = r2Key;
      bucketName = r2Bucket;
      endpoint = r2Endpoint;
      region = process.env.R2_REGION || 'auto';
      console.log('[blob] Cloudflare R2 스토리지 사용 중');
    } else if (s3Endpoint && s3KeyId && s3Key && s3Bucket) {
      // 일반 S3 사용
      accessKeyId = s3KeyId;
      secretAccessKey = s3Key;
      bucketName = s3Bucket;
      endpoint = s3Endpoint;
      region = process.env.S3_REGION || 'us-east-1';
      console.log('[blob] AWS S3 스토리지 사용 중');
    } else {
      // 환경 변수가 없으면 파일 시스템 사용으로 폴백
      console.warn('[blob] B2/R2/S3 환경 변수가 없습니다. Render 파일 시스템을 사용합니다.');
      return null;
    }

    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true // B2/R2는 path-style 사용
    });
  }

  return s3Client;
}

function getBucketName() {
  return process.env.B2_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'bangguy-storage';
}

function getPublicUrl(pathname) {
  // Backblaze B2 Public URL (버킷이 Public인 경우)
  const b2PublicDomain = process.env.B2_PUBLIC_DOMAIN;
  if (b2PublicDomain) {
    return `https://${b2PublicDomain}/${pathname}`;
  }

  // Cloudflare R2 Public URL
  const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (r2PublicDomain) {
    return `https://${r2PublicDomain}/${pathname}`;
  }

  // 일반 S3 Public URL
  const s3PublicDomain = process.env.S3_PUBLIC_DOMAIN;
  if (s3PublicDomain) {
    return `https://${s3PublicDomain}/${pathname}`;
  }

  // Public 도메인이 없으면 signed URL 사용 (임시)
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

// 현재 스토리지 사용량 확인 (B2 사용 시에만)
async function getCurrentStorageUsage() {
  const client = getS3Client();
  if (!client) return 0; // 파일 시스템 사용 시 체크 안 함

  try {
    const blobs = await listBlobs('');
    const totalSize = blobs.reduce((sum, blob) => sum + (blob.size || 0), 0);
    return totalSize;
  } catch (err) {
    console.warn('[storage] 사용량 확인 실패:', err.message);
    return 0;
  }
}

// 사용량 체크 및 제한 (Backblaze B2 무료 플랜 10GB 제한)
async function checkStorageLimit(newFileSize = 0) {
  const client = getS3Client();
  if (!client) {
    // 파일 시스템 사용 시 체크 안 함
    return { currentUsage: 0, totalUsage: 0, usagePercent: 0, remaining: Infinity };
  }

  // B2 사용 시에만 체크
  const isB2 = process.env.B2_ENDPOINT && process.env.B2_APPLICATION_KEY_ID;
  if (!isB2) {
    // B2가 아니면 체크 안 함
    return { currentUsage: 0, totalUsage: 0, usagePercent: 0, remaining: Infinity };
  }

  const currentUsage = await getCurrentStorageUsage();
  const totalUsage = currentUsage + newFileSize;

  // 10GB 초과 시 에러
  if (totalUsage > FREE_TIER_LIMIT) {
    const currentGB = (currentUsage / (1024 * 1024 * 1024)).toFixed(2);
    const newGB = (totalUsage / (1024 * 1024 * 1024)).toFixed(2);
    throw new Error(
      `스토리지 용량 초과: 현재 ${currentGB}GB 사용 중, 업로드 후 ${newGB}GB가 되어 무료 플랜(10GB)을 초과합니다. ` +
      `기존 파일을 삭제하거나 백업 후 정리해주세요.`
    );
  }

  // 80% 도달 시 경고
  const usagePercent = (totalUsage / FREE_TIER_LIMIT) * 100;
  if (usagePercent >= FREE_TIER_WARNING_THRESHOLD * 100) {
    console.warn(
      `[storage] ⚠️ 스토리지 사용량 경고: ${usagePercent.toFixed(1)}% 사용 중 ` +
      `(${(totalUsage / (1024 * 1024 * 1024)).toFixed(2)}GB / 10GB)`
    );
  }

  return {
    currentUsage,
    totalUsage,
    usagePercent,
    remaining: FREE_TIER_LIMIT - totalUsage
  };
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
      url: `/storage/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer?.length || 0,
      contentType: contentType || options.fallbackContentType || 'application/octet-stream',
      etag: null
    };
  }

  const client = getS3Client();
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    await writeMockFile(pathname, buffer);
    return {
      url: `/storage/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer?.length || 0,
      contentType: contentType || options.fallbackContentType || 'application/octet-stream',
      etag: null
    };
  }

  // Backblaze B2 사용 시 사용량 체크
  try {
    await checkStorageLimit(buffer.length);
  } catch (err) {
    console.error('[uploadPhotoBuffer] 스토리지 용량 초과:', err.message);
    throw err;
  }

  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: pathname,
    Body: buffer,
    ContentType: contentType || options.fallbackContentType || 'application/octet-stream',
    CacheControl: options.cacheControl || 'public, max-age=31536000, immutable'
  });

  await client.send(command);

  // Backblaze B2 Public URL 생성 (Public 버킷인 경우)
  const publicUrl = getPublicUrl(pathname);
  
  // B2를 사용하고 Public URL이 없으면 signed URL 생성 (Private 버킷)
  let url = publicUrl;
  if (!url && process.env.B2_ENDPOINT) {
    try {
      const signedUrl = await createSignedBlobDownload(pathname, 3600); // 1시간 유효
      url = signedUrl.url;
    } catch (err) {
      console.warn('[uploadPhotoBuffer] Signed URL 생성 실패, pathname 사용:', err.message);
      url = pathname; // 폴백
    }
  } else if (!url) {
    // 다른 스토리지도 Public URL이 없으면 pathname 사용
    url = pathname;
  }

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
      url: `/storage/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer.length
    };
  }

  const client = getS3Client();
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    await writeMockFile(pathname, buffer);
    return {
      url: `/storage/${pathname.replace(/^\/+/, '')}`,
      pathname,
      size: buffer.length
    };
  }

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
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    await deleteMockFile(pathname);
    return;
  }

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
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    const filePath = path.join(MOCK_BASE_DIR, pathname);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

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
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    return listMockFiles(prefix || '');
  }

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
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    const filePath = path.join(MOCK_BASE_DIR, pathname);
    return fs.readFile(filePath, 'utf-8');
  }

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
    return { url: `/storage/${pathname}` };
  }

  const client = getS3Client();
  if (!client) {
    // 클라이언트가 null이면 파일 시스템 사용
    return { url: `/storage/${pathname}` };
  }

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

// 스토리지 사용량 조회 (관리자용)
export async function getStorageUsage() {
  const client = getS3Client();
  if (!client) {
    // 파일 시스템 사용 시 사용량 정보 없음
    return {
      currentUsage: 0,
      currentUsageGB: 0,
      limit: FREE_TIER_LIMIT,
      limitGB: 10,
      remaining: FREE_TIER_LIMIT,
      remainingGB: 10,
      usagePercent: 0,
      isWarning: false,
      isExceeded: false,
      storageType: 'file-system'
    };
  }

  const isB2 = process.env.B2_ENDPOINT && process.env.B2_APPLICATION_KEY_ID;
  const usage = await getCurrentStorageUsage();
  const usageGB = (usage / (1024 * 1024 * 1024)).toFixed(2);
  const limitGB = isB2 ? 10 : 0; // B2만 10GB 제한
  const limit = isB2 ? FREE_TIER_LIMIT : Infinity;
  const usagePercent = isB2 ? ((usage / FREE_TIER_LIMIT) * 100).toFixed(1) : 0;

  return {
    currentUsage: usage,
    currentUsageGB: parseFloat(usageGB),
    limit: isB2 ? FREE_TIER_LIMIT : Infinity,
    limitGB: isB2 ? 10 : 0,
    remaining: isB2 ? FREE_TIER_LIMIT - usage : Infinity,
    remainingGB: isB2 ? parseFloat(((FREE_TIER_LIMIT - usage) / (1024 * 1024 * 1024)).toFixed(2)) : 0,
    usagePercent: parseFloat(usagePercent),
    isWarning: isB2 && parseFloat(usagePercent) >= FREE_TIER_WARNING_THRESHOLD * 100,
    isExceeded: isB2 && usage > FREE_TIER_LIMIT,
    storageType: isB2 ? 'backblaze-b2' : (process.env.R2_ENDPOINT ? 'cloudflare-r2' : 's3')
  };
}
