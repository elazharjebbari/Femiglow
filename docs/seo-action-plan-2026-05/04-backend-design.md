# 04 — Design backend (services, API, cache, OG)

Conception détaillée des couches backend touchées par le plan. Aucun rewrite des modules existants — extensions ciblées.

## 1. Architecture cible

```
                 +----------------------------+
   Admin UI ---> | /api/admin/seo/**          |  (existant, complété)
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | lib/db/queries/seo.ts      |  (existant)
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
                 | Drizzle (seoOverrides,     |
                 |  seoSettings, snapshots)   |
                 +-------------+--------------+
                               |
                  cascade via  v
                 +----------------------------+
                 | lib/seo/resolve.ts         |  (existant, étendu)
                 |  + componentResolve.ts     |  (nouveau, phase 5)
                 +-------------+--------------+
                               |
                               v
                 +----------------------------+
   Pages RSC --> | generateMetadata()         |
                 |  + JSON-LD helpers         |
                 +----------------------------+

                 +----------------------------+
                 | /api/og/[template]         |  (nouveau, phase 4)
                 |  -> @vercel/og ImageResponse|
                 +----------------------------+
```

## 2. Services (`lib/seo/`)

### 2.1 `resolveSeoMetadata` (existant, étendu phase 5)

Signature actuelle (à conserver) :

```ts
export async function resolveSeoMetadata(
  scope: SeoScope,
  targetKey: string,
  locale: string = 'fr-MA',
  fallback?: Partial<ResolvedSeoMetadata>,
): Promise<ResolvedSeoMetadata>;
```

Comportement actuel : override publié → fallback param → settings → defaults code. Cache `unstable_cache` avec tags `seo` et `seo:{scope}:{targetKey}`.

**Extension phase 5** : nouveau helper qui fusionne page + composants :

```ts
// apps/web/src/lib/seo/component-resolve.ts
export interface ComponentSeoInput {
  componentKey: string;
  /** Champs que le composant peut écraser dans la metadata page parente */
  overridableFields?: Array<'title' | 'description' | 'ogTitle' | 'ogDescription' | 'ogImageMediaId'>;
}

export async function resolvePageWithComponents(
  pageScope: 'page' | 'product' | 'article',
  pageTargetKey: string,
  components: ComponentSeoInput[],
  locale: string = 'fr-MA',
): Promise<ResolvedSeoMetadata>;
```

**Règle de fusion** : pour chaque champ override par un composant, l'ordre de priorité est `composant.published > page.published > settings > default`. Le champ `componentOverrides` du résultat documente la trace pour debug.

### 2.2 Module `lib/seo/og-image-resolver.ts` (existant, à compléter phase 4)

Le helper actuel `resolveOgImage(componentKey, kind)` renvoie une URL statique ou un fallback SVG. Phase 4 introduit une variante :

```ts
export type OgImageResolution =
  | { kind: 'static'; url: string; width: number; height: number; alt: string }
  | { kind: 'dynamic'; url: string; cacheKey: string };

export async function resolveOgImageForRoute(args: {
  pageScope: 'page' | 'product' | 'article' | 'component';
  pageTargetKey: string;
  resolved: ResolvedSeoMetadata;
}): Promise<OgImageResolution>;
```

Si `ogImageMediaId` présent → renvoie URL média statique. Sinon, si `ogImageTemplate` défini → renvoie URL dynamique `/api/og/{template}?title=...&v=YYYY-MM`. Sinon → fallback SVG statique.

### 2.3 Module `lib/seo/cache.ts` (nouveau, phase 5)

Centralise les tags pour éviter les magic strings dispersées :

```ts
export const SEO_GLOBAL_TAG = 'seo';

export function seoTargetTag(scope: SeoScope, targetKey: string): string {
  return `seo:${scope}:${targetKey}`;
}

export function seoComponentTag(componentKey: string): string {
  return seoTargetTag('component', componentKey);
}
```

### 2.4 Repository `lib/db/queries/seo.ts` (existant, à étendre)

Fonctions à ajouter ou compléter :

