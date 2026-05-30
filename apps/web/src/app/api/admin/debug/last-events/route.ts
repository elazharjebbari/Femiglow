/**
 * Endpoint debug — derniers events tracking avec leurs champs attribution.
 *
 * Réservé admin authentifié uniquement. Permet :
 *  - Aux Playwright `@attribution-flow` de vérifier que `trafficSource` est
 *    bien persisté après un fire client → /api/track.
 *  - Au support / debug manuel d'inspecter rapidement une session récente.
 *
 * NB : pas de tri par anonymousId / sessionId pour rester simple. Filtres
 * via query params si besoin futur.
 *
 * Référence : `docs/attribution-fix-2026-05/04-tests-strategy.md`.
 */
import { NextResponse } from 'next/server';
import { listEvents } from '@/lib/db/queries/tracking/events-log';
import { getAdminSession } from '@/lib/auth/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  // Auth gating — admin only. Refus si non-auth.
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Admin authentification requise' },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get('limit');
  const sessionId = url.searchParams.get('sessionId') ?? undefined;
  const anonymousId = url.searchParams.get('anonymousId') ?? undefined;
  const eventName = url.searchParams.get('eventName') ?? undefined;
  const limit = Math.min(50, Math.max(1, parseInt(limitRaw ?? '10', 10) || 10));

  const events = await listEvents({
    limit,
    sessionId,
    anonymousId,
    eventName,
  });

  // Projection : on expose tout sauf l'IP/UA pour éviter la fuite de PII
  // dans les logs d'inspection. Les champs attribution sont en première
  // position pour faciliter le debug.
  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      eventName: e.eventName,
      pageRoute: e.pageRoute,
      // ── Champs attribution (sujet du fix) ───────────────────────
      trafficSource: e.trafficSource,
      trafficMedium: e.trafficMedium,
      // ── Contexte ────────────────────────────────────────────────
      anonymousId: e.anonymousId,
      sessionId: e.sessionId,
      receivedAt: e.receivedAt.toISOString(),
      isConversion: e.isConversion,
      consentSnapshot: e.consentSnapshot,
      device: e.device,
      // ── Payload pour audit complet ──────────────────────────────
      payload: e.payload,
    })),
  );
}
