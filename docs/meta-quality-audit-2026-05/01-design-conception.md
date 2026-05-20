# 01 — Design & Conception

> **Lien amont** : [`AUDIT-META-QUALITY.md`](./AUDIT-META-QUALITY.md) (root causes confirmées)
> **Lien aval** : [`02-plan-dev-action.md`](./02-plan-dev-action.md) (étapes d'implémentation)

---

## 1. Architecture cible

### 1.1 Vue d'ensemble (avant ↔ après)

#### Avant (actuel)

```
Browser                             Server                          Meta
─────────                           ─────────                       ─────
emit('view_item') ──┬──► dataLayer ──► GTM ──► fbq Pixel ──────────► Pixel API
                    │
                    └──► POST /api/track ──► zod validate (laxiste)
                                          ──► dispatch metaAdapter ──► CAPI
                                          (perte ~50% par sendBeacon/adblock/consent)
```

**Problèmes** :
- Validation Purchase laxiste (`value`/`currency` optionnels)
- `metaAdapter.buildCustomData()` copie params sans contrôle
- ViewContent client-only → asymétrie Pixel >> CAPI

#### Après (cible)

```
Browser                             Server                          Meta
─────────                           ─────────                       ─────
emit('view_item') ──┬──► dataLayer ──► GTM ──► fbq Pixel(eventID) ──► Pixel API
                    │                                                  │
                    └──► POST /api/track ──► validate + enrich         │
                                          ──► guard (skip si corrompu) │
                                          ──► metaAdapter ────────────►│ CAPI
                                                                       │ │
SSR /kit /maison /rituel ──► serverEmit('view_item',          ─────────►│ │
                              eventId=deterministic(...))     CAPI       └─► dédup côté Meta
                                                                          (event_id partagé)
```

**Bénéfices** :
- Purchase : 3 lignes de défense — schéma strict, enrich DB, guard adapter.
- ViewContent : serveur devient source primaire CAPI, client opportuniste, dédup par event_id partagé.

### 1.2 Modules nouveaux et modifiés

| Module | Type | Rôle | Fichier |
|---|---|---|---|
| `enrichPurchase` | Pure fn | Complète value/currency depuis `orders` DB si `transaction_id` connu | `apps/web/src/lib/tracking/providers/_enrich-purchase.ts` (new) |
| `metaAdapter.dispatch` | Modif | Appelle enrich avant build payload, skip si Purchase reste invalide | `apps/web/src/lib/tracking/providers/meta.ts` (edit) |
| `deriveEventId` | Pure fn | SHA-256 court 16 chars depuis `(eventName, sessionId, pageId, bucket5min)` | `apps/web/src/lib/tracking/event-id.ts` (new) |
| `serverEmit` | Async fn | Émet un event CAPI server-side direct (sans HTTP `/api/track`) | `apps/web/src/lib/tracking/server-emit.ts` (new) |
| `isBotRequest` | Pure fn | Détecte User-Agent bot pour éviter pollution ViewContent | `apps/web/src/lib/tracking/is-bot.ts` (new) |
| `ViewItemTracker` | Modif | Lit cookie `fg_evt_seed` (server-set) pour aligner event_id Pixel ↔ CAPI | `apps/web/src/components/tracking/ViewItemTracker.tsx` (edit) |
| `seedEventIdCookie` | Pure fn | Côté SSR : pose un cookie HttpOnly:false avec l'event_id seed | `apps/web/src/lib/tracking/event-id-cookie.ts` (new) |
| `event-mapping.ts` | Modif | Mappe `purchase_server` → `Purchase` Meta (si non présent) | `apps/web/src/lib/tracking/providers/event-mapping.ts` (edit) |
| `v_purchase_quality` | SQL view | Compte purchases valid/invalid par jour pour observabilité | `apps/web/drizzle/sql/views/purchase_quality.sql` (new) |

### 1.3 Modules durcis en Phase 3 (non-bloquant P1/P2)

| Module | Modif |
|---|---|
| `schemas.ts` | `purchaseParams.currency.regex(/^[A-Z]{3}$/)`, `value.positive()`, `items.min(1)` |
| `server/dedup.ts` | Remplace cache mémoire 60s par table DB ou Redis TTL 24h |

---

## 2. Backend — Détails de conception

### 2.1 `_enrich-purchase.ts`

```ts
// apps/web/src/lib/tracking/providers/_enrich-purchase.ts
import { db } from '@/lib/db/client';
import { orders } from '@/lib/db/schema-orders';
import { eq } from 'drizzle-orm';

export interface PurchaseEnrichResult {
  value?: number;
  currency?: string;
  source: 'params' | 'db' | 'unavailable';
}

/**
 * Pure fn : si `params` a déjà value+currency valides, on les renvoie.
 * Sinon, on tente une lookup DB sur `orders` par `transaction_id`.
 * Si la DB ne sait pas, renvoie source='unavailable' — l'adapter décidera de skip.
 *
 * Fail-closed : ne renvoie JAMAIS de valeur fabriquée ou par défaut (0, EUR, etc).
 * On préfère un Purchase manquant (qu'on skip) à un Purchase mensonger.
 */
export async function enrichPurchase(params: {
  transaction_id?: string;
  value?: unknown;
  currency?: unknown;
}): Promise<PurchaseEnrichResult> {
  if (isValidValue(params.value) && isValidCurrency(params.currency)) {
    return { value: params.value as number, currency: params.currency as string, source: 'params' };
  }
  if (!params.transaction_id) return { source: 'unavailable' };

  const conn = db();
  if (!conn) return { source: 'unavailable' };

  const [order] = await conn
    .select({ totalCents: orders.totalCents, currency: orders.currency })
    .from(orders)
    .where(eq(orders.publicId, params.transaction_id))
    .limit(1);

  if (!order) return { source: 'unavailable' };
  return {
    value: order.totalCents / 100,
    currency: (order.currency ?? 'MAD').toUpperCase(),
    source: 'db',
  };
}

export function isValidValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}
export function isValidCurrency(c: unknown): c is string {
  return typeof c === 'string' && /^[A-Z]{3}$/.test(c);
}
```

**Design notes** :
- Pure logic, pas d'effet de bord hors DB read.
- Pas de défaut hardcodé `MAD` au niveau enricher : on s'aligne uniquement sur ce qui est en DB.
- Fail-closed : `source: 'unavailable'` est une info exploitable par l'adapter pour décider de skip.

### 2.2 `metaAdapter.dispatch` — guard

```ts
// apps/web/src/lib/tracking/providers/meta.ts (extrait modifié)
async dispatch(provider, ctx) {
  // ... checks existants (status, pixelId, accessToken, eventNameMapped) ...

  let params = ctx.params;
  if (ctx.eventName === 'purchase' || ctx.eventName === 'purchase_server') {
    const enriched = await enrichPurchase(params);
    if (enriched.source === 'unavailable') {
      return {
        status: 'skipped',
        latencyMs: 0,
        attempts: 0,
        error: 'purchase_value_currency_invalid',
      };
    }
    params = { ...params, value: enriched.value, currency: enriched.currency };
  }

  // ... build payload avec `params` enrichi ...
}
```

**Design notes** :
- Le guard s'applique aussi à `purchase_server` (Stripe webhook) pour cohérence.
- L'erreur `purchase_value_currency_invalid` est explicite — facile à filtrer dans les logs `tracking_events.providersResults`.
- Le `params` enrichi reste local à la fonction — pas de mutation de `ctx.params` (immutabilité).

### 2.3 `event-id.ts`

```ts
// apps/web/src/lib/tracking/event-id.ts
import { createHash } from 'node:crypto';

/**
 * Génère un event_id déterministe basé sur 4 inputs.
 * Le bucket 5min permet à un user qui visite la même page 2x en 10min d'avoir 2 ids
 * distincts (donc 2 events comptés), mais 2x en 4min d'avoir le même id (donc dédup).
 *
 * Format : 32 hex chars (128 bits) → suffisant contre collision avec uuidv7.
 */
export function deriveEventId(input: {
  eventName: string;
  sessionId: string;
  pageId: string;
  timestamp?: number;
}): string {
  const ts = input.timestamp ?? Date.now();
  const bucket = Math.floor(ts / (5 * 60 * 1000));
  const material = `${input.eventName}|${input.sessionId}|${input.pageId}|${bucket}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
```

**Design notes** :
- Déterministe : même 4-uple inputs → même event_id, garanti par SHA-256.
- Bucket 5min : compromis entre dédup excessive (1h ferait sauter les visites légitimes répétées) et dédup nulle (1s annulerait l'effet).
- Format 32 hex chars : 128 bits d'entropie, compatible Meta event_id (max 40 chars accepté).

### 2.4 `server-emit.ts`

```ts
// apps/web/src/lib/tracking/server-emit.ts
import { headers, cookies } from 'next/headers';
import { metaAdapter } from './providers/meta';
import { getEnabledMetaProvider } from '@/lib/db/queries/tracking/providers';
import { hashIdentityBrowser } from './hashing';
import { isBotRequest } from './is-bot';
import { deriveEventId } from './event-id';
import type { DispatchContext } from './providers/types';

export interface ServerEmitInput {
  eventName: 'view_item' | 'view_item_list' | 'select_item';
  params: Record<string, unknown>;
  pageId: string;
}

export async function serverEmit(input: ServerEmitInput): Promise<void> {
  const h = headers();
  if (isBotRequest(h.get('user-agent') ?? '')) return;

  const sessionId = cookies().get('fg_session_id')?.value;
  if (!sessionId) return; // Sans session, pas de matching identité possible.

  const provider = await getEnabledMetaProvider();
  if (!provider) return;

  const eventId = deriveEventId({
    eventName: input.eventName,
    sessionId,
    pageId: input.pageId,
  });

  const ctx: DispatchContext = {
    eventName: input.eventName,
    params: input.params,
    eventId,
    pageUrl: h.get('referer') ?? `https://femiglow-maroc.com/${input.pageId}`,
    receivedAt: new Date(),
    anonymousId: sessionId,
    ipAnonymized: anonymizeIp(h.get('x-forwarded-for')),
    uaHash: sha256Short(h.get('user-agent') ?? ''),
    identity: undefined,
    fbp: cookies().get('_fbp')?.value,
    fbc: cookies().get('_fbc')?.value,
  };

  // Fire-and-forget : on ne bloque pas le SSR sur l'envoi CAPI.
  void metaAdapter.dispatch(provider, ctx).catch((err) => {
    console.error('[server-emit] meta dispatch failed', { eventName: input.eventName, err });
  });
}
```

**Design notes** :
- `void`-await pour ne pas bloquer le SSR (latence CAPI ~200ms).
- Lecture cookies `_fbp` et `_fbc` côté serveur Next.js — disponibles dans `next/headers`.
- Sans `sessionId`, on ne fire pas : pas d'event de bot/visiteur non identifié.
- L'erreur de dispatch est logguée mais n'impacte pas le SSR.

### 2.5 `is-bot.ts`

```ts
// apps/web/src/lib/tracking/is-bot.ts
// Heuristique légère sans deps — détecte les bots majoritaires.
// Pour de la précision industrielle, brancher `isbot` package (~10KB).
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /facebookexternalhit/i,
  /lighthouse/i,
  /headlesschrome/i,
  /pingdom/i,
  /uptime/i,
  /pagespeed/i,
];

