import { verifyAdminToken } from '../../../lib/adminAuth';
import { listBlobs, deleteBlob } from '../../../lib/blob';

/**
 * 모든 Blob 파일을 삭제하는 API
 * 주의: 데이터베이스 레코드와 무관하게 모든 Blob을 삭제합니다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  const { prefix, confirm } = req.body || {};

  // 안전장치: confirm 파라미터 필요
  if (confirm !== 'DELETE_ALL_BLOBS') {
    return res.status(400).json({
      ok: false,
      message: '안전을 위해 confirm 파라미터가 필요합니다. { confirm: "DELETE_ALL_BLOBS" }'
    });
  }

  try {
    console.log(`[delete-all-blobs] 시작 - prefix: ${prefix || '(전체)'}`);
    
    // 모든 Blob 나열
    const blobs = await listBlobs(prefix || '');
    console.log(`[delete-all-blobs] 발견된 Blob 수: ${blobs.length}`);

    if (blobs.length === 0) {
      return res.status(200).json({
        ok: true,
        deleted: 0,
        message: '삭제할 Blob이 없습니다.'
      });
    }

    // 배치로 삭제 (한 번에 너무 많이 삭제하면 타임아웃될 수 있음)
    const BATCH_SIZE = 50;
    let deleted = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
      const batch = blobs.slice(i, i + BATCH_SIZE);
      console.log(`[delete-all-blobs] 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(blobs.length / BATCH_SIZE)} 처리 중... (${batch.length}개)`);
      
      const results = await Promise.allSettled(
        batch.map((blob) => deleteBlob(blob.pathname))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          deleted++;
        } else {
          failed++;
          errors.push({
            pathname: batch[idx].pathname,
            error: result.reason?.message || String(result.reason)
          });
        }
      });

      // 배치 간 짧은 대기 (API 제한 방지)
      if (i + BATCH_SIZE < blobs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[delete-all-blobs] 완료 - 삭제: ${deleted}, 실패: ${failed}`);

    return res.status(200).json({
      ok: true,
      deleted,
      failed,
      total: blobs.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // 최대 10개만 반환
      message: `${deleted}개의 Blob이 삭제되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ''}`
    });
  } catch (err) {
    console.error('[delete-all-blobs] 오류:', err);
    return res.status(500).json({
      ok: false,
      message: 'Blob 삭제 처리 중 오류가 발생했습니다.',
      error: err.message
    });
  }
}

