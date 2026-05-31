# 02 — Plan d'action de développement détaillé

> **Lien amont** : [`01-design-conception.md`](./01-design-conception.md) (architecture)
> **Lien aval** : [`03-tests-strategy.md`](./03-tests-strategy.md), [`04-runbook.md`](./04-runbook.md)

---

## Vue d'ensemble

3 phases ordonnées avec **gates de test** à chaque étape. Chaque étape = 1 commit dédié, vert en isolation.

```
P1 — Quick wins Purchase (3h dev)
 ├─ Step 1.1 enricher pur + tests
 ├─ Step 1.2 guard metaAdapter + tests
 ├─ Step 1.3 mapping purchase_server (si manquant)
 ├─ Step 1.4 vue SQL purchase_quality
 └─ GATE: typecheck + tests + build + smoke local
         observation 24h prod
        ▼
P2 — Server-side ViewContent fire (5h dev)
 ├─ Step 2.1 deriveEventId + tests
 ├─ Step 2.2 isBotRequest + tests
 ├─ Step 2.3 serverEmit helper + tests MSW
 ├─ Step 2.4 ViewItemTracker eventIdSeed prop
 ├─ Step 2.5 TrackingClient eventIdOverride
 ├─ Step 2.6 wire dans /kit
 ├─ Step 2.7 wire dans /maison
 ├─ Step 2.8 wire dans /rituel
 ├─ Step 2.9 audit GTM container eventID
 └─ GATE: e2e Playwright + smoke local + typecheck + build
         observation 7j prod
        ▼
P3 — Durcissement (2h dev, après 14j de P1+P2 stables)
 ├─ Step 3.1 schemas.ts strict purchaseParams
 ├─ Step 3.2 dedup persistante DB
 ├─ Step 3.3 admin widget purchase quality (optionnel)
 └─ GATE: typecheck + tests + build
```

---

## Phase 1 — Quick wins Purchase value/currency

### Step 1.1 — Helper `enrichPurchase`

