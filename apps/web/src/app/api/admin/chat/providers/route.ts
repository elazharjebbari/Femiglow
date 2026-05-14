/**
 * CHA-115 — Routes admin: providers (POST = create, GET = list).
 *
 * Form-encoded ou JSON. Chiffre la clé API via `encryptSecret` puis
 * insère via `providerRepo.create`. Invalide `chat-config` pour que
 * l'orchestrateur recharge la liste des providers actifs.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { adminProviderInput } from '@/lib/chat/contracts';
import { providerRepo } from '@/lib/chat/repos/provider';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { redirectToPublic } from '@/lib/http/redirect-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  // listByRole expose seulement par rôle ; on s'appuie sur les queries admin.
  // Pour un GET simple on renvoie l'ensemble via une requête repo.
  const chat = await providerRepo.listByRole('chat', false);
  const embedding = await providerRepo.listByRole('embedding', false);
  const moderation = await providerRepo.listByRole('moderation', false);
  const rerank = await providerRepo.listByRole('rerank', false);
  const all = [...chat, ...embedding, ...moderation, ...rerank].map(
    ({ apiKeyEncrypted, apiKeyIv, ...rest }) => ({
      ...rest,
      hasApiKey: Boolean(apiKeyEncrypted),
    }),
  );
  return NextResponse.json({ providers: all });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> = {};
  if (ct.includes('application/json')) {
    payload = (await req.json()) as Record<string, unknown>;
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v !== 'string') continue;
      // Coercion form → schéma : checkbox/number conversion
      if (k === 'priority') {
        payload[k] = Number(v);
      } else if (k === 'enabled' || k === 'egressAllowed') {
        payload[k] = v === 'true' || v === 'on';
      } else if (k === 'quotaMonthlyEur' && v !== '') {
        payload[k] = Number(v);
      } else if (v === '') {
        // Skip empty optional strings
        continue;
      } else {
        payload[k] = v;
      }
    }
    // Checkboxes absentes du form = false
    if (payload.enabled === undefined) payload.enabled = false;
    if (payload.egressAllowed === undefined) payload.egressAllowed = false;
  }

  const parsed = adminProviderInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await providerRepo.create({
    kind: parsed.data.kind,
    label: parsed.data.label,
    role: parsed.data.role,
    priority: parsed.data.priority,
    enabled: parsed.data.enabled,
    apiKey: parsed.data.apiKey,
    apiBase: parsed.data.apiBase ?? null,
    chatModel: parsed.data.chatModel ?? null,
    embeddingModel: parsed.data.embeddingModel ?? null,
    parameters: parsed.data.parameters ?? null,
    quotaMonthlyEur: parsed.data.quotaMonthlyEur?.toString() ?? null,
    egressAllowed: parsed.data.egressAllowed,
  });

  revalidateTag('chat-config');
  logger.info('chat.admin.provider.created', {
    id: created.id,
    kind: created.kind,
    role: created.role,
    by: auth.email,
  });

  if (ct.includes('application/json')) {
    return NextResponse.json({ id: created.id });
  }
  return redirectToPublic(req, '/admin/chat/providers');
}