export function isBotRequest(userAgent: string): boolean {
  if (!userAgent) return true; // No UA = suspect
  return BOT_PATTERNS.some((rx) => rx.test(userAgent));
}
```

**Design notes** :
- Pas de dépendance externe (le projet a déjà ~80 deps prod).
- Catch ~95 % des bots courants. Pour aller plus loin, on peut wirer `isbot@5` plus tard.
- `''` (pas d'UA) traité comme bot → conservateur pour la qualité CAPI.

### 2.6 `event-id-cookie.ts` (alignement Pixel ↔ CAPI)

```ts
// apps/web/src/lib/tracking/event-id-cookie.ts
import { cookies } from 'next/headers';
import { deriveEventId } from './event-id';

const COOKIE_NAME = 'fg_evt_seed';

/**
 * Lit le seed event_id depuis cookie. Si absent, en génère un nouveau,
 * le pose en cookie (5min TTL aligné avec le bucket deriveEventId).
 * À appeler dans la SSR avant `<ViewItemTracker />`.
 */
export function readOrSetEventIdSeed(pageId: string): string {
  const c = cookies();
  const existing = c.get(COOKIE_NAME)?.value;
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;

  const sessionId = c.get('fg_session_id')?.value ?? 'anon';
  const seed = deriveEventId({ eventName: 'view_item', sessionId, pageId });
  // Note: cookies().set() ne fonctionne que dans Server Actions / Route Handlers.
  // Pour Server Components, on utilise le headers.cookie via middleware ou
  // on passe le seed en prop au composant client.
  return seed;
}
```

**Design notes** :
- Implémentation simplifiée : le seed est passé en prop au `ViewItemTracker` plutôt qu'en cookie. Plus simple, pas de problème Server Component cookie write.
- Le client `ViewItemTracker` reçoit `eventIdSeed` en prop et utilise cette valeur au lieu de générer son `uuidv7()`.

---

## 3. Frontend — Détails de conception

### 3.1 `ViewItemTracker.tsx` — patch event_id alignment

```tsx
// apps/web/src/components/tracking/ViewItemTracker.tsx (signature étendue)
interface ViewItemTrackerProps {
  itemId: string;
  itemName: string;
  priceCents: number;
  currency?: string;
  category?: string;
  /** Event id seed déterministe fourni par le SSR pour aligner Pixel ↔ CAPI. */
  eventIdSeed?: string;
}

