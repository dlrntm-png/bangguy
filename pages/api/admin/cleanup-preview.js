import { authorizeCronOrAdmin } from '../../../lib/cronAuth';
import { getKoreaISOString, getPreviousMonthPeriodKst } from '../../../lib/time';
import {
  getRecordsForCleanup,
  getLatestCleanupJob,
  createCleanupJob
} from '../../../lib/db';
import { buildCsv } from '../../../lib/csv';
import { uploadTextContent } from '../../../lib/blob';
import { sendEmail } from '../../../lib/email';
import { formatBytes } from '../../../lib/format';

function parseEmails(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: '허용되지 않은 메서드입니다.' });
  }

  try {
    authorizeCronOrAdmin(req);
  } catch (err) {
    return res
      .status(err.statusCode || 401)
      .json({ ok: false, message: err.message || '권한이 없습니다.' });
  }

  try {
    const nowIso = getKoreaISOString();
    const period = getPreviousMonthPeriodKst(nowIso);
    const existingJob = await getLatestCleanupJob(period.start, period.end);
    if (existingJob && existingJob.status !== 'failed') {
      return res.status(200).json({
        ok: true,
        message: '이미 해당 기간에 대한 정리 작업이 등록되어 있습니다.',
        job: existingJob
      });
    }

    const records = await getRecordsForCleanup(period.start, period.end);
    const totalRecords = records.length;
    const totalPhotos = records.filter((row) => row.photo_blob_path).length;
    const totalBytes = records.reduce(
      (acc, row) => acc + Number(row.photo_size || 0),
      0
    );

    const csv = buildCsv(records, [
      { key: 'id', header: 'record_id' },
      { key: 'server_time' },
      { key: 'employee_id' },
      { key: 'name' },
      { key: 'ip' },
      { key: 'photo_url' },
      { key: 'photo_blob_path' },
      { key: 'photo_size' },
      { key: 'photo_content_type' },
      { key: 'device_id' },
      { key: 'office' },
      { key: 'cleanup_scheduled_at' }
    ]);

    const uploadResult = await uploadTextContent(csv, {
      prefix: `backups/${period.label}`,
      extension: '.csv',
      contentType: 'text/csv; charset=utf-8',
      access: 'public'
    });

    const job = await createCleanupJob({
      periodStart: period.start,
      periodEnd: period.end,
      status: 'preview',
      backupBlobPath: uploadResult.pathname,
      backupDownloadUrl: uploadResult.url,
      totalRecords,
      totalPhotos,
      totalBytes
    });

    const recipients = parseEmails(process.env.CLEANUP_NOTIFY_EMAILS);
    if (recipients.length > 0) {
      const subject = `[출퇴근 시스템] ${period.label} 사진 백업 알림`;
      const downloadLink =
        uploadResult.url ||
        `${process.env.BLOB_PUBLIC_BASE_URL || ''}/${uploadResult.pathname}`;

      const html = `
        <p>안녕하세요,</p>
        <p><strong>${period.label}</strong> 기간의 출퇴근 사진 ${totalPhotos}건 (${formatBytes(
          totalBytes
        )})이 <strong>다음 달 1일</strong>에 자동 삭제될 예정입니다.</p>
        <p>삭제 전에 아래 링크에서 메타데이터를 내려받아 로컬 드라이브에 보관해주세요.</p>
        <p><a href="${downloadLink}" target="_blank">백업 CSV 내려받기</a></p>
        <p>사진 원본은 관리자 페이지에서 기간별로 검색하여 직접 다운로드할 수 있습니다.</p>
        <p>※ 위 링크는 일정 시간이 지나면 만료될 수 있으니 빠르게 백업해 주세요.</p>
      `;

      try {
        await sendEmail({
          to: recipients,
          subject,
          html,
          text: `총 ${totalPhotos}건 (${formatBytes(totalBytes)})의 사진이 다음 달 1일 삭제될 예정입니다. 아래 링크에서 CSV를 내려받아 백업하세요: ${downloadLink}`
        });
      } catch (emailError) {
        console.error('cleanup preview email error:', emailError);
      }
    }

    return res.status(200).json({
      ok: true,
      period,
      totalRecords,
      totalPhotos,
      totalBytes,
      backup: uploadResult,
      job
    });
  } catch (err) {
    console.error('cleanup-preview error:', err);
    return res.status(500).json({ ok: false, message: err.message || '백업 준비 중 오류가 발생했습니다.' });
  }
}

