import sharp from 'sharp';

const DEFAULT_MAX_WIDTH = Number(process.env.UPLOAD_MAX_WIDTH || 1280);
const DEFAULT_QUALITY = Number(process.env.UPLOAD_WEBP_QUALITY || 80);

export async function compressImage(buffer, options = {}) {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const quality = options.quality || DEFAULT_QUALITY;
  const converter = sharp(buffer, { failOnError: false });

  const metadata = await converter.metadata();

  let pipeline = converter.rotate(); // EXIF 회전 정보가 있을 경우 자동으로 보정
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const { data, info } = await pipeline.webp({
    quality,
    effort: 4,
    smartSubsample: true
  }).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    info: {
      width: info.width,
      height: info.height,
      size: data.length,
      format: 'webp',
      contentType: 'image/webp'
    },
    original: {
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      format: metadata.format
    }
  };
}


