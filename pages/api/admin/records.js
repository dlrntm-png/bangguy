import { verifyAdminToken } from '../../../lib/adminAuth';
import { getRecords } from '../../../lib/db';

function buildDayRangeKst(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildMonthRangeKst(monthStr) {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const start = new Date(`${monthStr}-01T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  const [yearStr, monthStrNum] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStrNum);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  const nextMonth =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const end = new Date(`${nextMonth}-01T00:00:00+09:00`);
  if (Number.isNaN(end.getTime())) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  const employeeId = req.query.employeeId ? String(req.query.employeeId).trim() : null;
  const dateQuery = req.query.date ? String(req.query.date).trim() : null;
  const monthQuery = req.query.month ? String(req.query.month).trim() : null;

  if (dateQuery && monthQuery) {
    return res.status(400).json({ ok: false, message: '날짜와 월을 동시에 사용할 수 없습니다.' });
  }

  let range = null;
  if (dateQuery) {
    range = buildDayRangeKst(dateQuery);
    if (!range) {
      return res.status(400).json({ ok: false, message: '잘못된 날짜 형식입니다. (예: 2025-11-11)' });
    }
  } else if (monthQuery) {
    range = buildMonthRangeKst(monthQuery);
    if (!range) {
      return res.status(400).json({ ok: false, message: '잘못된 월 형식입니다. (예: 2025-11)' });
    }
  }

  try {
    const records = await getRecords({
      employeeId,
      startISO: range?.start,
      endISO: range?.end
    });
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
