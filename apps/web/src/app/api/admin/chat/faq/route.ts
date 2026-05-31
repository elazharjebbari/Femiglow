/**
 * CHA-303 — Routes admin FAQ : `POST` (création + embed) et `GET` (liste).
 *
 * Création :
 *   - Embed la `questionCanonical` via `embedTexts` (provider embedding actif).
 *   - UPSERT par (key, language) via `faqRepo.upsertEntry`.
 *   - Si l'embedding provider est indisponible (clé OpenAI absente), on
 *     répond 503 — pas de fallback silencieux sinon la cascade L3 serait
 *     cassée avec une entrée à vecteur zéro.
 *
 * Form-encoded → redirect 303 vers la liste, JSON → JSON response.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { adminFaqEntryInput } from '@/lib/chat/contracts';
import { faqRepo } from '@/lib/chat/repos/faq';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import {
  embedTexts,
  EmbeddingProviderUnavailableError,
} from '@/lib/chat/services/embeddings';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const rows = await faqRepo.listAll();
  return NextResponse.json({
    faqs: rows.map(({ questionEmbedding, ...rest }) => rest),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const ct = req.headers.get('content-type') ?? '';
  const payload = await parsePayload(req, ct);
  const parsed = adminFaqEntryInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  let embedding: number[];
  try {
    const emb = await embedTexts([data.questionCanonical]);
    embedding = emb.vectors[0]!;
  } catch (err) {
    if (err instanceof EmbeddingProviderUnavailableError) {
      return NextResponse.json(
        { error: 'embedding-provider-unavailable' },
        { status: 503 },
      );
    }
    logger.error('chat.admin.faq.embed_failed', { error: (err as Error).message });
    return NextResponse.json({ error: 'embed-failed' }, { status: 500 });
  }

  const result = await faqRepo.upsertEntry({
    key: data.key,
    language: data.language,
    questionCanonical: data.questionCanonical,
    questionEmbedding: embedding,
    scriptedReply: data.scriptedReply,
    intentHint: data.intentHint ?? null,
    threshold: data.threshold,
    audience: data.audience,
  });

  // Si le toggle `enabled=false` a été passé, on applique après l'upsert.
  if (data.enabled === false) {
    await faqRepo.update(result.id, { enabled: false });
  }

  logger.info('chat.admin.faq.upserted', {
    id: result.id,
    key: data.key,
    language: data.language,
    inserted: result.inserted,
    by: auth.email,
  });

  if (ct.includes('application/json')) {
    return NextResponse.json({ id: result.id, inserted: result.inserted });
  }
  const flash = result.inserted ? 'created' : 'updated';
  return NextResponse.redirect(
    new URL(`/admin/chat/faq?ok=${flash}`, req.url),
    303,
  );
}

async function parsePayload(req: NextRequest, ct: string): Promise<Record<string, unknown>> {
  if (ct.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  const payload: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (k === 'threshold') {
      payload[k] = Number(v);
    } else if (k === 'enabled') {
      payload[k] = v === 'true' || v === 'on';
    } else if (v === '') {
      continue;
    } else {
      payload[k] = v;
    }
  }
  if (payload.enabled === undefined) payload.enabled = false;
  return payload;
}
