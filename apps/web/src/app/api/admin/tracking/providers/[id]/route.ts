import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  deleteTrackingProvider,
  listTrackingProviders,
  updateTrackingProvider,
} from '@/lib/db/queries/tracking/providers';
import { auditTrackingChange } from '@/lib/tracking/server/audit';
import { validateCustomCode } from '@/lib/tracking/providers/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    status: z.enum(['enabled', 'disabled', 'error']).optional(),
    pixelId: z.string().max(255).nullable().optional(),
    capiToken: z.string().max(8192).nullable().optional(),
    testEventCode: z.string().max(64).nullable().optional(),
    customHead: z.string().max(50_000).nullable().optional(),
    customBody: z.string().max(50_000).nullable().optional(),
    config: z.record(z.unknown()).optional(),
    enabledEvents: z.array(z.string()).optional(),
  })
  .strict();

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const all = await listTrackingProviders();
    const found = all.find((p) => p.id === ctx.params.id);
    if (!found) throw new HttpError('not_found', 'Provider introuvable');
    return NextResponse.json({
      provider: {
        id: found.id,
        kind: found.kind,
        status: found.status,
        pixelId: found.pixelId,
        hasCapiToken: !!found.capiToken,
        testEventCode: found.testEventCode,
        customHead: found.customHead,
        customBody: found.customBody,
        config: found.config,
        enabledEvents: found.enabledEvents,
        lastEventAt: found.lastEventAt,
        errorCount24h: found.errorCount24h,
        lastError: found.lastError,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const all = await listTrackingProviders();
    const existing = all.find((p) => p.id === ctx.params.id);
    if (!existing) throw new HttpError('not_found', 'Provider introuvable');

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const customCodeChanged =
      parsed.data.customHead !== undefined || parsed.data.customBody !== undefined;
    if (customCodeChanged && existing.kind === 'custom') {
      const head = parsed.data.customHead ?? existing.customHead ?? '';
      const body = parsed.data.customBody ?? existing.customBody ?? '';
      for (const code of [head, body]) {
        if (code && code.trim().length > 0) {
          const v = validateCustomCode(code);
          if (!v.ok) {
            throw new HttpError('invalid_input', 'Custom code refusé', { errors: v.errors });
          }
        }
      }
    }
    const updated = await updateTrackingProvider(ctx.params.id, parsed.data);
    const action =
      parsed.data.status === 'enabled'
        ? 'enable'
        : parsed.data.status === 'disabled'
          ? 'disable'
          : customCodeChanged
            ? 'custom_code_update'
            : 'update';
    await auditTrackingChange({
      action,
      resource: 'tracking_provider',
      resourceId: updated.id,
      actorId: session.adminId,
      meta: { kind: updated.kind, status: updated.status },
    });
    // Le snippet GTM/Meta/etc. est récupéré au runtime via /api/track/pixels
    // (no-store) donc le widget client se met à jour sans cache stale, mais
    // la page publique reste cachée par ISR (`s-maxage=1800`). On invalide
    // le layout pour que le `<TrackingProvider>` rendu côté serveur reflète
    // l'activation/désactivation immédiatement.
    revalidatePath('/', 'layout');
    return NextResponse.json({
      provider: {
        id: updated.id,
        kind: updated.kind,
        status: updated.status,
        pixelId: updated.pixelId,
        hasCapiToken: !!updated.capiToken,
        testEventCode: updated.testEventCode,
        customHead: updated.customHead,
        customBody: updated.customBody,
        config: updated.config,
        enabledEvents: updated.enabledEvents,
        lastEventAt: updated.lastEventAt,
        errorCount24h: updated.errorCount24h,
        lastError: updated.lastError,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await deleteTrackingProvider(ctx.params.id);
    await auditTrackingChange({
      action: 'delete',
      resource: 'tracking_provider',
      resourceId: ctx.params.id,
      actorId: session.adminId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
