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

    await Promise.all(blobPaths.map((path) => deleteBlob(path).catch(() => null)));

    return res.status(200).json({ ok: true, deleted, deletedFiles: blobPaths.length });
  } catch (err) {
    console.error('delete-records error:', err);
    return res.status(500).json({ ok: false, message: '삭제 처리 중 오류가 발생했습니다.' });
  }
}
