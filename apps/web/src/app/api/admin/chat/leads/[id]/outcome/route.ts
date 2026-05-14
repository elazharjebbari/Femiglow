/**
 * CHAT-066 — Mise à jour de l'outcome d'un lead chat depuis la console admin.
 *
 * Pourquoi
 * ────────
 * La page `/admin/chat/leads` permet de voir les leads pending mais
 * pas de cocher "rejoint", "converti" ou "discarded". Cet endpoint
 * encapsule la transition pour que Care puisse marquer le suivi sans
 * passer par la table ecommerce `lead` (autre tronc).
 *
 * Body
 * ────
 *   { outcome: 'pending' | 'reached' | 'no-answer' | 'converted' | 'discarded',
 *     convertedOrderId?: string }
 *
 * Sécurité : admin only. L'admin authentifié est enregistré dans
 * `handled_by` (audit trail).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { leadRepo } from '@/lib/chat/repos/lead';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const outcomeSchema = z.object({
  outcome: z.enum(['pending', 'reached', 'no-answer', 'converted', 'discarded']),
  convertedOrderId: z.string().min(1).max(64).optional(),
});

const LEAD_ID_REGEX = /^cl_[a-zA-Z0-9_-]+$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (!LEAD_ID_REGEX.test(params.id)) {
    return NextResponse.json({ error: 'invalid-lead-id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const parsed = outcomeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const before = await leadRepo.getById(params.id);
  if (!before) {
    return NextResponse.json({ error: 'lead-not-found' }, { status: 404 });
  }

  const updated = await leadRepo.setOutcome(
    params.id,
    parsed.data.outcome,
    auth.email,
    parsed.data.convertedOrderId,
  );
  if (!updated) {
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }

  logger.info('chat.admin.lead_outcome_changed', {
    leadId: params.id,
    from: before.outcome,
    to: parsed.data.outcome,
    adminEmail: auth.email,
    convertedOrderId: parsed.data.convertedOrderId ?? null,
  });
  return NextResponse.json({ ok: true, lead: updated });
}
