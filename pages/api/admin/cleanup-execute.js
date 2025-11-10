import { authorizeCronOrAdmin } from '../../../lib/cronAuth';
import { getKoreaISOString, getPreviousMonthPeriodKst } from '../../../lib/time';
import {
  getRecordsForCleanup,
  getLatestCleanupJob,
  createCleanupJob,
  updateCleanupJob,
  markRecordsAfterCleanup
} from '../../../lib/db';
import { deleteBlob } from '../../../lib/blob';
import { formatBytes } from '../../../lib/format';

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
    let job = await getLatestCleanupJob(period.start, period.end);

    if (!job) {
      job = await createCleanupJob({
        periodStart: period.start,
        periodEnd: period.end,
        status: 'running',
        executedAt: new Date().toISOString()
      });
    } else {
      job = await updateCleanupJob(job.id, {
        status: 'running',
        executed_at: new Date().toISOString()
      });
    }

    const records = await getRecordsForCleanup(period.start, period.end);
    const blobPaths = records.map((row) => row.photo_blob_path).filter(Boolean);
    let deletedFiles = 0;

    for (const path of blobPaths) {
      if (!path) continue;
      try {
        await deleteBlob(path);
        deletedFiles += 1;
      } catch (err) {
        console.error('blob delete error:', path, err);
      }
    }

    const updatedCount = await markRecordsAfterCleanup(
      records.map((row) => row.id),
      {
        backupBlobPath: job?.backup_blob_path || null,
        backupGeneratedAt: job?.created_at || new Date().toISOString()
      }
    );

    const finishedJob = await updateCleanupJob(job.id, {
      status: 'completed',
      finished_at: new Date().toISOString(),
      total_records: records.length,
      total_photos: blobPaths.length,
      total_bytes: records.reduce(
        (acc, row) => acc + Number(row.photo_size || 0),
        0
      ),
      error: null
    });

    return res.status(200).json({
      ok: true,
      period,
      deletedFiles,
      updatedCount,
      totalBytes: finishedJob.total_bytes,
      readableSize: formatBytes(finishedJob.total_bytes || 0),
      job: finishedJob
    });
  } catch (err) {
    console.error('cleanup-execute error:', err);
    return res
      .status(500)
      .json({ ok: false, message: err.message || '정리 작업 중 오류가 발생했습니다.' });
  }
}

