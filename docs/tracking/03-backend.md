# 03 — Backend

## 1. Vue d'ensemble

Le backend tracking expose deux familles de routes :

- **Publiques** (sans auth, rate-limitées) :
  - `POST /api/track` — ingestion d'events (batch).
  - `POST /api/track/consent` — push d'un snapshot de consent.
- **Admin** (iron-session, audit) :
  - `GET /api/admin/tracking/inventory` — manifeste + diff
  - `*` `/api/admin/tracking/pages/*`
  - `*` `/api/admin/tracking/components/*`
  - `*` `/api/admin/tracking/event-definitions/*`
  - `*` `/api/admin/tracking/providers/*`
  - `GET /api/admin/tracking/events` — log timeline
  - `POST /api/admin/tracking/test` — dispatch dry-run

Plus un cron :

- `GET /api/cron/tracking-purge` — purge retention.
- `GET /api/cron/tracking-aggregate` — aggrégats KPI (snapshot quotidien).

## 2. Pattern queries (Drizzle dual-driver)

Tous les fichiers dans `src/lib/db/queries/tracking/*.ts`.

```ts
// src/lib/db/queries/tracking/components.ts
import { eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingComponent } from '@/lib/db/types';

export async function findComponentById(id: string): Promise<TrackingComponent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.trackingComponents)
      .where(eq(schema.trackingComponents.id, id)).limit(1);
    return rows[0] ?? null;
  }
  return memoryStore().trackingComponents.get(id) ?? null;
}

export async function listComponents(filter?: {
  category?: string;
  enabled?: boolean;
}): Promise<TrackingComponent[]> {
  const drizzle = db();
  if (drizzle) {
    let q = drizzle.select().from(schema.trackingComponents);
    if (filter?.category) q = q.where(eq(schema.trackingComponents.category, filter.category));
    if (filter?.enabled !== undefined) q = q.where(eq(schema.trackingComponents.enabled, filter.enabled));
    return await q;
  }
  const all = Array.from(memoryStore().trackingComponents.values());
  return all.filter(c =>
    (!filter?.category || c.category === filter.category) &&
    (filter?.enabled === undefined || c.enabled === filter.enabled),
  );
}

export async function upsertComponent(input: Omit<TrackingComponent, 'createdAt'|'updatedAt'> & { id?: string }): Promise<TrackingComponent> {
  const now = new Date();
  const id = input.id ?? createId('tc');
  const row: TrackingComponent = { ...input, id, createdAt: now, updatedAt: now };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingComponents).values(row)
      .onConflictDoUpdate({ target: schema.trackingComponents.id, set: { ...input, updatedAt: now } });
    return row;
  }
  memoryStore().trackingComponents.set(id, row);
  return row;
}
```

Mêmes fichiers pour `pages.ts`, `event-definitions.ts`,
`component-events.ts`, `providers.ts`, `events-log.ts`,
`consent-snapshots.ts`.

## 3. Services

### 3.1 Inventory scanner

`src/lib/tracking/inventory/scanner.ts`

Parse les fichiers `src/app/**/page.tsx` et
`src/components/**/*.tsx` (hors `.test.tsx`, `.stories.tsx`).
Extrait :

- nom du composant exporté (export default OU `export function X`).
- catégorie inférée (heuristique : suffixes `Card`, `Hero`, `Form`,
  `Button`, `List`, `Modal`, `Carousel`, `Grid`, `Section`, +
  marqueurs `data-track-category="xxx"` dans le JSX).
- composants utilisés par chaque page (parse `import` + usage JSX).

Sortie : manifeste JSON (`src/lib/tracking/inventory.generated.json`).

```ts
export async function scanInventory(rootDir: string): Promise<InventoryManifest> {
  const pages = await scanPages(rootDir);
  const components = await scanComponents(rootDir);
  const links = await resolvePageComponentLinks(pages, components);
  return { pages, components, links, generatedAt: new Date().toISOString() };
}
```

`scripts/scan-tracking-inventory.ts` appelle `scanInventory()` et
écrit le manifeste. Lancé en pre-build (`pnpm build` → script avant
`next build`).

### 3.2 Inventory diff

`src/lib/tracking/inventory/diff.ts`

Compare manifeste vs BDD (`tracking_pages` + `tracking_components`).
Retourne :

```ts
type InventoryDiff = {
  pagesAdded: TrackingPage[];
  pagesRemoved: string[];
  componentsAdded: TrackingComponent[];
  componentsRemoved: string[];
  componentsRecategorized: { id: string; from: string; to: string }[];
};
```