export function ViewItemTracker({ ..., eventIdSeed }: ViewItemTrackerProps) {
  const { emit } = useTracking();
  useEffect(() => {
    // ...idempotence...
    emit('view_item', { currency, value, items }, { dedupKey: eventIdSeed });
  }, [..., eventIdSeed]);
  return null;
}
```

**Design notes** :
- L'option `dedupKey` existe déjà dans `EmitOptions` (cf. `client.ts:32-32`) — on la branche.
- Si `eventIdSeed` est présent, l'`emit` utilise cette ID comme `event_id` final via une **petite modif additionnelle** dans `TrackingClient.emit` pour accepter un `eventIdOverride` (à ajouter).
- Si absent (fallback dev/preview), le client garde le `uuidv7()` actuel — pas de régression.

### 3.2 `TrackingClient.emit` — option `eventIdOverride`

```ts
// apps/web/src/lib/tracking/client.ts (modif minime)
export interface EmitOptions {
  // ... champs existants ...
  /** Override de l'event_id (sinon uuidv7 généré). Utile pour aligner Pixel ↔ CAPI server-side. */
  eventIdOverride?: string;
}

// Dans la fn emit :
const entry: DataLayerEntry = {
  // ...
  event_id: options.eventIdOverride ?? uuidv7(now),
  // ...
};
```

**Design notes** :
- Aucun call-site existant cassé : `eventIdOverride` est optionnel.
- Validation format : `^[a-f0-9]{32}$|^[a-f0-9]{8}-...` accepté (uuid v7 ou hash sha256-tronqué).

### 3.3 Pages SSR — wiring

```tsx
// apps/web/src/app/(marketing)/kit/page.tsx (Server Component)
import { serverEmit } from '@/lib/tracking/server-emit';
import { deriveEventId } from '@/lib/tracking/event-id';
import { cookies } from 'next/headers';

