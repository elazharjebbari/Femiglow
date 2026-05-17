import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  importPostizPerformanceJob,
  importPostizStatusJob,
  retryPostizDeliveriesJob,
  syncPostizIntegrationsJob,
} from '@/lib/content-studio/automation';
import { requireContentStudioEnabled } from '@/lib/content-studio/auth';
import {
  listContentPerformanceSnapshotsOverview,
  listPostizDeliveriesOverview,
} from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const automationSchema = z.object({
  job: z.enum(['postiz-sync', 'retry-deliveries', 'import-status', 'import-performance']),
  dryRun: z.boolean().optional().default(true),
  limit: z.number().int().positive().max(100).optional(),
  maxAttempts: z.number().int().positive().max(10).optional(),
  pastDays: z.number().int().positive().max(180).optional(),
  futureDays: z.number().int().positive().max(180).optional(),
  days: z.number().int().positive().max(90).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdmin('/admin/content-studio');
    const json = (await request.json().catch(() => ({}))) as unknown;
    const parsed = automationSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Paramètres automation invalides.', parsed.error.flatten());
    }
    const input = parsed.data;

    if (input.job === 'postiz-sync') {
      const result = await syncPostizIntegrationsJob();
      return NextResponse.json({ job: input.job, result });
    }

    if (input.job === 'retry-deliveries') {
      const result = await retryPostizDeliveriesJob({
        dryRun: input.dryRun,
        limit: input.limit,
        maxAttempts: input.maxAttempts,
      });
      return NextResponse.json({
        job: input.job,
        result,
        deliveries: await listPostizDeliveriesOverview(),
      });
    }

    if (input.job === 'import-status') {
      const result = await importPostizStatusJob({
        dryRun: input.dryRun,
        limit: input.limit,
        pastDays: input.pastDays,
        futureDays: input.futureDays,
      });
      return NextResponse.json({
        job: input.job,
        result,
        snapshots: await listContentPerformanceSnapshotsOverview(),
      });
    }

    const result = await importPostizPerformanceJob({
      dryRun: input.dryRun,
      limit: input.limit,
      days: input.days,
    });
    return NextResponse.json({
      job: input.job,
      result,
      snapshots: await listContentPerformanceSnapshotsOverview(),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