**Objectif** : module pur réutilisable pour compléter value/currency depuis `orders` DB.

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/providers/_enrich-purchase.ts` (nouveau)
- ✏️ `apps/web/src/lib/tracking/providers/_enrich-purchase.test.ts` (nouveau)

**Implémentation** : cf. `01-design-conception.md` §2.1.

**Tests à écrire** (Vitest, `_enrich-purchase.test.ts`) :

```ts
describe('enrichPurchase', () => {
  it('returns params if value+currency already valid', async () => {
    const result = await enrichPurchase({ transaction_id: 'ord_1', value: 250, currency: 'MAD' });
    expect(result).toEqual({ value: 250, currency: 'MAD', source: 'params' });
  });

  it('reads from DB if value missing but transaction_id known', async () => {
    mockDbReturns({ totalCents: 32000, currency: 'mad' });
    const result = await enrichPurchase({ transaction_id: 'ord_existing' });
    expect(result).toEqual({ value: 320, currency: 'MAD', source: 'db' });
  });

  it('returns unavailable if transaction_id unknown', async () => {
    mockDbReturns(null);
    const result = await enrichPurchase({ transaction_id: 'ord_unknown' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('returns unavailable if value invalid AND no transaction_id', async () => {
    const result = await enrichPurchase({ value: 0, currency: 'BAD' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('rejects value <= 0 and currency not 3-letter', async () => {
    expect(isValidValue(0)).toBe(false);
    expect(isValidValue(-5)).toBe(false);
    expect(isValidValue(NaN)).toBe(false);
    expect(isValidValue(Infinity)).toBe(false);
    expect(isValidCurrency('mad')).toBe(false); // lowercase rejected
    expect(isValidCurrency('USDD')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
  });
});
```

**Gate** :
```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/_enrich-purchase.test.ts
pnpm --filter @femiglow/web typecheck
```

**Critère de succès** : 5 tests verts, typecheck 0 erreur.

---

### Step 1.2 — Guard `metaAdapter.dispatch`

**Objectif** : appeler `enrichPurchase` avant build payload, skip si toujours invalide.

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/providers/meta.ts` (edit)
- ✏️ `apps/web/src/lib/tracking/providers/meta.test.ts` (extension)

**Implémentation** : cf. `01-design-conception.md` §2.2.

**Tests à écrire** (extension `meta.test.ts`) :

```ts
describe('metaAdapter.dispatch — purchase guard', () => {
  it('dispatches when value+currency present in params', async () => {
    const result = await metaAdapter.dispatch(mockProvider, {
      eventName: 'purchase',
      params: { transaction_id: 'ord_1', value: 250, currency: 'MAD' },
      ...
    });
    expect(result.status).toBe('sent');
  });

  it('skips with purchase_value_currency_invalid when missing and not in DB', async () => {
    mockEnrichPurchaseReturns({ source: 'unavailable' });
    const result = await metaAdapter.dispatch(mockProvider, {
      eventName: 'purchase',
      params: { transaction_id: 'ord_unknown' },
      ...
    });
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('purchase_value_currency_invalid');
  });

  it('enriches from DB and dispatches with enriched value', async () => {
    mockEnrichPurchaseReturns({ value: 320, currency: 'MAD', source: 'db' });
    const result = await metaAdapter.dispatch(mockProvider, {
      eventName: 'purchase',
      params: { transaction_id: 'ord_with_db_row' },
      ...
    });
    expect(result.status).toBe('sent');
    expect(metaFetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"value":320'),
      }),
    );
  });

  it('also guards purchase_server event', async () => {
    mockEnrichPurchaseReturns({ source: 'unavailable' });
    const result = await metaAdapter.dispatch(mockProvider, {
      eventName: 'purchase_server',
      params: { payment_intent_id: 'pi_xxx' }, // pas de transaction_id
      ...
    });
    expect(result.status).toBe('skipped');
  });

  it('does NOT guard non-purchase events', async () => {
    const result = await metaAdapter.dispatch(mockProvider, {
      eventName: 'view_item',
      params: {}, // pas de value/currency mais ok pour view_item
      ...
    });
    expect(result.status).toBe('sent');
  });
});
```

**Gate** :
```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/meta.test.ts
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/  # tous les tests tracking
pnpm --filter @femiglow/web typecheck
```

**Critère de succès** : tests existants + 5 nouveaux passent, typecheck 0.

---

### Step 1.3 — Mapping `purchase_server` (si manquant)

**Objectif** : vérifier et compléter le mapping `purchase_server` → `Purchase` Meta.

**Fichiers** :
- 🔍 `apps/web/src/lib/tracking/providers/event-mapping.ts` (audit + edit conditionnel)
- ✏️ `apps/web/src/lib/tracking/providers/event-mapping.test.ts` (assertion)

**Procédure** :

```bash
grep -n "purchase_server" /var/www/femiglow/.claude/worktrees/webhook/apps/web/src/lib/tracking/providers/event-mapping.ts
```

- **Si trouvé avec mapping Meta `Purchase`** : RAS, écrire un test d'assertion pour verrouiller.
- **Si absent** : ajouter

```ts
// event-mapping.ts
purchase_server: {
  meta: { name: 'Purchase', isStandard: true },
  google_ga4: null,           // pas dans GA4 (déjà capté côté client)
  google_ads: null,
  tiktok: { name: 'Purchase', isStandard: true },
  snap: { name: 'PURCHASE', isStandard: true },
  identityFields: ['email', 'phone', 'firstName', 'lastName', 'city', 'country'],
},
```

**Test à écrire** :
```ts
it('maps purchase_server to Meta Purchase canonical', () => {
  expect(EVENT_MAPPING.purchase_server.meta).toEqual({ name: 'Purchase', isStandard: true });
});
```

**Gate** :
```bash
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/providers/event-mapping.test.ts
```

---

### Step 1.4 — Vue SQL `v_purchase_quality`

**Objectif** : observabilité immédiate de l'amélioration côté DB.

**Fichiers** :
- ✏️ `apps/web/drizzle/sql/views/purchase_quality.sql` (nouveau)
- ✏️ `apps/web/scripts/install-view-purchase-quality.ts` (nouveau, helper one-shot)

**Implémentation** :

```sql
-- apps/web/drizzle/sql/views/purchase_quality.sql
CREATE OR REPLACE VIEW v_purchase_quality AS
SELECT
  DATE(created_at) AS day,
  event_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE payload ? 'value'
      AND (payload->>'value')::numeric > 0
      AND payload ? 'currency'
      AND payload->>'currency' ~ '^[A-Z]{3}$'
  ) AS valid,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE payload ? 'value'
        AND (payload->>'value')::numeric > 0
        AND payload ? 'currency'
        AND payload->>'currency' ~ '^[A-Z]{3}$'
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS quality_pct
FROM tracking_events
WHERE event_name IN ('purchase', 'purchase_server')
GROUP BY DATE(created_at), event_name
ORDER BY day DESC, event_name;
```

```ts
// apps/web/scripts/install-view-purchase-quality.ts
import './_load-env.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db/client';

async function main() {
  const sql = await fs.readFile(
    path.resolve('drizzle/sql/views/purchase_quality.sql'),
    'utf-8',
  );
  const conn = db();
  if (!conn) throw new Error('DATABASE_URL not set');
  await conn.unsafe(sql);
  // eslint-disable-next-line no-console
  console.log('✓ View v_purchase_quality installed');
}
main().catch((err) => { console.error(err); process.exit(1); });
```

**Wire dans package.json** :
```json
"db:install-purchase-view": "tsx scripts/install-view-purchase-quality.ts",
```

**Gate** :
```bash
# En local sur DB de worktree :
pnpm --filter @femiglow/web db:install-purchase-view
psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality LIMIT 5;"
```

**Critère de succès** : vue créée, query SQL retourne 0 lignes (DB worktree vide) ou des lignes (si seed).

---

### Phase 1 — GATE de validation

```bash
# Tous les tests P1
pnpm --filter @femiglow/web exec vitest run src/lib/tracking/
# Typecheck
pnpm --filter @femiglow/web typecheck
# Build
pnpm --filter @femiglow/web build
# Lint
pnpm --filter @femiglow/web lint
```

**Critère go P2** :
- Tous les commands ci-dessus exit 0.
- Aucun test legacy cassé.
- `git log --oneline` montre 4 commits Phase 1 distincts.

---

## Phase 2 — Server-side ViewContent fire

### Step 2.1 — `deriveEventId` (pure)

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/event-id.ts` (nouveau)
- ✏️ `apps/web/src/lib/tracking/event-id.test.ts` (nouveau)

**Implémentation** : cf. `01-design-conception.md` §2.3.

**Tests** (`event-id.test.ts`) :

```ts
describe('deriveEventId', () => {
  it('is deterministic for identical inputs', () => {
    const a = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: 1_700_000_000_000 });
    const b = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: 1_700_000_000_000 });
    expect(a).toBe(b);
  });

  it('produces same id within same 5min bucket', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + 60_000; // +1min, same bucket
    expect(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t1 }))
      .toBe(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t2 }));
  });

  it('produces different id across bucket boundary', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + 6 * 60_000; // +6min, next bucket
    expect(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t1 }))
      .not.toBe(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit', timestamp: t2 }));
  });

  it('differs per pageId', () => {
    expect(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' }))
      .not.toBe(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'maison' }));
  });

  it('differs per sessionId', () => {
    expect(deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' }))
      .not.toBe(deriveEventId({ eventName: 'view_item', sessionId: 's2', pageId: 'kit' }));
  });

  it('returns exactly 32 hex chars', () => {
    const id = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' });
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it('uses current Date.now() if timestamp absent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const id = deriveEventId({ eventName: 'view_item', sessionId: 's1', pageId: 'kit' });
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    vi.useRealTimers();
  });
});
```

---

### Step 2.2 — `isBotRequest` (pure)

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/is-bot.ts` (nouveau)
- ✏️ `apps/web/src/lib/tracking/is-bot.test.ts` (nouveau)

