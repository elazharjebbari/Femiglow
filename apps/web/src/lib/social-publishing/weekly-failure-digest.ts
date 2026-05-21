/**
 * S3.2 — Weekly digest of social publish failures.
 *
 * Aggregates `social_publish_job` rows with status='failed' updated in the
 * last 7 days. Groups by `provider/platform/error_code` so operators can
 * see at a glance whether Postiz is dropping more 503s, whether the legacy
 * pipeline is producing duplicates, etc.
 *
 * Intentionally side-effect-free: returns a rendered { subject, html, text }
 * triplet. The cron route is responsible for sending and logging.
 */
import { listPublishJobs } from './repository';
import type { SocialPublishJob, SocialPublishErrorCode } from './contracts';

export interface WeeklyFailureBucket {
  provider: string;
  platform: string;
  errorCode: SocialPublishErrorCode | 'unknown';
  count: number;
  retryableCount: number;
  sampleMessage: string;
}

export interface WeeklyFailureDigest {
  total: number;
  windowStart: Date;
  windowEnd: Date;
  buckets: WeeklyFailureBucket[];
  subject: string;
  text: string;
  html: string;
}

export async function buildWeeklyFailureDigest(input: {
  now?: Date;
  jobs?: SocialPublishJob[];
}): Promise<WeeklyFailureDigest> {
  const now = input.now ?? new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const allFailed = input.jobs ?? (await listPublishJobs({ status: 'failed' }));
  const failed = allFailed.filter(
    (job) => job.updatedAt >= windowStart && job.updatedAt <= now,
  );

  const map = new Map<string, WeeklyFailureBucket>();
  for (const job of failed) {
    const errorCode = job.lastError?.code ?? 'unknown';
    const key = `${job.provider}|${job.platform}|${errorCode}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (job.lastError?.retryable) existing.retryableCount += 1;
    } else {
      map.set(key, {
        provider: job.provider,
        platform: job.platform,
        errorCode,
        count: 1,
        retryableCount: job.lastError?.retryable ? 1 : 0,
        sampleMessage: job.lastError?.message ?? '',
      });
    }
  }

  const buckets = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const subject =
    failed.length === 0
      ? `[FemiGlow social] 0 échec cette semaine`
      : `[FemiGlow social] ${failed.length} échec(s) cette semaine`;

  const text = renderText({ failed, buckets, windowStart, windowEnd: now });
  const html = renderHtml({ failed, buckets, windowStart, windowEnd: now });

  return {
    total: failed.length,
    windowStart,
    windowEnd: now,
    buckets,
    subject,
    text,
    html,
  };
}

function renderText(input: {
  failed: SocialPublishJob[];
  buckets: WeeklyFailureBucket[];
  windowStart: Date;
  windowEnd: Date;
}): string {
  const head = `Digest hebdomadaire — échecs de publication sociale\nFenêtre : ${input.windowStart.toISOString()} → ${input.windowEnd.toISOString()}\nTotal échecs : ${input.failed.length}\n\n`;
  if (input.buckets.length === 0) return `${head}Aucun échec sur la fenêtre. 🎉\n`;
  const lines = input.buckets.map((bucket) => {
    return `- ${bucket.provider}/${bucket.platform} · ${bucket.errorCode} : ${bucket.count} (retryable: ${bucket.retryableCount}) — ex. "${bucket.sampleMessage}"`;
  });
  return `${head}${lines.join('\n')}\n`;
}

function renderHtml(input: {
  failed: SocialPublishJob[];
  buckets: WeeklyFailureBucket[];
  windowStart: Date;
  windowEnd: Date;
}): string {
  if (input.buckets.length === 0) {
    return `<p><strong>Aucun échec</strong> sur la fenêtre ${input.windowStart.toISOString()} → ${input.windowEnd.toISOString()}. 🎉</p>`;
  }
  const rows = input.buckets
    .map(
      (bucket) =>
        `<tr><td>${escapeHtml(bucket.provider)}</td><td>${escapeHtml(bucket.platform)}</td><td>${escapeHtml(bucket.errorCode)}</td><td style="text-align:right">${bucket.count}</td><td style="text-align:right">${bucket.retryableCount}</td><td>${escapeHtml(bucket.sampleMessage)}</td></tr>`,
    )
    .join('');
  return `<p>Digest hebdomadaire — échecs de publication sociale<br/>Fenêtre : ${input.windowStart.toISOString()} → ${input.windowEnd.toISOString()}<br/>Total : <strong>${input.failed.length}</strong></p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Provider</th><th>Platform</th><th>Code</th><th>Count</th><th>Retryable</th><th>Sample</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
