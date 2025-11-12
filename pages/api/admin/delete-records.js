import { verifyAdminToken } from '../../../lib/adminAuth';
import {
  deleteRecordsByIds,
  deleteAllRecords
} from '../../../lib/db';
import { deleteBlob } from '../../../lib/blob';

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

  const { recordIds, deleteAll } = req.body || {};

  try {
    let deleted = 0;
    let blobPaths = [];

    if (deleteAll) {
      const rows = await deleteAllRecords();
      deleted = rows.length;
      blobPaths = rows
        .map((row) => row.photo_blob_path)
        .filter(Boolean);
    } else {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        return res.status(400).json({ ok: false, message: '삭제할 기록을 선택해주세요.' });
      }
      const ids = recordIds.map(Number).filter((n) => Number.isInteger(n));
      if (ids.length === 0) {
        return res.status(400).json({ ok: false, message: '유효한 기록 번호가 없습니다.' });
      }
      const rows = await deleteRecordsByIds(ids);
      deleted = rows.length;
      if (deleted === 0) {
        return res.status(404).json({ ok: false, message: '선택한 기록을 찾을 수 없습니다.' });
      }
      blobPaths = rows
        .map((row) => row.photo_blob_path)
        .filter(Boolean);
    }

    // 대량 삭제 시 배치 처리로 타임아웃 방지
    const BATCH_SIZE = 50;
    let deletedFiles = 0;
    let failedFiles = 0;

    if (blobPaths.length > 0) {
      for (let i = 0; i < blobPaths.length; i += BATCH_SIZE) {
        const batch = blobPaths.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((path) => deleteBlob(path).catch((err) => {
            console.warn(`[delete-records] Blob 삭제 실패: ${path}`, err?.message);
            throw err;
          }))
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            deletedFiles++;
          } else {
            failedFiles++;
          }
        });

        // 배치 간 짧은 대기 (API 제한 방지)
        if (i + BATCH_SIZE < blobPaths.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      deleted,
      deletedFiles,
      failedFiles,
      message: `${deleted}건의 기록과 ${deletedFiles}개의 파일이 삭제되었습니다.${failedFiles > 0 ? ` (${failedFiles}개 파일 삭제 실패)` : ''}`
    });
  } catch (err) {
    console.error('delete-records error:', err);
    return res.status(500).json({ ok: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
}