export default async function KitPage() {
  const sessionId = cookies().get('fg_session_id')?.value ?? 'anon';
  const eventIdSeed = deriveEventId({
    eventName: 'view_item',
    sessionId,
    pageId: 'kit',
  });

  // Fire CAPI ViewContent server-side (fire-and-forget).
  void serverEmit({
    eventName: 'view_item',
    params: {
      currency: 'MAD',
      value: 320, // 32000 cents → 320 MAD
      items: [{ item_id: 'kit', item_name: 'Le pack FemiGlow', price: 320, quantity: 1 }],
    },
    pageId: 'kit',
  });

  return <KitPageBody eventIdSeed={eventIdSeed} />;
}
```

**Design notes** :
- Le `value` et `currency` SSR sont la source of truth (produit en DB). Pas de duplication avec ce que le client envoie — l'event_id partagé garantit la dédup.
- Identique à appliquer pour `/maison`, `/rituel`, et toute future page produit.

---

## 4. Data — Conception

### 4.1 Pas de migration de schéma

Aucune table créée ou altérée en Phase 1/2. On utilise :
- `orders` (existant) pour l'enrichissement Purchase
- `tracking_events` (existant) pour les logs
- Cookies HTTP existants (`fg_session_id`, `_fbp`, `_fbc`)

### 4.2 Vue SQL `v_purchase_quality`

```sql
-- apps/web/drizzle/sql/views/purchase_quality.sql
CREATE OR REPLACE VIEW v_purchase_quality AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE payload ? 'value' AND (payload->>'value')::numeric > 0) AS with_value,
  COUNT(*) FILTER (WHERE payload ? 'currency' AND payload->>'currency' ~ '^[A-Z]{3}$') AS with_currency,
  COUNT(*) FILTER (
    WHERE payload ? 'value' AND (payload->>'value')::numeric > 0
      AND payload ? 'currency' AND payload->>'currency' ~ '^[A-Z]{3}$'
  ) AS valid,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE payload ? 'value' AND (payload->>'value')::numeric > 0
        AND payload ? 'currency' AND payload->>'currency' ~ '^[A-Z]{3}$'
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS quality_pct
FROM tracking_events
WHERE event_name IN ('purchase', 'purchase_server')
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

