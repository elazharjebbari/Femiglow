/**
 * CHA-303 — Routes admin FAQ : `PATCH` (mise à jour partielle, ré-embed
 * si `questionCanonical` change) et `DELETE` (suppression dure).
 *
 * Le PATCH accepte aussi un `POST` form-encoded pour permettre
 * `<form method="post">` sans JS (cf. patterns providers/instructions).
 * Le champ `_action` distingue : `toggle` bascule `enabled`, `delete`
 * supprime, sinon c'est un patch normal.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { faqRepo } from '@/lib/chat/repos/faq';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import {
  embedTexts,
  EmbeddingProviderUnavailableError,
} from '@/lib/chat/services/embeddings';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const row = await faqRepo.getById(params.id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const { questionEmbedding: _e, ...safe } = row;
  return NextResponse.json({ faq: safe });
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
  const ok = await faqRepo.deleteById(params.id);
  if (!ok) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  logger.info('chat.admin.faq.deleted', { id: params.id, by: auth.email });
  return NextResponse.json({ ok: true });
}

async function handlePatch(
  req: NextRequest,
  id: string,
  source: 'PATCH' | 'POST',
): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const existing = await faqRepo.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const ct = req.headers.get('content-type') ?? '';
  const payload = await parsePayload(req, ct);
  const action = typeof payload._action === 'string' ? payload._action : null;

  // --- action: toggle ---
  if (action === 'toggle') {
    const next = !existing.enabled;
    await faqRepo.update(id, { enabled: next });
    logger.info('chat.admin.faq.toggled', { id, enabled: next, by: auth.email });
    if (source === 'POST') {
      return NextResponse.redirect(
        new URL(`/admin/chat/faq?ok=${next ? 'enabled' : 'disabled'}`, req.url),
        303,
      );
    }
    return NextResponse.json({ id, enabled: next });
  }

  // --- action: delete ---
  if (action === 'delete') {
    const ok = await faqRepo.deleteById(id);
    if (!ok) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    logger.info('chat.admin.faq.deleted', { id, by: auth.email });
    if (source === 'POST') {
      return NextResponse.redirect(
        new URL('/admin/chat/faq?ok=deleted', req.url),
        303,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // --- patch normal ---
  const patch: Parameters<typeof faqRepo.update>[1] = {};
  if (typeof payload.key === 'string') patch.key = payload.key;
  if (
    payload.language === 'fr' ||
    payload.language === 'ar' ||
    payload.language === 'ar-MA'
  ) {
    patch.language = payload.language;
  }
  if (typeof payload.scriptedReply === 'string') {
    patch.scriptedReply = payload.scriptedReply;
  }
  if (typeof payload.intentHint === 'string') {
    patch.intentHint = payload.intentHint || null;
  }
  if (typeof payload.threshold === 'number') {
    if (payload.threshold < 0.3 || payload.threshold > 0.95) {
      return NextResponse.json({ error: 'threshold-out-of-range' }, { status: 400 });
    }
    patch.threshold = payload.threshold;
  }
  if (
    payload.audience === 'all' ||
    payload.audience === 'b2c' ||
    payload.audience === 'b2b'
  ) {
    patch.audience = payload.audience;
  }
  if (typeof payload.enabled === 'boolean') patch.enabled = payload.enabled;

  // Si la question canonique change, on doit ré-embed.
  if (
    typeof payload.questionCanonical === 'string' &&
    payload.questionCanonical !== existing.questionCanonical
  ) {
    try {
      const emb = await embedTexts([payload.questionCanonical]);
      patch.questionCanonical = payload.questionCanonical;
      patch.questionEmbedding = emb.vectors[0]!;
    } catch (err) {
      if (err instanceof EmbeddingProviderUnavailableError) {
        return NextResponse.json(
          { error: 'embedding-provider-unavailable' },
          { status: 503 },
        );
      }
      throw err;
    }
  }

  const updated = await faqRepo.update(id, patch);
  if (!updated) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  logger.info('chat.admin.faq.updated', { id, by: auth.email });

  if (source === 'POST') {
    return NextResponse.redirect(
      new URL('/admin/chat/faq?ok=updated', req.url),
      303,
    );
  }
  const { questionEmbedding: _e, ...safe } = updated;
  return NextResponse.json({ faq: safe });
}

async function parsePayload(req: NextRequest, ct: string): Promise<Record<string, unknown>> {
  if (ct.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (k === 'threshold') out[k] = Number(v);
    else if (k === 'enabled') out[k] = v === 'true' || v === 'on';
    else if (v === '') continue;
    else out[k] = v;
  }
  return out;
}