**Implémentation** : cf. `01-design-conception.md` §2.5.

**Tests** :

```ts
describe('isBotRequest', () => {
  const HUMAN_UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ...',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Edg/120',
  ];
  const BOT_UAS = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'HeadlessChrome/120.0.6099.71',
    'Mozilla/5.0 ... Pingdom Bot',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  ];

  it.each(HUMAN_UAS)('returns false for human UA: %s', (ua) => {
    expect(isBotRequest(ua)).toBe(false);
  });

  it.each(BOT_UAS)('returns true for bot UA: %s', (ua) => {
    expect(isBotRequest(ua)).toBe(true);
  });

  it('returns true for empty UA', () => {
    expect(isBotRequest('')).toBe(true);
    expect(isBotRequest(undefined as unknown as string)).toBe(true);
  });
});
```

---

### Step 2.3 — `serverEmit` helper

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/server-emit.ts` (nouveau)
- ✏️ `apps/web/src/lib/tracking/server-emit.test.ts` (nouveau, MSW pour graph.facebook.com)

**Implémentation** : cf. `01-design-conception.md` §2.4.

**Tests MSW** : voir `03-tests-strategy.md` §3.

**Cas couverts** :
- ✓ Fire avec session + provider OK → call Meta CAPI
- ✓ Skip si bot UA
- ✓ Skip si pas de session
- ✓ Skip si provider Meta disabled
- ✓ Skip si consent ad_storage === 'denied' (NON-NÉGOCIABLE RGPD)
- ✓ event_id passé est le déterministe (assert request body)
- ✓ Catch + log si dispatch throw, ne bloque pas le caller

---

### Step 2.4 — `ViewItemTracker` accepte `eventIdSeed`

**Fichiers** :
- ✏️ `apps/web/src/components/tracking/ViewItemTracker.tsx` (edit signature)
- ✏️ `apps/web/src/components/tracking/ViewItemTracker.test.tsx` (extension)

**Implémentation** : cf. `01-design-conception.md` §3.1.

**Tests** :
- ✓ Rend null sans crash si `eventIdSeed` absent
- ✓ Émet avec `eventIdOverride` quand seed fourni
- ✓ Re-render avec même itemId ne re-emit pas (idempotence préservée)

---

### Step 2.5 — `TrackingClient.emit` accepte `eventIdOverride`

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/client.ts` (edit `EmitOptions` + `emit()`)
- ✏️ `apps/web/src/lib/tracking/client.test.ts` (extension)