- `listOverridesByScope(scope, opts)` — déjà présent, vérifier filtre `publishedOnly`.
- `getActiveComponentOverrides(componentKeys: string[], locale)` — nouveau, batch fetch pour optimiser la phase 5 (une seule requête pour tous les composants d'une page).
- `listAuditEventsForSeo(opts)` — nouveau, utilisé par le panel d'audit log (phase 3).

```ts
export async function getActiveComponentOverrides(
  componentKeys: string[],
  locale: string,
): Promise<Map<string, SeoOverrideRow>> {
  if (componentKeys.length === 0) return new Map();
  const rows = await db
    .select()
    .from(seoOverrides)
    .where(and(
      eq(seoOverrides.scope, 'component'),
      inArray(seoOverrides.targetKey, componentKeys),
      eq(seoOverrides.locale, locale),
      isNotNull(seoOverrides.publishedAt),
    ));
  return new Map(rows.map((r) => [r.targetKey, r]));
}
```

## 3. API routes admin

### 3.1 Routes existantes (à conserver)

Voir `01-context-audit.md` §3.3. Aucune signature ne change.

### 3.2 Nouvelle route phase 4 — `/api/og/[template]/route.tsx`

```ts
// apps/web/src/app/api/og/[template]/route.tsx
import { ImageResponse } from 'next/og';
import { ogImageQuerySchema } from '@/lib/seo/og-image.schemas';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { template: string } },
) {
  const url = new URL(request.url);
  const parsed = ogImageQuerySchema.safeParse({
    template: params.template,
    title: url.searchParams.get('title'),
    eyebrow: url.searchParams.get('eyebrow') ?? undefined,
    theme: url.searchParams.get('theme') ?? 'sauge',
    v: url.searchParams.get('v') ?? undefined,
  });
  if (!parsed.success) {
    return new Response('Bad request', { status: 400 });
  }
  const { template, title, eyebrow, theme } = parsed.data;
  return new ImageResponse(renderTemplate({ template, title, eyebrow, theme }), {
    width: 1200,
    height: 630,
    headers: {
      'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      'content-type': 'image/png',
    },
  });
}
```

Le rendu `renderTemplate` est une fonction pure qui retourne du JSX (limité, edge runtime). Pas de polices custom au-delà des 2 chargées en edge ; on garde Inter + Cormorant via `fetch` interne en cache.

### 3.3 Nouvelle route phase 3 — `/api/admin/seo/audit-log` (GET)

```ts
// liste paginée des audit events scope SEO
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get('limit') ?? 20));
  const cursor = url.searchParams.get('cursor');
  const action = url.searchParams.get('action');

  const events = await listAuditEventsForSeo({ limit, cursor, action });
  return NextResponse.json({ events, nextCursor: events.length === limit ? events.at(-1)?.id : null });
}
```

### 3.4 Revalidation à la publication

Convention conservée : à chaque `publish`, `unpublish`, ou `restore`, on appelle :

```ts
revalidateTag(SEO_GLOBAL_TAG);
revalidateTag(seoTargetTag(scope, targetKey));

// Phase 5 — si scope=component, invalider aussi la page parente
if (scope === 'component') {
  const pageKey = resolvePageKeyFromComponentKey(targetKey); // map composant -> page parente
  if (pageKey) revalidateTag(seoTargetTag('page', pageKey));
}

// Path-level ciblé pour les routes critiques
if (scope === 'product' && targetKey === 'le-kit') revalidatePath('/kit');
if (scope === 'component' && targetKey === 'kit-hero') revalidatePath('/kit');
```

Le mapping `resolvePageKeyFromComponentKey` est un objet constant (10 entrées max), pas une lookup DB — performant et testable.

## 4. Validation et gestion d'erreurs

- **Tous les inputs API** passent par Zod. Réponse `400` avec le body `{ errors: parsed.error.flatten() }` en cas d'échec.
- **Conflit unique constraint** (création d'override existant) : 409 avec `{ code: 'CONFLICT', existingId }`.
- **DB indisponible** : `resolveSeoMetadata` retombe sur defaults code. Côté API admin, on renvoie 503 avec retry-after.
- **Pas de stack trace côté client**. Erreurs loguées via le logger applicatif (`lib/logger`).

## 5. Sécurité

- **Auth admin** : `getAdminSession()` sur chaque route admin.
- **CSRF** : routes mutables vérifient l'origine via header `origin` ou token CSRF (selon convention monorepo, à confirmer phase 0).
- **Rate limiting** : `/api/og/[template]` doit avoir un rate limit edge (par IP) pour éviter abus. Valeur cible : 60 req/min par IP.
- **Validation taille input** : title 120, description 320, keywords 20 — déjà en place via Zod.
- **Sanitization JSON-LD** : avant insertion DB, vérifier `@context` et `@type` ; refuser balises HTML inline dans les strings.

## 6. Observabilité

### 6.1 Header de debug

À chaque réponse HTML générée par une page utilisant `resolveSeoMetadata`, ajouter un header `x-seo-source` qui prend la valeur du champ `source` du résultat (`override`, `settings`, `default`).

Implémentation : middleware ou directement dans `generateMetadata` (non, generateMetadata ne pose pas de headers — utiliser middleware avec map de tags).

Convention plus simple : ne pas poser via middleware mais exposer une route debug `/api/_debug/seo?route=/kit` qui renvoie la résolution complète.

```ts
// apps/web/src/app/api/_debug/seo/route.ts
// Réservé aux admins (getAdminSession).
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const route = new URL(req.url).searchParams.get('route');
  if (!route) return new Response('route param required', { status: 400 });
  const { scope, targetKey } = mapRouteToScope(route);
  const resolved = await resolveSeoMetadata(scope, targetKey);
  return NextResponse.json(resolved);
}
```

### 6.2 Métriques

- Compteur d'overrides publiés par scope (Prometheus / log structuré).
- Latence P95 de `resolveSeoMetadata` (typiquement < 5 ms cache hit, < 50 ms cache miss).
- Latence P95 de `/api/og/[template]` (cible < 800 ms cache miss, < 50 ms cache hit).
- Taux de cache hit `unstable_cache` SEO.

### 6.3 Logs structurés

À chaque mutation SEO, log JSON avec `event`, `actorId`, `scope`, `targetKey`, `action` — ingestable par Datadog/Loki.

## 7. Performance

- **Batch fetch** des composants : `getActiveComponentOverrides` évite N+1 (une requête pour tous les composants d'une page).
- **Cache aggressif** sur `/api/og/[template]` : 1 jour client, 7 jours CDN, 30 jours stale-while-revalidate.
- **`resolveSeoMetadata` mémoïsé par requête** : `unstable_cache` au niveau du process Node + revalidateTag.
- **`generateStaticParams`** maintenu pour articles et legal pages — pré-rendu à `next build`.

## 8. Migrations et compatibilité

- **Aucune migration destructive** dans ce plan.
- **Feature flags** :
  - `NEXT_PUBLIC_SEO_OG_DYNAMIC=true` active la résolution dynamique OG image (phase 4).
  - `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=true` active le scope component (phase 5).
  - Si flag à `false`, fallback identique au comportement actuel (zéro régression).
- **Rollback** : `git revert` des commits + bascule flag à `false` (effet immédiat sans rebuild grâce à `NEXT_PUBLIC_*` côté `process.env` server, mais préférer rebuild pour stabilité).

## 9. Contrats de signature à respecter

Aucune API publique existante ne change de signature. Aucun champ DB n'est renommé. Aucun type exporté n'est cassé. Les extensions sont **additives**.

## 10. Risques et mitigations

| Risque | Mitigation |
|---|---|
| `unstable_cache` ne se revalide pas en dev (HMR) | Documenté dans le runbook, retest après rebuild prod. |
| `@vercel/og` edge runtime limite la taille du bundle | Charger les polices via fetch CDN, pas d'import lourd. Tester taille edge ≤ 1 MB. |
| Conflit clé composante / clé page (collision targetKey) | Le scope discriminé empêche le conflit (`('page','kit')` ≠ `('component','kit-hero')`). |
| Régression sur pages existantes lors de l'activation du flag composant | Feature flag par défaut à `false` en staging, smoke tests Playwright avant activation prod. |
