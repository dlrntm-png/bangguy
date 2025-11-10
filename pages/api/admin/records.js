import { verifyAdminToken } from '../../../lib/adminAuth';
import { getRecords } from '../../../lib/db';

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  const employeeId = req.query.employeeId ? String(req.query.employeeId).trim() : null;

  try {
    const records = await getRecords(employeeId);
    const mapped = records.map((row) => ({
      recordId: row.id,
      server_time: row.server_time,
      employee_id: row.employee_id,
      name: row.name,
      ip: row.ip,
      file: row.photo_url,
      photo_blob_path: row.photo_blob_path,
       photo_content_type: row.photo_content_type,
       photo_size: row.photo_size,
       photo_width: row.photo_width,
       photo_height: row.photo_height,
      office: row.office,
      device_id: row.device_id,
      image_hash: row.image_hash,
      cleanup_scheduled_at: row.cleanup_scheduled_at,
      photo_deleted_at: row.photo_deleted_at,
      backup_blob_path: row.backup_blob_path,
      backup_generated_at: row.backup_generated_at
    }));

    return res.status(200).json({ ok: true, records: mapped });
  } catch (err) {
    console.error('records error:', err);
    return res.status(500).json({ ok: false, message: '기록 조회 실패' });
  }
}
