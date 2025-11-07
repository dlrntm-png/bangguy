import { verifyAdminToken } from '../../../lib/adminAuth.js';
import { getAllRecordsRaw } from '../../../lib/db.js';

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  try {
    const rows = await getAllRecordsRaw();
    const header = 'server_time,employee_id,name,ip,photo_url,office,device_id,image_hash\n';
    const body = rows
      .map(row => [
        row.server_time?.toISOString?.() || row.server_time,
        safeCsv(row.employee_id),
        safeCsv(row.name),
        safeCsv(row.ip),
        safeCsv(row.photo_url || ''),
        row.office ? 'true' : 'false',
        safeCsv(row.device_id || ''),
        safeCsv(row.image_hash || '')
      ].join(','))
      .join('\n');

    const csv = header + body;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('download-csv error:', err);
    return res.status(500).json({ ok: false, message: '다운로드 실패' });
  }
}

function safeCsv(value) {
  if (value == null) return '';
  const str = String(value).replace(/\r|\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
