import { verifyAdminToken } from '../../../lib/adminAuth.js';
import { getRecordById, clearPhotoFields } from '../../../lib/db.js';
import { deleteBlob } from '../../../lib/blob.js';

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

  const { recordId } = req.body || {};
  if (!recordId) {
    return res.status(400).json({ ok: false, message: 'recordId가 필요합니다.' });
  }

  try {
    const record = await getRecordById(Number(recordId));
    if (!record) {
      return res.status(404).json({ ok: false, message: '기록을 찾을 수 없습니다.' });
    }

    if (record.photo_blob_path) {
      await deleteBlob(record.photo_blob_path);
    }

    await clearPhotoFields(record.id);

    return res.status(200).json({ ok: true, message: '사진이 삭제되었습니다.' });
  } catch (err) {
    console.error('delete-photo error:', err);
    return res.status(500).json({ ok: false, message: '파일 삭제 실패' });
  }
}