Utilisé par la console admin (badge "5 nouveaux composants
détectés"), et par CI (échec si drift sans approbation).

### 3.3 Event validator

`src/lib/tracking/validator.ts`

Convertit les `paramsSchema` JSON Schema des `tracking_event_definitions`
en schéma Zod runtime (cache LRU).

```ts
export function getValidator(eventName: string): ZodSchema {
  const cached = validatorCache.get(eventName);
  if (cached) return cached;
  const def = eventDefinitionsByName.get(eventName);
  if (!def) throw new Error(`Unknown event: ${eventName}`);
  const schema = jsonSchemaToZod(def.paramsSchema);
  validatorCache.set(eventName, schema);
  return schema;
}
```

### 3.4 Enricher

`src/lib/tracking/enricher.ts`

```ts
export function enrich(event: TrackingEventInput, req: Request): EnrichedEvent {
  const ip = getClientIp(req);
  const ipAnonymized = anonymizeIp(ip); // dernier octet à 0 (IPv4) / /64 (IPv6)
  const ua = req.headers.get('user-agent') ?? '';
  const uaHash = sha256(ua).slice(0, 16);
  const country = req.headers.get('cf-ipcountry') ?? null;
  const device = parseDevice(ua);
  return { ...event, context: { ...event.context, ipAnonymized, uaHash, country, device } };
}
```

### 3.5 Dedup queue

`src/lib/tracking/dedup.ts`

Cache server-side (Redis-like en mémoire process, sufficient pour
single-region Vercel) :

```ts
const seen = new LRU<string, true>({ max: 50_000, ttl: 60_000 });
export function dedupServer(event_id: string): boolean {
  if (seen.has(event_id)) return true;
  seen.set(event_id, true);
  return false;
}
```

L'INSERT BDD a `ON CONFLICT (event_id) DO NOTHING` comme garde-fou.

### 3.6 Provider dispatcher

`src/lib/tracking/providers/dispatcher.ts`

```ts
export async function dispatch(
  event: EnrichedEvent,
  providers: TrackingProvider[],
): Promise<Record<string, ProviderResult>> {
  const tasks = providers.map(p => dispatchOne(event, p));
  const results = await Promise.allSettled(tasks);
  // … record results, increment errorCount24h, lastEventAt
}
```

Un fichier par provider :

- `providers/meta.ts` (Conversions API)
- `providers/tiktok.ts` (Events API)
- `providers/google.ts` (Measurement Protocol GA4)
- `providers/snap.ts` (Snap CAPI)
- `providers/pinterest.ts` (Pinterest CAPI)

Chaque provider expose :

```ts
export interface ProviderAdapter {
  kind: TrackingProviderKind;
  mapEvent(event: EnrichedEvent): unknown;
  dispatch(payload: unknown, config: ProviderConfig): Promise<ProviderResult>;
}
```

Mapping de noms : tableau dans
`src/lib/tracking/providers/event-mapping.ts` :

```ts
export const META_EVENT_MAP: Record<string, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  view_promotion: 'ViewContent',
  fg_journal_read_75: 'ViewContent',
  // …
};
```

### 3.7 Persistence (events-log)

Le write BDD est synchrone (one row, ~1 ms). Pas de queue async pour
v1. Si volume > 100 events/s en prod, passer à Vercel Postgres
**Edge** + buffered writes ou Inngest queue.

### 3.8 Audit

Toute mutation admin → `logAuditEvent(action, actorId, meta)` :

- `tracking.component.update`
- `tracking.provider.enable`
- `tracking.provider.update_pixel_id`
- `tracking.event_def.create` (rare, en seed)
- `tracking.purge.run`

## 4. Routes API

### 4.1 `POST /api/track`

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ingestSchema = z.object({
  events: z.array(trackingEventSchema).min(1).max(50),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit({ key: `track:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rate.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const body = await req.json().catch(() => null);
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

    const events = parsed.data.events;
    const accepted: string[] = [];
    const skipped: string[] = [];

    for (const evt of events) {
      // 1. validate event params against definition
      const def = await findEventDefinitionByName(evt.event);
      if (!def) { skipped.push(evt.event_id); continue; }
      const params = getValidator(evt.event).safeParse(evt.payload);
      if (!params.success) { skipped.push(evt.event_id); continue; }

      // 2. dedup
      if (dedupServer(evt.event_id)) { skipped.push(evt.event_id); continue; }

      // 3. enrich + persist
      const enriched = enrich(evt, req);
      await logEvent(enriched);
      accepted.push(evt.event_id);

      // 4. dispatch CAPI providers (server scope)
      if (def.scope === 'server' || def.scope === 'both') {
        const providers = await getEnabledServerProviders(evt);
        // fire-and-forget (waitUntil pour Vercel Edge)
        ctx.waitUntil(dispatch(enriched, providers));
      }
    }

    return NextResponse.json({ accepted, skipped }, { status: 202 });
  } catch (err) {
    logger.error('track.ingest.error', { error: String(err) });
    return new Response(null, { status: 500 });
  }
}
```

### 4.2 `POST /api/track/consent`

Idempotent. Retourne `{ snapshotId }`.

### 4.3 Admin routes

Toutes wrappées par `requireAdminSession()` (existant). Pattern :

```ts
// src/app/api/admin/tracking/components/[id]/route.ts
export async function GET(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const session = await requireAdminSession();
  const c = await findComponentById(ctx.params.id);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const events = await listComponentEvents(c.id);
  return NextResponse.json({ component: c, events });
}

export async function PATCH(req: Request, ctx): Promise<Response> {
  const session = await requireAdminSession();
  const body = await req.json();
  const parsed = componentUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const updated = await upsertComponent({ id: ctx.params.id, ...parsed.data });
  await logAuditEvent({ action: 'tracking.component.update', actorId: session.userId, resourceType: 'tracking_component', resourceId: ctx.params.id, meta: parsed.data });
  return NextResponse.json({ component: updated });
}
```

### 4.4 `POST /api/admin/tracking/test`

Mode dry-run :

```ts
const testSchema = z.object({
  providerId: z.string(),
  event: trackingEventSchema,
  dryRun: z.boolean().default(true),
});
```

Si `dryRun=true`, on appelle `mapEvent` mais pas `dispatch`. Retourne
le payload qui aurait été envoyé. Utile pour debug pixel sans polluer
le compte Meta/TikTok.

Si `dryRun=false`, on dispatch réellement avec `testEventCode`
(`test_event_code` Meta = events visibles uniquement dans le tableau
"Test events" du Business Manager).

## 5. Cron

### 5.1 Purge

`/api/cron/tracking-purge` — auth Bearer `CRON_SECRET`.

```ts
const cutoffEvents = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000);
await drizzle.delete(schema.trackingEventsLog).where(lt(schema.trackingEventsLog.receivedAt, cutoffEvents));
const cutoffConsent = new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000);
await drizzle.delete(schema.trackingConsentSnapshots).where(lt(schema.trackingConsentSnapshots.createdAt, cutoffConsent));
await logAuditEvent({ action: 'tracking.purge.run', actorId: null, meta: { eventsCutoff: cutoffEvents.toISOString() } });
return NextResponse.json({ ok: true });
```

### 5.2 Aggregate

Optionnel (Phase 7). Pré-calcule des snapshots quotidiens dans
`tracking_kpi_daily` pour accélérer les dashboards admin.

## 6. Logger

Étend `src/lib/logging/logger.ts` avec namespace `tracking.*` :

- `tracking.ingest.accepted`
- `tracking.ingest.skipped`
- `tracking.dispatch.error`
- `tracking.provider.enabled`

Niveaux : `info` pour le hot path, `warn` pour erreurs récupérables,
`error` pour les erreurs critiques (pertes de data).

## 7. Sécurité

- **CSP** : whitelister explicitement chaque pixel dans
  `src/middleware.ts` :
  - `connect.facebook.net`, `www.facebook.com` (Meta)
  - `analytics.tiktok.com`, `business-api.tiktok.com` (TikTok)
  - `www.googletagmanager.com`, `www.google-analytics.com` (GTM/GA4)
  - `sc-static.net`, `tr.snapchat.com` (Snap)
  - `s.pinimg.com`, `ct.pinterest.com` (Pinterest)
- **Code custom** admin : injecté via `<Script id="…">` avec nonce CSP.
  Validé en input contre une regex stricte (pas de `<iframe>`,
  `eval(`, `Function(`).
- **Tokens CAPI** : chiffrés AES-256-GCM via la même primitive que
  les webhooks (réutilisation `src/lib/webhooks/secrets.ts`).
- **Rate-limit** ingestion : 60 req/min/IP, bypass admin via header
  `X-Admin-Bypass` (jamais en prod).

## 8. Testing hooks

Le backend expose des helpers internes :

- `src/lib/tracking/test-helpers.ts` :
  - `__resetDedup()` (vitest only)
  - `__getPersistedEvents()` (memory store, Vitest)
  - `__mockProvider(kind, response)` (MSW handle au niveau adapter).

Détails dans [09-tests.md](09-tests.md).
