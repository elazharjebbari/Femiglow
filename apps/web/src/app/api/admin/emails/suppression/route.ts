/**
 * GET/DELETE /api/admin/emails/suppression — pilotage de la liste de suppression
 * (UX-COCKPIT-001).
 *
 * GET  ?q=&reason=&source=&limit=&offset= : liste paginée filtrable des adresses
 *      blocklistées (`{ rows, total, limit, offset }`).
 * DELETE { email } : retire UNE adresse de la suppression list (réinscription
 *      RGPD / faux positif bounce). Audit-loggé. Idempotent : `removed:false` si
 *      l'adresse n'était pas listée.
 *
 * Auth admin requise (comme les routes voisines), validation Zod, erreurs JSON
 * propres. DB indisponible (GET) → liste vide (200) plutôt que 500.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { db as getDb } from '@/lib/db/client';
import { listSuppression, removeSuppression } from '@/lib/mail/suppression';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE = '/api/admin/emails/suppression';

const SUPPRESSION_REASONS = [
  'hard_bounce',
  'soft_bounce_repeated',
  'complaint',
  'unsubscribe',
  'manual_admin',
  'cndp_request',
  'invalid_format',
] as const;

const SUPPRESSION_SOURCES = ['stalwart', 'listmonk', 'manual', 'cndp'] as const;

const ListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  reason: z.enum(SUPPRESSION_REASONS).optional(),
  source: z.enum(SUPPRESSION_SOURCES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const DeleteBodySchema = z.object({
  email: z.string().trim().min(3).max(320),
});

export async function GET(req: Request): Promise<Response> {
  await requireAdmin(ROUTE);

  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    reason: url.searchParams.get('reason') ?? undefined,
    source: url.searchParams.get('source') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // DB indisponible : on renvoie une liste vide plutôt qu'une 500.
  if (!getDb()) {
    return NextResponse.json({ rows: [], total: 0, limit: parsed.data.limit, offset: parsed.data.offset });
  }

  const { q, reason, source, limit, offset } = parsed.data;
  const { rows, total } = await listSuppression({ email: q, reason, source, limit, offset });
  return NextResponse.json({ rows, total, limit, offset });
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await requireAdmin(ROUTE);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = DeleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const removed = await removeSuppression(parsed.data.email);
    await logAuditEvent({
      action: 'mail.suppression.remove',
      actorId: session.email,
      meta: { email: parsed.data.email, removed },
    });
    logger.warn('admin.emails.suppression_remove', {
      actor: session.email,
      email: parsed.data.email,
      removed,
    });
    return NextResponse.json({ removed });
  } catch (err) {
    logger.error('admin.emails.suppression_remove_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
