/**
 * CHA-300 — Routes admin Suggestions (canned-pair) : `POST` (création) et
 * `GET` (liste).
 *
 * Une SuggestionPill = une `chat_canned_pair` page-aware avec ses 3
 * variantes linguistiques (label + scripted_reply x FR/AR/AR-MA). Pas
 * d'embedding ici — la cascade L2 matche par `key` exacte, pas par
 * similarité vectorielle.
 *
 * Form-encoded → redirect 303 vers la liste, JSON → JSON response.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { adminCannedPairInput } from '@/lib/chat/contracts';
import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const rows = await cannedPairRepo.listAll();
  return NextResponse.json({ suggestions: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const ct = req.headers.get('content-type') ?? '';
  const payload = await parsePayload(req, ct);
  const parsed = adminCannedPairInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const row = await cannedPairRepo.create({
    key: data.key,
    pagePattern: data.pagePattern,
    audience: data.audience,
    order: data.order,
    enabled: data.enabled,
    labelFr: data.labelFr,
    labelAr: data.labelAr,
    labelArMa: data.labelArMa,
    scriptedReplyFr: data.scriptedReplyFr,
    scriptedReplyAr: data.scriptedReplyAr,
    scriptedReplyArMa: data.scriptedReplyArMa,
    ctaLabel: data.ctaLabel ?? null,
    ctaUrl: data.ctaUrl ?? null,
    allowFollowupLlm: data.allowFollowupLlm,
    status: data.status,
  });

  logger.info('chat.admin.suggestion.created', {
    id: row.id,
    key: row.key,
    pagePattern: row.pagePattern,
    by: auth.email,
  });

  if (ct.includes('application/json')) {
    return NextResponse.json({ id: row.id, suggestion: row });
  }
  return NextResponse.redirect(
    new URL('/admin/chat/suggestions?ok=created', req.url),
    303,
  );
}

async function parsePayload(
  req: NextRequest,
  ct: string,
): Promise<Record<string, unknown>> {
  if (ct.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  const payload: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (k === 'order') {
      payload[k] = Number(v);
    } else if (k === 'enabled' || k === 'allowFollowupLlm') {
      payload[k] = v === 'true' || v === 'on';
    } else if (v === '') {
      continue;
    } else {
      payload[k] = v;
    }
  }
  if (payload.enabled === undefined) payload.enabled = false;
  if (payload.allowFollowupLlm === undefined) payload.allowFollowupLlm = false;
  return payload;
}