**Implémentation** : cf. `01-design-conception.md` §3.2.

**Tests** :
- ✓ Sans option, utilise uuidv7 (comportement legacy)
- ✓ Avec option, l'entry `event_id` est exactement la valeur passée
- ✓ Validation format : accept uuid v7 OU hex32 — reject autre

---

### Step 2.6/2.7/2.8 — Wire SSR sur `/kit`, `/maison`, `/rituel`

**Fichiers (par page)** :
- ✏️ `apps/web/src/app/(marketing)/{kit|maison|rituel}/page.tsx` (edit)

**Implémentation** : cf. `01-design-conception.md` §3.3.

**Procédure répétée 3 fois** :

1. Importer `serverEmit`, `deriveEventId`, `cookies`.
2. Lire `fg_session_id` cookie en début de page.
3. Calculer `eventIdSeed` avec `pageId` correspondant.
4. `void serverEmit({ ... })` fire-and-forget.
5. Passer `eventIdSeed` au `<ViewItemTracker />` enfant.

**Tests** :
- ✓ Smoke local : `pnpm dev`, charger `/kit`, vérifier que `tracking_events` worktree DB a une row `view_item` avec `event_id` = hash déterministe attendu.
- ✓ Vérifier les logs `[server-emit]` absent (pas d'erreur).

---

### Step 2.9 — Audit + correction GTM container

**Fichiers** :
- 🔍 `draft/container.production.*.json` (read-only audit)
- ✏️ `apps/web/src/lib/tracking/plan/exporter.ts` (edit conditionnel)

**Procédure** :

```bash
# Localiser le dernier container exporté
ls -lt /var/www/femiglow/.claude/worktrees/webhook/draft/container.production.*.json | head -1
# Inspect le tag Meta Pixel ViewContent
jq '.containerVersion.tag[] | select(.name | test("Meta.*ViewContent"))' draft/container.production.*.json
```

**Si le tag n'envoie pas `eventID`** (pattern `fbq('track', 'ViewContent', { ..., eventID: ... })`) :

Patcher dans `exporter.ts` le builder du tag Meta pour inclure `eventID: {{DLV - event_id}}`.

**Tests** :
- ✓ Test snapshot du JSON exporté (`exporter.test.ts`) : vérifier que chaque tag Meta `fbq('track', X, ...)` inclut `eventID`.

---

### Phase 2 — GATE de validation

```bash
# Tous les tests P2 (et P1 toujours verts)
pnpm --filter @femiglow/web exec vitest run
# E2E
pnpm --filter @femiglow/web exec playwright test tests/e2e/kit-view-item-dedup.spec.ts
# Smoke local
pnpm --filter @femiglow/web dev &
sleep 8
curl -s http://localhost:3000/kit > /dev/null
# Vérifier DB worktree
psql $WORKTREE_DATABASE_URL -c "SELECT event_id, event_name, payload FROM tracking_events WHERE event_name='view_item' ORDER BY created_at DESC LIMIT 1;"
# Le row doit avoir event_id matching deriveEventId(view_item, <session>, kit)
kill %1
# Typecheck + build
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web build
```

**Critère go P3** :
- Tous les tests passent (unit + E2E).
- DB worktree montre des `view_item` avec event_id 32-hex (server-emit fire).
- Build 0 erreur.
- Logs absent d'erreurs `[server-emit]`.

---

## Phase 3 — Durcissement (post-observation 14 jours)

> **À déclencher uniquement après** : Meta Events Manager confirme la qualité Purchase ≥ 97 % et la couverture CAPI ViewContent ≥ 95 % sur 7 jours en prod.

### Step 3.1 — Schéma Zod strict pour Purchase

**Fichiers** :
- ✏️ `apps/web/src/lib/tracking/schemas.ts` (edit)
- ✏️ `apps/web/src/lib/tracking/schemas.test.ts` (extension)

**Implémentation** :

```ts
const purchaseParams = z
  .object({
    transaction_id: z.string().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
    value: z.number().positive(),
    items: z.array(itemSchema).min(1).optional(),
    tax: z.number().nonnegative().optional(),
    shipping: z.number().nonnegative().optional(),
  })
  .strict();
```

**Tests** :
- ✓ Purchase complet valide passe
- ✓ Purchase sans `currency` rejeté avec issue path `['currency']`
- ✓ Purchase avec `currency: 'mad'` rejeté (lowercase)
- ✓ Purchase avec `value: 0` rejeté
- ✓ Purchase avec `value: -5` rejeté

**Risque résiduel à monitorer 7 jours après** : nombre de rejets `/api/track` 422. Si > 1 % du trafic, investiguer un call-site oublié.

---

### Step 3.2 — Dedup persistante DB

**Fichiers** :
- ✏️ `apps/web/drizzle/migrations/XXXX_tracking_events_dedup.sql` (nouveau)
- ✏️ `apps/web/src/lib/db/schema-tracking.ts` (ajout table)
- ✏️ `apps/web/src/lib/tracking/server/dedup.ts` (refactor : DB au lieu de Map)
- ✏️ `apps/web/src/lib/tracking/server/dedup.test.ts` (extension)

**Implémentation** : cf. `01-design-conception.md` §4.3.

**Note migration** : `db:migrate-safe` sur prod.

---

### Step 3.3 — Admin widget « Qualité Purchase » (optionnel)

**Fichiers** :
- ✏️ `apps/web/src/app/(admin)/admin/tracking/purchase-quality/page.tsx` (nouveau)
- ✏️ `apps/web/src/lib/db/queries/tracking/purchase-quality.ts` (nouveau)

**Implémentation** : Server Component qui query `v_purchase_quality` et rend une table simple.

---

## Récap commits attendus

| Commit | Phase | Hash type |
|---|---|---|
| `feat(tracking): pure enrichPurchase helper` | P1.1 | feat |
| `feat(tracking): guard meta dispatch on purchase missing value/currency` | P1.2 | feat |
| `fix(tracking): map purchase_server to Meta Purchase canonical` | P1.3 | fix |
| `feat(tracking): v_purchase_quality SQL view for observability` | P1.4 | feat |
| `feat(tracking): deriveEventId deterministic helper` | P2.1 | feat |
| `feat(tracking): isBotRequest UA detection helper` | P2.2 | feat |
| `feat(tracking): serverEmit helper for server-side CAPI fire` | P2.3 | feat |
| `feat(tracking): ViewItemTracker accepts eventIdSeed prop` | P2.4 | feat |
| `feat(tracking): TrackingClient accepts eventIdOverride option` | P2.5 | feat |
| `feat(tracking): wire serverEmit ViewContent in /kit SSR` | P2.6 | feat |
| `feat(tracking): wire serverEmit ViewContent in /maison SSR` | P2.7 | feat |
| `feat(tracking): wire serverEmit ViewContent in /rituel SSR` | P2.8 | feat |
| `fix(tracking): include eventID in Meta Pixel tags via GTM exporter` | P2.9 | fix |
| `feat(tracking): strict purchaseParams Zod schema` | P3.1 | feat |
| `feat(tracking): persistent dedup via tracking_events_dedup table` | P3.2 | feat |
| `feat(admin): purchase quality widget in /admin/tracking` | P3.3 | feat |

→ **15-16 commits**, branche dédiée `feat/meta-quality-fix`.

---

## Rollback strategy

Chaque commit étant indépendant et vert, le rollback est `git revert <hash>`.

Cas particuliers :
- **P1.2 (guard) trop strict** : revert P1.2 seul, garder enricher (P1.1). On revient à l'état actuel sans guard.
- **P2.6/2.7/2.8 (SSR fire) trop coûteux en latence Meta CAPI** : retirer le `void serverEmit(...)` des pages, garder les helpers en place (re-wire ultérieur).

---

## Critères globaux de done

- [ ] 16 commits sur `feat/meta-quality-fix`, tous verts (typecheck + tests + build).
- [ ] Branche mergée sur `master` après merge review.
- [ ] Prod déployée (cf. [`04-runbook.md`](./04-runbook.md)).
- [ ] Vue SQL `v_purchase_quality` montre ≥ 97 % qualité Purchase sur 24 h.
- [ ] Meta Events Manager : qualité Purchase ≥ 95 % sur 7 j.
- [ ] Meta Events Manager : couverture CAPI ViewContent ≥ 95 % sur 7 j.
- [ ] Aucune dégradation des autres pixels (Snap, TikTok, GA4).

---

> **Suite** : voir [`03-tests-strategy.md`](./03-tests-strategy.md) pour la stratégie de tests détaillée.
