/**
 * CHAT-065 / CHA-211 — Droit à l'oubli RGPD côté visiteur (self-service).
 *
 * Pourquoi
 * ────────
 * Le RGPD article 17 garantit le droit à l'effacement. Plutôt que d'obliger
 * le visiteur à écrire à un DPO, on expose un endpoint que le widget peut
 * appeler quand l'utilisateur clique "Oublier ma conversation". Une fois
 * traité :
 *   - les messages de la session sont supprimés (chat_message)
 *   - la session est marquée `purged`, visitor_id anonymisé,
 *     `fingerprint_hash`, `referrer`, `utm` et `meta_summary` effacés
 *     (cf. `sessionRepo.forget`).
 *
 * Sécurité
 * ────────
 * On vérifie que le cookie visitor du caller correspond au visitor_id
 * de la session. Sinon 403. Cela empêche un attaquant qui devinerait un
 * `cs_xxx` de purger les données d'un autre visiteur.
 *
 * Idempotence
 * ───────────
 * Si la session a déjà été purgée (status='purged'), on répond 200 avec
 * `alreadyPurged: true`. Pas d'effet de bord, pas d'erreur visible.
 *
 * cf. docs/dossier-chat-v2/02-data/rgpd.md (à venir)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { sessionRepo } from '@/lib/chat/repos/session';
import { sessionService } from '@/lib/chat/services/session-service';
import { getVisitorId } from '@/lib/chat/services/visitor-cookie';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const forgetInput = z.object({
  sessionId: z
    .string()
    .min(3)
    .max(64)
    .regex(/^cs_[a-zA-Z0-9_-]+$/),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new Response('Not Found', { status: 404 });
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const parsed = forgetInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const session = await sessionRepo.getById(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
  }

  // Idempotence : déjà purgée → on répond OK sans rejouer la purge.
  if (session.status === 'purged') {
    return NextResponse.json({ ok: true, alreadyPurged: true });
  }

  // Sécurité : le visitor cookie doit matcher le visitor_id de la session.
  const callerVisitorId = getVisitorId();
  if (callerVisitorId !== session.visitorId) {
    logger.warn('chat.session.forget_forbidden', {
      sessionId: session.id,
      callerVisitorId,
      sessionVisitorId: session.visitorId,
    });
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    await sessionService.forget(session.id);
  } catch (err) {
    logger.error('chat.session.forget_failed', {
      sessionId: session.id,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyPurged: false });
}