**Usage** :

```bash
psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality WHERE day > NOW() - INTERVAL '7 days'"
```

Sortie attendue après P1 stabilisée :
```
   day    | total | with_value | with_currency | valid | quality_pct
----------+-------+------------+---------------+-------+-------------
2026-05-22|   42  |     41     |      42       |  41   |    97.6
```

### 4.3 Phase 3 — Table `tracking_events_dedup`

```sql
-- apps/web/drizzle/migrations/XXXX_tracking_events_dedup.sql
CREATE TABLE tracking_events_dedup (
  event_id text PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_tracking_events_dedup_expires ON tracking_events_dedup(expires_at);
-- Cron de purge :
-- DELETE FROM tracking_events_dedup WHERE expires_at < NOW();
```

Migration réservée à P3 (non bloquante pour P1/P2).

---

## 5. UI/UX/Design — Considérations

### 5.1 Surface utilisateur visible

**Aucune.** Toutes les modifs sont serveur ou tracking-only. L'utilisateur ne voit rien changer.

### 5.2 Surface développeur (DX)

- **Logs structured** : `console.error('[server-emit] …')` et `[meta-adapter] purchase_value_currency_invalid` apparaissent en dev pour debug rapide.
- **Storybook** : pas de changement (les composants UI restent identiques).
- **Tests verts** dès l'étape 1 — pas de phase « cassée temporairement ».

### 5.3 Surface admin

- **Admin /admin/tracking** (existant) — pas de modif Phase 1/2.
- **Phase 3 (optionnel)** : ajouter un widget « Qualité Purchase 7j » lisant `v_purchase_quality`. Pas critique pour résoudre le problème.

### 5.4 Considérations RGPD

- `serverEmit` lit `_fbp`/`_fbc` cookies — déjà couverts par le consent Marketing.
- Si `consent.ad_storage === 'denied'`, le `serverEmit` doit **respecter le consent** :

```ts
// Dans server-emit.ts (vérification ajoutée)
import { readConsentFromCookies } from '@/lib/tracking/consent';

const consent = readConsentFromCookies(cookies());
if (consent.ad_storage === 'denied') return; // ne fire pas si consent refusé
```

