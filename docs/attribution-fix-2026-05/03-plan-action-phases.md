# 03 — Plan d'action par phase

| Phase | Sujet | Effort | Statut |
|---|---|---|---|
| A0 | Préparation : flag + docs + baseline | ½ j | 🟡 En cours |
| A1 | Taxonomie unifiée (`taxonomy.ts`) | ½ j | ⏳ |
| A2 | Acquisition middleware étendue | 1 j | ⏳ |
| A3 | `enrichEvent` server-side resolver | 1 j | ⏳ |
| A4 | `logEvent` étendu + `/api/track` | ½ j | ⏳ |
| A5 | Backfill data historique | ½ j | ⏳ |
| A6 | Reporting overview nettoyé | ½ j | ⏳ |
| A7 | Tests E2E end-to-end | 1 j | ⏳ |
| A8 | Rollout Canary → Ramp → Full | 7 j | 🛑 Gate humain |

## A0 — Préparation

- Dossier `docs/attribution-fix-2026-05/` créé (6 fichiers)
- Feature flag `ATTRIBUTION_V2` (`apps/web/src/lib/feature-flags/attribution.ts`)
- Git tag `attribution-baseline-2026-05-22`
- Baseline SQL exécuté

## A1 — Taxonomie unifiée

**Module unique** : `apps/web/src/lib/tracking/taxonomy.ts`

```ts
export const TRAFFIC_BUCKETS = [
  'direct', 'organic_search', 'paid_search',
  'organic_social', 'paid_social',
  'email', 'referral', 'affiliate',
  'display', 'video', 'sms', 'qr', 'internal', 'unknown',
] as const;

export type TrafficBucket = (typeof TRAFFIC_BUCKETS)[number];

export function classifyTraffic(input: {
  utm?: { source?: string; medium?: string; campaign?: string };
  clickIds?: { gclid?: string; fbclid?: string; ttclid?: string };
  referrer?: string;
}): TrafficClassification;

export const BUCKET_LABELS: Record<TrafficBucket, string>;
```

Migration consommateurs : `channel-detector.ts`, `analytics/attribution.ts`, `OverviewTopSources.tsx`.

## A2 — Middleware étendu

5 UTM + 8 click IDs + reconstruction `_fbc` + cookie `_fg_landing`.

## A3 — enrichEvent resolver

```ts
export async function enrichEvent(input: {
  anonymousId: string;
  clientHint?: { utm?: object; channel?: string };
  requestSignals: RequestSignals;
}): Promise<EnrichedEvent>;
```

Priorité merge : DB attribution > request signals > client hint.

## A4 — Persistence

`logEvent({ ...event, trafficSource, trafficMedium, utm, referrer, fbp, fbc })`

Intégré dans `/api/track` (derrière flag) et `server-fire`.

## A5 — Backfill

Script `scripts/backfill-traffic-source-v2.ts` :
- JOIN `visitor_attribution` par `anonymous_id`
- Apply strategy + classify
- UPDATE `tracking_events_log SET traffic_source WHERE traffic_source IS NULL`
- Idempotent + dry-run mode

## A6 — Reporting

`overview.ts` :
```ts
SELECT traffic_source, COUNT(*)
FROM tracking_events_log
WHERE event_name = 'page_view'
GROUP BY traffic_source
```

Plus de fallback `classifyTraffic`. UI affiche `BUCKET_LABELS[bucket]`.

## A7 — Tests E2E

5 scénarios Playwright `@attribution-flow` :
1. Meta paid (fbclid)
2. Google paid (gclid)
3. TikTok organic (referrer tiktok.com)
4. Email (utm_source=newsletter)
5. Direct (no signals)

+ 3 tests dégradation (consent denied, cookies bloqués, first hit).

## A8 — Rollout

Voir `05-runbook-rollout.md` — Canary 10% → Ramp 50% → Full 100% sur 7 j.
