/**
 * CHA-300 — Routes admin Suggestions item : `PATCH`/`POST` (mise à jour
 * partielle + actions toggle/delete) et `DELETE`.
 *
 * `_action=toggle` bascule `enabled`, `_action=delete` supprime ;
 * sinon patch normal. Le `status` n'est pas toggleable (4 valeurs) — on
 * passe par le form normal pour `draft → published`.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const row = await cannedPairRepo.getById(params.id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ suggestion: row });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handlePatch(req, params.id, 'PATCH');
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  return handlePatch(req, params.id, 'POST');
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const ok = await cannedPairRepo.deleteById(params.id);
  if (!ok) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  logger.info('chat.admin.suggestion.deleted', { id: params.id, by: auth.email });
  return NextResponse.json({ ok: true });
}

async function handlePatch(
  req: NextRequest,
  id: string,
  source: 'PATCH' | 'POST',
): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const existing = await cannedPairRepo.getById(id);
  if (!existing) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const ct = req.headers.get('content-type') ?? '';
  const payload = await parsePayload(req, ct);
  const action = typeof payload._action === 'string' ? payload._action : null;

  // --- action: toggle enabled ---
  if (action === 'toggle') {
    const next = !existing.enabled;
    await cannedPairRepo.update(id, { enabled: next });
    logger.info('chat.admin.suggestion.toggled', { id, enabled: next, by: auth.email });
    if (source === 'POST') {
      return NextResponse.redirect(
        new URL(`/admin/chat/suggestions?ok=${next ? 'enabled' : 'disabled'}`, req.url),
        303,
      );
    }
    return NextResponse.json({ id, enabled: next });
  }

  // --- action: publish ---
  if (action === 'publish') {
    await cannedPairRepo.update(id, { status: 'published' });
    logger.info('chat.admin.suggestion.published', { id, by: auth.email });
    if (source === 'POST') {
      return NextResponse.redirect(
        new URL('/admin/chat/suggestions?ok=published', req.url),
        303,
      );
    }
    return NextResponse.json({ id, status: 'published' });
  }

  // --- action: delete ---
  if (action === 'delete') {
    const ok = await cannedPairRepo.deleteById(id);
    if (!ok) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    logger.info('chat.admin.suggestion.deleted', { id, by: auth.email });
    if (source === 'POST') {
      return NextResponse.redirect(
        new URL('/admin/chat/suggestions?ok=deleted', req.url),
        303,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // --- patch normal ---
  const patch: Parameters<typeof cannedPairRepo.update>[1] = {};
  if (typeof payload.key === 'string') patch.key = payload.key;
  if (typeof payload.pagePattern === 'string') patch.pagePattern = payload.pagePattern;
  if (
    payload.audience === 'all' ||
    payload.audience === 'b2c' ||
    payload.audience === 'b2b'
  ) {
    patch.audience = payload.audience;
  }
  if (typeof payload.order === 'number' && Number.isFinite(payload.order)) {
    patch.order = Math.trunc(payload.order);
  }
  if (typeof payload.enabled === 'boolean') patch.enabled = payload.enabled;
  if (typeof payload.labelFr === 'string') patch.labelFr = payload.labelFr;
  if (typeof payload.labelAr === 'string') patch.labelAr = payload.labelAr;
  if (typeof payload.labelArMa === 'string') patch.labelArMa = payload.labelArMa;
  if (typeof payload.scriptedReplyFr === 'string') patch.scriptedReplyFr = payload.scriptedReplyFr;
  if (typeof payload.scriptedReplyAr === 'string') patch.scriptedReplyAr = payload.scriptedReplyAr;
  if (typeof payload.scriptedReplyArMa === 'string') patch.scriptedReplyArMa = payload.scriptedReplyArMa;
  if (typeof payload.ctaLabel === 'string') patch.ctaLabel = payload.ctaLabel || null;
  if (typeof payload.ctaUrl === 'string') patch.ctaUrl = payload.ctaUrl || null;
  if (typeof payload.allowFollowupLlm === 'boolean') {
    patch.allowFollowupLlm = payload.allowFollowupLlm;
  }
  if (
    payload.status === 'draft' ||
    payload.status === 'review' ||
    payload.status === 'published' ||
    payload.status === 'archived'
  ) {
    patch.status = payload.status;
  }

  const updated = await cannedPairRepo.update(id, patch);
  if (!updated) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  logger.info('chat.admin.suggestion.updated', { id, by: auth.email });

  if (source === 'POST') {
    return NextResponse.redirect(
      new URL('/admin/chat/suggestions?ok=updated', req.url),
      303,
    );
  }
  return NextResponse.json({ suggestion: updated });
}

async function parsePayload(
  req: NextRequest,
  ct: string,
): Promise<Record<string, unknown>> {
  if (ct.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (k === 'order') out[k] = Number(v);
    else if (k === 'enabled' || k === 'allowFollowupLlm') {
      out[k] = v === 'true' || v === 'on';
    } else if (v === '') continue;
    else out[k] = v;
  }
  // Ces booleens doivent rester explicitement passés depuis le formulaire si on
  // veut les baisser : on les laisse non-mis si absents.
  return out;
}