**Important** : si on fire CAPI sans consent, on enfreint le RGPD ET la politique Meta. Le respect du consent est NON-NÉGOCIABLE.

### 5.5 Performance SSR

- `serverEmit` est `void` (fire-and-forget) → 0ms impact sur la latence SSR.
- Lecture cookies + headers : ~0.1ms.
- Si Meta CAPI fetch échoue, l'erreur est loguée mais n'impacte pas la réponse HTTP.

### 5.6 Observabilité

| Signal | Lieu | Fréquence check |
|---|---|---|
| Vue SQL `v_purchase_quality` | DB | manuel quotidien post-P1, dashboard ensuite |
| Meta Events Manager | UI Meta | manuel hebdo |
| Logs `[server-emit]` failed | journald / `journalctl -u femiglow` | grep ad-hoc |
| `tracking_events.providersResults` JSON colonne | DB | grep `purchase_value_currency_invalid` |

---

## 6. Modularité & extensibilité

### 6.1 Pattern « enrichers chain » (futur)

L'enricher Purchase peut être généralisé en chaîne d'enrichers pluggables :

```ts
// lib/tracking/providers/_enrichers.ts (P3+)
type Enricher = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
const enrichers: Record<string, Enricher[]> = {
  purchase: [enrichPurchaseFromOrder, enrichPurchaseFromAttribution],
  view_item: [enrichViewItemFromProduct],
};
```

Hors scope actuel — le design n'empêche pas cette évolution.

### 6.2 Pattern « server-emit catalog »

`serverEmit` accepte aujourd'hui un union `view_item | view_item_list | select_item`. On peut étendre à `purchase`, `lead` quand le besoin émerge (ex. webhooks externes).

### 6.3 Tests modulaires

Chaque module a son propre `*.test.ts` côté à côté :
- `_enrich-purchase.test.ts`
- `event-id.test.ts`
- `is-bot.test.ts`
- `server-emit.test.ts`
- `event-id-cookie.test.ts`

Plus le test d'intégration `meta.test.ts` étendu pour le guard.

Aucun test ne touche à 2 modules à la fois (sauf le `meta.test.ts` qui mock enrichPurchase).

---

## 7. Dépendances entre modules

```
┌─────────────────────────────────────────────────┐
│  event-id.ts (pure)                             │
│        ▲                                        │
│        │                                        │
│  ┌─────┴─────────┐    ┌─────────────────┐       │
│  │ server-emit.ts │───►│ is-bot.ts (pure)│      │
│  │                │    └─────────────────┘       │
│  │                │    ┌─────────────────────┐  │
│  │                │───►│ meta.ts (dispatch)  │  │
│  └────────┬───────┘    └──────┬──────────────┘  │
│           │                   │                  │
│           │                   ▼                  │
│           │            ┌─────────────────────┐  │
│           │            │ _enrich-purchase.ts │  │
│           │            └─────────────────────┘  │
│           ▼                                      │
│    Pages SSR (kit, maison, rituel)              │
│                                                  │
│           ▲                                      │
│           │                                      │
│    ViewItemTracker.tsx (client)                  │
│           │                                      │
│           ▼                                      │
│    client.ts (TrackingClient.emit)              │
└─────────────────────────────────────────────────┘
```

**Garantie** : aucune dépendance circulaire, chaque module a une responsabilité unique et testable.

---

## 8. Sécurité

- **Token Meta CAPI** : déjà chiffré en DB (existant), aucune fuite via les nouveaux modules.
- **Cookies** : seulement lus (`_fbp`, `_fbc`, `fg_session_id`), jamais réécrits par `serverEmit`.
- **Injection event_id** : `deriveEventId` produit un hash → format strict `[a-f0-9]{32}`. Tout client tentant un override avec autre chose est rejeté côté validation Zod (à ajouter en P3 si nécessaire).
- **Side-channel via UA bot detection** : le pattern regex est case-insensitive, ~10 patterns — pas de risque ReDoS (test fast-check à ajouter).

---

> **Suite** : voir [`02-plan-dev-action.md`](./02-plan-dev-action.md) pour les étapes ordonnées avec gates de test.
