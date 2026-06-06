/**
 * GET /api/admin/emails/nav-counters — compteurs des badges d'onglets (F02).
 *
 * Contrat : `navCountersSchema` (lib/mail/wire-schemas.ts) — le handler MSW et
 * le test de conformité parsent la MÊME forme.
 *
 * Compteurs :
 *   - dlq                : emails outbox en statut 'dlq' ;
 *   - automationErrors   : runs d'automation en statut 'errored' (définition
 *     alignée sur l'alerte de la liste automations) ;
 *   - listmonkSyncFailed : 0 tant que F10 n'a pas livré les colonnes
 *     last_sync_* sur email_campaign_link (branché au chantier P5.2).
 *
 * Cache : `unstable_cache` avec revalidate **30 s EXPLICITE** (gotcha
 * i18n-bindings : sans TTL la valeur est figée indéfiniment — interdit) +
 * tag 'emails-nav-counters' pour invalidation ciblée. Seul le CALCUL est
 * mémoïsé — l'auth est évaluée à CHAQUE requête.
 *
 * Auth : 401 JSON (pas le redirect HTML de requireAdmin — un endpoint de
 * badges consommé en fetch doit dégrader silencieusement côté client).
 */
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { count, eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox, emailAutomationRun } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function computeCountersRaw() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('db-not-configured');

  const [dlqRow] = await drizzle
    .select({ n: count() })
    .from(emailOutbox)
    .where(eq(emailOutbox.status, 'dlq'));
  const [erroredRow] = await drizzle
    .select({ n: count() })
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.status, 'errored'));

  return {
    dlq: dlqRow?.n ?? 0,
    automationErrors: erroredRow?.n ?? 0,
    // F10 (P5.2) branchera le COUNT sur email_campaign_link.last_sync_error.
    listmonkSyncFailed: 0,
    generatedAt: new Date().toISOString(),
  };
}

/** Calcul mémoïsé 30 s (les COUNT, pas l'auth). */
const computeCountersCached = unstable_cache(computeCountersRaw, ['emails-nav-counters'], {
  revalidate: 30,
  tags: ['emails-nav-counters'],
});

/**
 * Hors runtime Next (vitest, scripts), unstable_cache lève
 * « Invariant: incrementalCache missing » : on retombe alors sur le calcul
 * direct (sans cache) — le TTL n'est un contrat QUE servi par Next.
 */
async function computeCounters() {
  try {
    return await computeCountersCached();
  } catch (err) {
    if (err instanceof Error && err.message.includes('incrementalCache')) {
      return computeCountersRaw();
    }
    throw err;
  }
}

export async function GET(): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const counters = await computeCounters();
    return NextResponse.json(counters);
  } catch (err) {
    // 500 franc (jamais un 200 trompeur) — le client dégrade sans badge.
    logger.warn('emails.nav_counters.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'counters-unavailable' }, { status: 500 });
  }
}
