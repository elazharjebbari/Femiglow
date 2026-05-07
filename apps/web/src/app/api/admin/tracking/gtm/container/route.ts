import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmExporter, type GtmEnvironment } from '@/lib/tracking/gtm/exporter';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENVS = ['production', 'stage', 'preview', 'dev'] as const;

const querySchema = z.object({
  env: z.enum(ENVS).default('production'),
  format: z.enum(['json', 'pretty', 'minified']).default('pretty'),
  download: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((v) => v === 'true' || v === '1')
    .optional()
    .default('false'),
  configId: z
    .union([z.string().uuid(), z.literal('active'), z.literal('defaults')])
    .optional(),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const params = querySchema.parse({
      env: url.searchParams.get('env') ?? undefined,
      format: url.searchParams.get('format') ?? undefined,
      download: url.searchParams.get('download') ?? undefined,
      configId: url.searchParams.get('configId') ?? undefined,
    });

    const env = params.env as GtmEnvironment;

    // Si configId fourni (uuid ou 'active'), on l'utilise comme override.
    let configOverride: Record<string, unknown> | undefined;
    let configIdResolved: string | null = null;
    if (params.configId && params.configId !== 'defaults') {
      const version =
        params.configId === 'active'
          ? await gtmConfigStore.getActive()
          : await gtmConfigStore.get(params.configId);
      if (version) {
        configOverride = version.perEnv[env];
        configIdResolved = version.id;
      }
    }

    const exp = gtmExporter.build({
      env,
      ...(configOverride ? { config: configOverride } : {}),
    });

    const action = params.download ? 'export_download' : 'export_view';
    await auditTrackingChange({
      action,
      resource: 'tracking_gtm',
      resourceId: env,
      actorId: session.adminId,
      meta: {
        env,
        format: params.format,
        sha256: exp.meta.sha256,
        sizeBytes: exp.meta.sizeBytes,
        configId: configIdResolved,
      },
    });

    if (params.download) {
      const body = params.format === 'minified' ? exp.minified : exp.pretty;
      const cfgSuffix = configIdResolved ? `-cfg${configIdResolved.slice(0, 8)}` : '';
      const filename = `gtm-femiglow-${env}-${todayIso()}${cfgSuffix}.json`;
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          'X-Container-SHA256': exp.meta.sha256,
        },
      });
    }

    if (params.format === 'json') {
      return NextResponse.json({
        container: exp.container,
        stats: exp.stats,
        meta: exp.meta,
      });
    }

    // format = pretty | minified — on renvoie un objet { pretty, stats, meta }
    return NextResponse.json({
      pretty: params.format === 'minified' ? exp.minified : exp.pretty,
      stats: exp.stats,
      meta: exp.meta,
      env,
      configId: configIdResolved,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
