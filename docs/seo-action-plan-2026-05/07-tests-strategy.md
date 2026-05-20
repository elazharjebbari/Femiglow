# 07 — Stratégie de tests

Stratégie complète Vitest (unit + integration MSW) et Playwright (E2E + a11y). Test-first sur la logique métier. Couverture cible 90 % sur `lib/seo/**` et `components/admin/seo/**`.

## 1. Pyramide de tests

```
              +------------------+
              |    E2E (Playwright)
              |    8-12 specs
              +------------------+
            +--------------------------+
            |  Integration (Vitest+MSW)
            |  ~ 25 specs
            +--------------------------+
        +----------------------------------+
        |       Unit (Vitest)
        |       ~ 80 specs
        +----------------------------------+
```

Objectif : 70 % unit, 20 % integration, 10 % E2E.

## 2. Outillage

| Couche | Outil | Localisation tests |
|---|---|---|
| Unit | Vitest + `@testing-library/react` | À côté du fichier source `.test.ts(x)` |
| Integration | Vitest + `@testing-library/react` + MSW v2 | À côté + setup `vitest.setup.ts` |
| E2E | Playwright | `apps/web/e2e/**/*.spec.ts` |
| A11y | `@axe-core/playwright` | E2E dédié `apps/web/e2e/a11y/*.spec.ts` |
| Visuelle | Pas dans ce plan (backlog) | — |

Mocks DB :

- **Unit** : pas de DB. Mocks Drizzle via `vi.mock('@/lib/db')` ou injection de dépendances (préféré).
- **Integration** : DB en mémoire optionnelle (sqlite via Drizzle) ou mock complet via MSW (préféré, plus simple).
- **E2E** : DB de test éphémère (postgres dans CI) avec seed minimal — voir `09-runbook-execution.md`.

## 3. Conventions

### 3.1 Nommage

- Fichier : `<source>.test.ts(x)` à côté de `<source>.ts(x)`.
- Describe : nom de la fonction/composant + cas.
- It : phrase complète en français, commence par « doit … ».

```ts
describe('resolveSeoMetadata', () => {
  it('doit retourner les defaults si aucun override ni settings', async () => { /* ... */ });
  it('doit privilégier override published sur settings', async () => { /* ... */ });
});
```

### 3.2 Setup MSW

```ts
// apps/web/vitest.setup.ts (extrait)
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { handlers } from './src/test/msw-handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Handlers SEO :

```ts
// apps/web/src/test/msw-handlers/seo.ts
import { http, HttpResponse } from 'msw';

export const seoHandlers = [
  http.get('/api/admin/seo', () => HttpResponse.json({ items: [], total: 0 })),
  http.post('/api/admin/seo', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'mock-id', ...body });
  }),
  http.post('/api/admin/seo/:id/publish', () => HttpResponse.json({ ok: true })),
  http.get('/api/admin/seo/audit', async ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      score: 92,
      issues: [],
      preview: { title: url.searchParams.get('title'), description: url.searchParams.get('description') },
    });
  }),
];
```

### 3.3 Fixtures

```ts
// apps/web/src/test/fixtures/seo.ts
export function makeSeoOverride(overrides: Partial<SeoOverrideRow> = {}): SeoOverrideRow {
  return {
    id: 'ov_test',
    scope: 'product',
    targetKey: 'le-kit',
    locale: 'fr-MA',
    title: 'Le rituel d\'éclat',
    description: 'Soin manucure en 4 gestes pour des ongles éclatants.',
    ogTitle: null,
    ogDescription: null,
    keywords: ['rituel', 'soin', 'ongles'],
    ogImageMediaId: null,
    ogImageTemplate: 'product',
    twitterCard: 'summary_large_image',
    canonical: 'https://femiglow.ma/kit',
    robotsIndex: true,
    robotsFollow: true,
    structuredData: null,
    publishedAt: new Date('2026-05-01T10:00:00Z'),
    draftedAt: new Date('2026-04-30T10:00:00Z'),
    createdAt: new Date('2026-04-30T10:00:00Z'),
    updatedAt: new Date('2026-05-01T10:00:00Z'),
    createdBy: 'admin_1',
    ...overrides,
  };
}
```

## 4. Tests par phase

### 4.1 Phase 0 — Hot patches

**Vitest unit** (nouveaux, ≤ 3 fichiers) :

- `apps/web/src/app/(commerce)/commander/page.test.ts` — `metadata.robots.index === false`, `metadata.alternates.canonical === '/commander'`.
- `apps/web/src/app/(commerce)/merci/page.test.ts` — idem.
- `apps/web/src/components/admin/seo/BulkDeleteConfirmDialog.test.tsx` — confirm désactivé tant que le nombre saisi ne correspond pas ; submit appelle onConfirm.

**Playwright E2E** (nouveaux) :

- `apps/web/e2e/seo/commande-merci-metadata.spec.ts` — visite `/commander`, lit `<title>`, lit `<meta name="robots">`, vérifie `noindex`.
- `apps/web/e2e/admin/seo-bulk-delete.spec.ts` — sélection 2 items, clique « Supprimer », saisit le mauvais nombre → bouton disabled, saisit le bon → click → toast success.

### 4.2 Phase 1 — Sitemap freshness

**Vitest unit** (étendre `apps/web/src/app/sitemap.test.ts`) :

```ts
it('doit utiliser article.updatedAt comme lastModified', async () => {
  vi.mocked(getPublishedArticles).mockResolvedValue([
    { slug: 'foo', updatedAt: new Date('2026-04-15') } as any,
  ]);
  const result = await sitemap();
  const article = result.find((r) => r.url.endsWith('/journal/foo'));
  expect(article?.lastModified).toEqual(new Date('2026-04-15'));
});

