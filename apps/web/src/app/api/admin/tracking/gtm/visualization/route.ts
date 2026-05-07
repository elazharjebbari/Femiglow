import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmExporter, type GtmEnvironment } from '@/lib/tracking/gtm/exporter';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { buildGraphDescriptor } from '@/lib/tracking/gtm/viz/descriptor';
import { descriptorToMermaid } from '@/lib/tracking/gtm/viz/mermaid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENVS = ['production', 'stage', 'preview', 'dev'] as const;

const querySchema = z.object({
  env: z.enum(ENVS).default('production'),
  format: z.enum(['json', 'mermaid']).default('json'),
  configId: z
    .union([z.string().uuid(), z.literal('active'), z.literal('defaults')])
    .optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const params = querySchema.parse({
      env: url.searchParams.get('env') ?? undefined,
      format: url.searchParams.get('format') ?? undefined,
      configId: url.searchParams.get('configId') ?? undefined,
    });

    const env = params.env as GtmEnvironment;

    let configOverride: Record<string, unknown> | undefined;
    if (params.configId && params.configId !== 'defaults') {
      const v =
        params.configId === 'active'
          ? await gtmConfigStore.getActive()
          : await gtmConfigStore.get(params.configId);
      if (v) configOverride = v.perEnv[env];
    }

    const exp = gtmExporter.build({
      env,
      ...(configOverride ? { config: configOverride } : {}),
    });

    const descriptor = buildGraphDescriptor(exp.container);

    if (params.format === 'mermaid') {
      const mermaid = descriptorToMermaid(descriptor);
      return new Response(mermaid, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      descriptor,
      stats: {
        tags: descriptor.totalTags,
        triggers: descriptor.totalTriggers,
        variables: descriptor.totalVariables,
      },
      env,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
