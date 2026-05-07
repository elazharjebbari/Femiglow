import { logAuditEvent } from '@/lib/audit/log-event';
import {
  findMediaById,
  updateMedia,
} from '@/lib/db/queries/media';
import {
  claimNextPendingJob,
  markJobDone,
  markJobFailed,
} from '@/lib/db/queries/media-jobs';
import { upsertVariant } from '@/lib/db/queries/media-variants';
import { getStorage } from '@/lib/media/storage';
import { optimizeImage } from '@/lib/media/pipeline/optimize-image';
import { optimizeVideo } from '@/lib/media/pipeline/optimize-video';
import { optimizeAudio } from '@/lib/media/pipeline/optimize-audio';
import type { MediaJob } from '@/lib/db/types';

async function loadSourceBuffer(storageKey: string): Promise<Buffer> {
  const storage = getStorage();
  if (!storage.get) throw new Error(`storage driver ${storage.driver} cannot read source`);
  return storage.get(storageKey);
}

async function processOptimize(job: MediaJob): Promise<void> {
  const media = await findMediaById(job.mediaId);
  if (!media) throw new Error(`media ${job.mediaId} introuvable`);
  await updateMedia(media.id, { status: 'processing' });

  const sourceKey = (job.payload as { sourceKey?: string }).sourceKey;
  if (!sourceKey) throw new Error('payload.sourceKey manquant');
  const buffer = await loadSourceBuffer(sourceKey);

  if (media.kind === 'image') {
    // Si le Media porte un override `breakpoints` (politique fixée par seed
    // ou par l'admin), on le respecte. Sinon, défauts (sm → 2xl).
    const breakpoints = media.overrides?.breakpoints?.length
      ? media.overrides.breakpoints
      : undefined;
    const result = await optimizeImage({ mediaId: media.id, buffer, breakpoints });
    for (const v of result.variants) {
      await upsertVariant({
        mediaId: media.id,
        format: v.format,
        breakpoint: v.breakpoint,
        width: v.width,
        height: v.height,
        sizeBytes: v.sizeBytes,
        url: v.url,
        checksum: v.checksum,
        quality: v.quality,
      });
    }
    await updateMedia(media.id, {
      status: 'ready',
      blurhash: result.blurhash,
      palette: result.palette,
      phash: result.phash,
      originalWidth: result.width,
      originalHeight: result.height,
    });
  } else if (media.kind === 'video') {
    const result = await optimizeVideo({ mediaId: media.id, buffer });
    for (const v of result.variants) {
      await upsertVariant({
        mediaId: media.id,
        format: v.format,
        breakpoint: null,
        width: v.width ?? null,
        height: v.height ?? null,
        sizeBytes: v.sizeBytes,
        url: v.url,
        checksum: v.checksum,
        bitrateKbps: v.bitrateKbps ?? null,
      });
    }
    await upsertVariant({
      mediaId: media.id,
      format: 'poster',
      breakpoint: null,
      sizeBytes: result.posterArtifact.sizeBytes,
      url: result.posterArtifact.url,
      checksum: result.posterArtifact.checksum,
    });
    await updateMedia(media.id, {
      status: 'ready',
      originalDurationMs: result.durationMs,
      originalWidth: result.width,
      originalHeight: result.height,
    });
  } else if (media.kind === 'audio') {
    const result = await optimizeAudio({ mediaId: media.id, buffer });
    for (const v of result.variants) {
      await upsertVariant({
        mediaId: media.id,
        format: v.format,
        breakpoint: null,
        sizeBytes: v.sizeBytes,
        url: v.url,
        checksum: v.checksum,
        bitrateKbps: v.bitrateKbps ?? null,
      });
    }
    await updateMedia(media.id, { status: 'ready', originalDurationMs: result.durationMs });
  }

  await logAuditEvent({
    actorId: null,
    action: 'media.optimized',
    resourceType: 'media',
    resourceId: media.id,
    meta: { kind: media.kind, jobId: job.id },
  });
}

export async function runWorkerOnce(): Promise<{ processed: number }> {
  let processed = 0;
  for (let i = 0; i < 10; i += 1) {
    const job = await claimNextPendingJob();
    if (!job) break;
    try {
      if (job.kind === 'optimize' || job.kind === 'regenerate') {
        await processOptimize(job);
      }
      await markJobDone(job.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await markJobFailed(job.id, message);
      await updateMedia(job.mediaId, { status: 'failed', failureReason: message }).catch(() => {});
    }
  }
  return { processed };
}