it('doit utiliser NEXT_PUBLIC_BUILD_DATE pour les routes statiques', async () => {
  const result = await sitemap();
  const home = result.find((r) => r.url.endsWith('/'));
  expect(home?.lastModified).toEqual(new Date(process.env.NEXT_PUBLIC_BUILD_DATE!));
});
```

### 4.3 Phase 2 — Media picker OG

**Vitest + Testing Library** (`apps/web/src/components/admin/seo/OgImagePicker.test.tsx`) :

- Rend les 3 radios (none, media, template) ; sélection mutuellement exclusive.
- Mode `media` : clic « Parcourir » ouvre `MediaPickerDialog` ; sélection met à jour `value.mediaId`.
- Mode `template` : changement de template/eyebrow/theme update `value.templateParams`.
- `dynamicEnabled=false` masque le radio template.
- A11y : radios groupés sous `role="radiogroup"`, labels associés.

**Vitest + MSW** (`SeoOverrideEditor.test.tsx` étendu) :

- Avec MSW mockant `/api/admin/media`, l'éditeur peut sélectionner une image et la sauvegarder.
- L'image apparaît en preview Facebook.

**Playwright** : `apps/web/e2e/admin/seo-og-image-picker.spec.ts` — ouvre éditeur produit, sélectionne image, save, recharge, vérifie persistence.

### 4.4 Phase 3 — Audit log panel

**Vitest** (`SeoAuditLogPanel.test.tsx`) :

- Rend liste d'events fournie ; chaque event a date, actor, action, target.
- Clic « Charger plus » appelle `onLoadMore(cursor)`.
- Filtre action → seuls events matching s'affichent.
- État vide affiche le message « Aucune action récente. »

**Vitest + MSW** :

- `/api/admin/seo/audit-log` mocké renvoie une page d'events ; panel les affiche.

**Playwright** : navigate `/admin/seo/audit-log`, vérifie présence d'au moins un event après une action SEO.

### 4.5 Phase 4 — OG image dynamique

**Vitest unit** (`og-image.schemas.test.ts`) :

- `ogImageQuerySchema` valide `{ template, title, theme }` ; rejette title vide, template inconnu.
- `theme` défaut `sauge` si non fourni.

**Vitest** (`og-image-resolver.test.ts`) :

- `resolveOgImageForRoute` retourne `{kind: 'static'}` si `ogImageMediaId` set.
- Retourne `{kind: 'dynamic'}` si `ogImageTemplate` set ET flag actif.
- Retourne fallback SVG si aucun.

**Vitest** (`ogImageGenerator.test.ts`) :

- Pas de test runtime edge (limites Vitest) — on teste la fonction de composition JSX `renderTemplate(args)` en isolant.
- Vérifie que le template `product` contient le title et le eyebrow dans le JSX rendu.

**Playwright** : `apps/web/e2e/og/dynamic-og.spec.ts` — fetch `/api/og/product?title=Le%20Kit&v=2026-05`, assert status 200, content-type `image/png`, taille raisonnable (< 200 KB).

### 4.6 Phase 5 — SEO scope component

**Vitest unit** (`component-resolve.test.ts`) :

- `resolvePageWithComponents('product', 'le-kit', [{componentKey: 'kit-hero'}])`
  - Sans override composant → identique à `resolveSeoMetadata` page.
  - Avec override composant title → title du composant gagne, autres champs viennent de page.
  - Si flag désactivé → identique à `resolveSeoMetadata` page.

**Vitest** (`getActiveComponentOverrides.test.ts`) :

- Batch fetch retourne map keyed par targetKey.
- Vide map si aucun composant fourni.

**Vitest snapshot** (`generateMetadata` `/kit`) :

- Mock DB pour fournir override composant.
- Snapshot du `Metadata` retourné, comparé à un fichier `__snapshots__/kit-metadata.snap`.

**Playwright** : `apps/web/e2e/seo/kit-component-override.spec.ts`
- Pre-test : insère override composant via API admin (auth fixture).
- Visite `/kit`, lit `<title>`, vérifie qu'il contient le title du composant.
- Cleanup : supprime l'override.

### 4.7 Phase 6 — Backlog

Tests rédigés au moment de l'implémentation. Modèles :

- Vitest middleware pour UTM strip + trailing slash.
- Vitest pour `Cache-Control` headers.

## 5. Tests de non-régression (existants à protéger)

Tests existants à conserver verts à chaque PR :

| Fichier | Sujet | Risque de casse |
|---|---|---|
| `apps/web/src/lib/seo/resolve.test.ts` | Cascade override → settings → defaults | Élevé (phase 5 touche `resolve`) |
| `apps/web/src/lib/seo/schemas.test.ts` | Zod validation | Moyen (ajout phase 4) |
| `apps/web/src/lib/db/queries/seo.test.ts` | CRUD | Moyen (ajout phase 3 + 5) |
| `apps/web/src/components/admin/seo/SeoOverrideEditor.test.tsx` | Éditeur | Élevé (phase 2 + 4) |
| `apps/web/src/components/admin/seo/SeoLinterPanel.test.tsx` | Linter | Faible |
| `apps/web/src/app/sitemap.test.ts` | Sitemap | Moyen (phase 1) |
| `apps/web/src/app/robots.test.ts` | Robots | Faible |
| `apps/web/src/lib/seo/json-ld.test.tsx` | JSON-LD helpers | Faible |
| `apps/web/e2e/seo/json-ld.spec.ts` | JSON-LD E2E | Moyen |

Stratégie : avant chaque commit, `pnpm vitest run` et `pnpm playwright test --grep @seo`.

## 6. Couverture

### 6.1 Cibles

- `lib/seo/**` : 90 % branches.
- `lib/db/queries/seo.ts` : 85 % branches.
- `components/admin/seo/**` : 85 % branches.
- `app/api/admin/seo/**` : 80 % branches.

### 6.2 Mesure

```bash
cd apps/web
pnpm vitest run --coverage
```

Configuration `vitest.config.ts` :

```ts
coverage: {
  reporter: ['text', 'html', 'lcov'],
  include: [
    'src/lib/seo/**',
    'src/lib/db/queries/seo.ts',
    'src/components/admin/seo/**',
    'src/app/api/admin/seo/**',
  ],
  thresholds: {
    branches: 85,
    functions: 90,
    lines: 90,
    statements: 90,
  },
}
```

Échec si seuils non atteints → bloque le merge en CI.

## 7. CI

`.github/workflows/test.yml` (extrait, vérifier alignement avec existant) :

```yaml
jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web typecheck
      - run: pnpm --filter web vitest run --coverage
      - uses: codecov/codecov-action@v4

  playwright:
    runs-on: ubuntu-latest
    needs: vitest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web build
      - run: pnpm exec playwright install --with-deps
      - run: pnpm --filter web playwright test --grep @seo
```

## 8. Tags Playwright

Convention :

- `@seo` — tous tests SEO (filtrage rapide).
- `@admin-seo` — tests admin uniquement.
- `@public-seo` — tests rendu public.
- `@og` — tests OG image.
- `@a11y` — tests accessibilité.

## 9. Données de test

### 9.1 Seed minimal

```ts
// apps/web/e2e/fixtures/seed.ts
export async function seedSeoTestData() {
  await db.insert(seoSettings).values({ id: 'singleton', siteName: 'FemiGlow Test', ... });
  await db.insert(seoOverrides).values([
    { id: 'ov_kit', scope: 'product', targetKey: 'le-kit', locale: 'fr-MA', title: 'Test Kit', publishedAt: new Date() },
  ]);
}
```

Exécuté avant chaque suite E2E SEO ; cleanup avec `afterAll`.

### 9.2 Auth fixture

```ts
// apps/web/e2e/fixtures/admin-auth.ts
export const adminAuth = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/admin/login');
    await page.fill('[name=email]', 'admin@test.local');
    await page.fill('[name=password]', 'test-password');
    await page.click('button[type=submit]');
    await page.waitForURL('/admin');
    await use(page);
  },
});
```

## 10. Anti-flake

- Pas de `setTimeout` arbitraire. Toujours `await page.waitFor*` ou `expect.poll`.
- Réseau : mocker `/api/og` en E2E pour éviter latence edge.
- Reset DB entre suites.
- `--workers=1` sur les suites qui touchent l'état DB.
- `--retries=2` en CI uniquement (pas en local) pour amortir le bruit infra.
