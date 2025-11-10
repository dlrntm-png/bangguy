import { verifyAdminToken } from '../../../lib/adminAuth';
import { getConsentLogs } from '../../../lib/consent';
import { buildCsv } from '../../../lib/csv';

export default async function handler(req, res) {
  try {
    verifyAdminToken(req);
  } catch (err) {
    return res.status(401).json({ ok: false, message: err.message || '인증 실패' });
  }

  try {
    const logs = await getConsentLogs();
    if (!logs || logs.length === 0) {
      return res.status(204).end();
    }

    const csv = buildCsv(logs, [
      { header: 'consented_at', value: (row) => formatKst(row.consentedAt) },
      { key: 'employeeId', header: 'employee_id' },
      { key: 'name' },
      { key: 'deviceId', header: 'device_id' },
      { key: 'ip' },
      { key: 'userAgent', header: 'user_agent' },
      { key: 'blobPath', header: 'blob_path' },
      { key: 'blobSize', header: 'blob_size' },
      { header: 'uploaded_at', value: (row) => formatKst(row.uploadedAt) }
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent_logs_${new Date().toISOString().split('T')[0]}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin] download consent logs error:', err);
    return res.status(500).json({ ok: false, message: '동의 로그 다운로드에 실패했습니다.' });
  }
}

function formatKst(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())} ${pad(kst.getHours())}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`;
  } catch {
    return String(value);
  }
}

