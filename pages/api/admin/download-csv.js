import { verifyAdminToken } from '../../../lib/adminAuth';
import { getAllRecordsRaw } from '../../../lib/db';
import { buildCsv } from '../../../lib/csv';

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  try {
    const rows = await getAllRecordsRaw();
    const csv = buildCsv(rows, [
      { header: 'server_time', value: (row) => toISOString(row.server_time) },
      { key: 'employee_id' },
      { key: 'name' },
      { key: 'ip' },
      { key: 'photo_url' },
      { key: 'photo_blob_path' },
      { key: 'photo_content_type' },
      { key: 'photo_size' },
      { key: 'photo_width' },
      { key: 'photo_height' },
      { header: 'office', value: (row) => (row.office ? 'true' : 'false') },
      { key: 'device_id' },
      { key: 'image_hash' },
      { key: 'cleanup_scheduled_at' },
      { key: 'photo_deleted_at' },
      { key: 'backup_blob_path' },
      { key: 'backup_generated_at' }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('download-csv error:', err);
    return res.status(500).json({ ok: false, message: '다운로드 실패' });
  }
}

function toISOString(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toISOString();
  } catch {
    return value;
  }
}
