# 30.2 — Conversion pipeline design

## Vue d'ensemble

Pipeline complet du moment où l'utilisateur déclenche une conversion jusqu'à
son enregistrement dans `tracking_events_log` et son dispatch aux providers.

```
USER ACTION
   │
   ▼
Browser TrackingClient
  ├─ génère event_id (UUID v4)
  ├─ enrichit avec context (gclid, fbp, locale, ...)
  ├─ ajoute au batch local
  └─ flush à 1500ms OU 25 events
       │
       ▼
POST /api/track
{
  "events": [
    {
      "event_id": "uuid-v4",
      "name": "purchase",
      "received_at": "ISO",
      "params": { ... },
      "page": { url, route, ... },
      "consent": { ... }
    }
  ]
}
       │
       ▼
INGEST PIPELINE (route /api/track)
  ├─ 1. Rate-limit check (10 events/sec/IP)
  ├─ 2. Validate against event-catalog schema
  ├─ 3. Resolve isConversion (catalog + CONVERSION_EVENTS Set)
  ├─ 4. Resolve googleAdsCategory (override OR catalog default)
  ├─ 5. Build DispatchContext
  ├─ 6. dispatchToProviders(ctx) [parallel]
  ├─ 7. INSERT tracking_events_log (avec providers_results)
  └─ 8. 200 OK { received: N }
       │
       ▼
DISPATCHER (parallel for each enabled provider)
  ├─ Check consent permissions (ad_storage, analytics_storage)
  ├─ Call adapter.supports(eventName)
  ├─ Call adapter.dispatch(provider, ctx)
  ├─ Record dispatch result (status, latency, error)
  └─ Aggregate into providers_results JSONB
       │
       ▼
PROVIDERS
  ├─ Meta CAPI    → graph.facebook.com/v22.0/{pixel_id}/events
  ├─ GA4 MP       → google-analytics.com/mp/collect
  ├─ Google Ads   → googleads.googleapis.com/v17/customers/.../uploadClickConversions ✨
  ├─ TikTok       → business-api.tiktok.com/open_api/v1.3
  ├─ Snap         → tr.snapchat.com/v3/conversions
  ├─ Pinterest    → api.pinterest.com/v5/ad_accounts/.../conversion_events
  └─ GTM          → no-op (client-only)
       │
       ▼
LOG + AUDIT
  └─ tracking_events_log row INSERTED
        avec providers_dispatched, providers_results
```

## Étapes détaillées

### 1. Génération event_id

```typescript
// lib/tracking/client.ts (modifié)
emit(eventName: string, params: Record<string, unknown>): void {
  const event: DataLayerEntry = {
    event_id: crypto.randomUUID(), // ✨ NEW
    name: eventName,
    received_at: new Date().toISOString(),
    params,
    page: this.page(),
    user: this.user(),
    consent: this.consent(),
  };
  this.queue.push(event);
  this.scheduleFlush();
}
```

### 2. Validation + resolution

```typescript
// app/api/track/route.ts (modifié)
async function processEvent(event: DataLayerEntry, db: DB): Promise<EventCtx> {
  // 2.1 Validate against catalog
  const definition = await db.eventDefinitions.findByName(event.name);
  if (!definition) throw new Error('unknown_event');
  const parsed = definition.paramsSchema.safeParse(event.params);
  if (!parsed.success) throw new Error('invalid_params');

  // 2.2 isConversion : single source of truth = catalog
  const isConversion = definition.isConversion;

  // 2.3 Resolve google_ads_category
  const override = await db.eventOverrides.findByName(event.name);
  const googleAdsCategory = override?.googleAdsCategory
    ?? definition.googleAdsCategoryDefault
    ?? null;

  // 2.4 Build ctx
  return {
    eventId: event.event_id,
    eventName: event.name,
    isConversion,
    googleAdsCategory,
    params: parsed.data,
    page: event.page,
    user: event.user,
    consent: event.consent,
    receivedAt: new Date(event.received_at),
    gclid: extractGclid(event.page.url, event.user.gclidCookie),
  };
}
```

### 3. Dispatch parallèle

```typescript
async function dispatchToProviders(ctx: EventCtx): Promise<DispatchResults> {
  const providers = await db.providers.listEnabled();

  const dispatches = providers.map(async (provider) => {
    // Consent check
    if (!isAllowedByConsent(provider.kind, ctx.consent)) {
      return { kind: provider.kind, status: 'skipped', error: 'consent_denied' };
    }

    // Event allowlist
    if (!provider.enabledEvents.includes('*') &&
        !provider.enabledEvents.includes(ctx.eventName)) {
      return { kind: provider.kind, status: 'skipped', error: 'event_disabled' };
    }

    const adapter = getAdapter(provider.kind);
    if (!adapter || !adapter.supports(ctx.eventName)) {
      return { kind: provider.kind, status: 'skipped', error: 'unsupported' };
    }

    try {
      const result = await adapter.dispatch(provider, ctx);
      return { kind: provider.kind, ...result };
    } catch (err) {
      return {
        kind: provider.kind,
        status: 'failed',
        error: err.message.slice(0, 200),
        latencyMs: 0,
      };
    }
  });

  const results = await Promise.all(dispatches);
  return {
    providersDispatched: results.map((r) => r.kind),
    providersResults: Object.fromEntries(results.map((r) => [r.kind, r])),
  };
}
```

### 4. Logging

```typescript
await db.eventsLog.insert({
  id: createId('tel'),
  event_id: ctx.eventId,
  event_name: ctx.eventName,
  is_conversion: ctx.isConversion,
  received_at: ctx.receivedAt,
  // ... autres champs
  providers_dispatched: dispatchResults.providersDispatched,
  providers_results: dispatchResults.providersResults,
});
```

## Idempotence et déduplication

Côté serveur, on déduplique par `event_id` :

```typescript
// Avant INSERT :
const existing = await db.eventsLog.findByEventId(ctx.eventId);
if (existing) {
  return { status: 'duplicate', logId: existing.id };
}
```

Côté Google Ads, la déduplication est faite par Google via `orderId` (qu'on
remplit avec `event_id`).

Côté Meta, dédup via `event_id` (param Meta natif).

## Performance cible

- p50 `/api/track` : < 80ms
- p95 `/api/track` : < 200ms
- Parallélisation : tous les providers en `Promise.all`
- Timeout par provider : 2s max (kill et log si dépassé)

## Sécurité

- Rate-limit par IP : 10 events/sec
- Validation stricte schema (Zod sur tous les events)
- Pas de SQL injection (parameterized queries Drizzle)
- Logs sans PII (hash des emails côté lib)
