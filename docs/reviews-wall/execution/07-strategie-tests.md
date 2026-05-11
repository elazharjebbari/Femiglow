# 07 — Stratégie de tests

Pyramide de tests, ratios, ce que chaque niveau couvre, conventions de naming, organisation des fixtures. Sert de boussole avant de plonger dans les catalogues détaillés (`08`, `09`, `10`).

## 1. Pyramide cible

```
              ▲
              │   ~5 % E2E Playwright
              │     (parcours utilisateurs, smoke admin)
              ▼
       ╔══════════════╗
       ║              ║
       ║   ~25 %      ║   Integration MSW
       ║              ║     (composants front avec API simulée)
       ╠══════════════╣
       ║              ║
       ║              ║
       ║   ~70 %      ║   Unitaire Vitest/Jest
       ║              ║     (composants purs, hooks, services, queries)
       ║              ║
       ╚══════════════╝
```

Cible globale au lancement : **150 à 200 tests automatisés** pour le composant complet.

## 2. Périmètre par niveau

### 2.1 Unitaire (Vitest)

**Ce qu'il teste** :

- Logique pure : fonctions, services, hooks isolés.
- Composants UI purs (props in, JSX out).
- Validations Zod, schemas.
- Sanitization, auto-flags, calculs d'agrégation.
- Queries Drizzle (avec test DB ou pg-mem).
- Vision ML faces (avec fixtures images).
- Helpers d'accessibilité.

**Outils** :

- `vitest` runner.
- `@testing-library/react` pour DOM.
- `vitest-axe` pour audit a11y intégré.
- `@testing-library/user-event` pour interactions.
- `vi.mock()` pour mocks ciblés.

**Convention** : fichier suffixé `.test.ts` ou `.test.tsx` à côté du fichier testé.

```
components/sections/rituals/RitualCard.tsx
components/sections/rituals/__tests__/RitualCard.test.tsx
```

### 2.2 Intégration (MSW)

**Ce qu'il teste** :

- Composants `*Bound` qui fetch (RitualsModuleBound, RitualsWallDrawer).
- Hooks de fetch (useRitualsList, useRitualsSummary).
- Flow wizard avec upload simulé.
- Comportement face aux réponses 4xx/5xx.
- Pagination cursor.
- Rate-limit côté client (réception 429).

**Outils** :

- `msw` v2 pour intercepter `fetch`.
- Handlers organisés dans `apps/web/src/test/msw/handlers/`.
- Server MSW dans `apps/web/src/test/msw/server.ts`.
- Setup global dans `apps/web/vitest.setup.ts`.

**Convention** : tests dans le même fichier que les unitaires mais avec setup MSW spécifique.

```ts
import { server } from '@/test/msw/server';
import { ritualHandlers } from '@/test/msw/handlers/rituals';

beforeEach(() => server.use(...ritualHandlers.default));
```

### 2.3 E2E (Playwright)

**Ce qu'il teste** :

- Parcours utilisateur complet : visite `/kit` → ouvre drawer → filtre → soumet.
- Parcours admin : login → queue → approuve → vérifie publication.
- CSP headers, focus management complet, navigation clavier.
- A/B test exposition.
- Performance budget (LCP).

**Outils** :

- `@playwright/test` existant.
- BDD réelle (test DB Neon dédiée pour CI, ou local dev).
- Pas de mocks (full stack).

**Convention** : `apps/web/e2e/rituals-*.spec.ts`.

## 3. Couverture cible

### 3.1 Par couche

| Couche | Couverture cible |
| --- | --- |
| `lib/rituals/` (services) | ≥ 95 % |
| `lib/db/queries/rituals.ts` | ≥ 90 % |
| `lib/schemas/rituals.ts` | 100 % (chaque branche du schema testée) |
| `components/sections/rituals/` | ≥ 85 % (lignes + branches) |
| `app/api/rituals/*` | ≥ 90 % |
| `app/api/admin/rituals/*` | ≥ 85 % |
| `app/admin/rituals/*` | ≥ 80 % |

### 3.2 Configuration Vitest

`apps/web/vitest.config.ts` (extrait) :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        'src/lib/rituals/**': { lines: 95, functions: 95, branches: 90, statements: 95 },
        'src/lib/db/queries/rituals.ts': { lines: 90 },
        'src/components/sections/rituals/**': { lines: 85, branches: 80 },
      },
    },
  },
});
```

Le seuil global du projet n'est pas augmenté ; on cible uniquement les fichiers rituals.

## 4. Organisation des fixtures

### 4.1 Fixtures TypeScript

`apps/web/src/test/fixtures/rituals.ts` :

```ts
export const ritualFixtures = {
  basic: {
    publicSlug: 'amal-001',
    body: 'Trois mois et l’ongle a retrouvé sa nervure. J’ai cessé de le forcer.',
    wouldRecommend: 'oui',
    ritualTags: ['ongles-plus-lisses', 'plus-de-casse'],
    signature: { firstName: 'Amal', city: 'Rabat', initiatedSince: '2026-02', isAnonymous: false, verifiedPurchase: true },
    language: 'fr' as const,
    photos: [],
    publishedAt: '2026-05-01T10:00:00Z',
  },
  withPhoto: { /* ... */ },
  anonymous: { /* ... */ },
  hesitant: { /* would_recommend: hesite */ },
  longQuote: { /* body 250+ mots */ },
  faceDetected: { /* photos avec faces_status REJECTED_FACE */ },
} satisfies Record<string, RitualTestimonialPublic>;

export function makeRitualFixture(overrides: Partial<RitualTestimonialPublic> = {}): RitualTestimonialPublic {
  return { ...ritualFixtures.basic, ...overrides };
}

export function makeRitualListFixture(count: number): RitualTestimonialPublic[] {
  return Array.from({ length: count }, (_, i) =>
    makeRitualFixture({ publicSlug: `fixture-${i.toString().padStart(3, '0')}` })
  );
}
```

### 4.2 Fixtures images

`apps/web/src/lib/rituals/__tests__/fixtures/` :

| Fichier | Contenu |
| --- | --- |
| `hands-only.jpg` | Photo de mains, marbre cream, lumière naturelle |
| `face-frontal.jpg` | Photo de visage frontal (pour test rejet) |
| `face-partial-hijab.jpg` | Visage avec hijab, regard de côté (test MANUAL_REVIEW) |
| `face-partial-smile.jpg` | Sourire et lèvres, pas de regard frontal |
| `corrupted.jpg` | Fichier image corrompu (pour test edge case) |
| `too-small.jpg` | 400×400 px (en-dessous du minimum 600) |

Fixtures réelles à fournir par la maison ou générer avec un service open source (ex. Unsplash + retouche).

## 5. Setup global

### 5.1 `vitest.setup.ts`

```ts
import { server } from '@/test/msw/server';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock router Next.js par défaut
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock framer-motion pour tests rapides (pas d'animation)
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
```

### 5.2 Helper de rendu

`apps/web/src/test/render.tsx` :

```tsx
import { render as rtlRender } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function render(ui: React.ReactElement, options?: { queryClient?: QueryClient }) {
  const queryClient = options?.queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return rtlRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    { ...options }
  );
}
```

## 6. Test DB pour queries Drizzle

### 6.1 Option A — pg-mem (rapide, in-memory)

```ts
import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/pg-proxy';

const db = newDb().adapters.createPg();
```

Limitation : `REFRESH MATERIALIZED VIEW CONCURRENTLY` n'est pas supporté.

### 6.2 Option B — DB Neon test dédiée

`.env.test` avec `DATABASE_URL_TEST=postgres://...`. Migration appliquée avant chaque suite, truncate entre chaque test.

```ts
beforeAll(async () => {
  await runMigrations(testDb);
});

beforeEach(async () => {
  await truncateTables(testDb, ['ritual_testimonials', 'ritual_testimonial_photos', 'ritual_audit_log']);
});
```

**Recommandation** : option B pour les tests d'intégration BDD (plus fiable).

## 7. Test runner et CI

### 7.1 Scripts pnpm

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:rituals": "vitest run src/lib/rituals src/components/sections/rituals src/app/api/rituals",
    "test:e2e": "playwright test",
    "test:e2e:rituals": "playwright test e2e/rituals-*.spec.ts"
  }
}
```

### 7.2 GitHub Actions

```yaml
- name: Tests unitaires
  run: pnpm test:coverage
- name: Coverage check
  run: |
    if grep -E "lines.*[0-9]+%" coverage/coverage-summary.json | ...; then
      echo "Coverage below threshold"; exit 1
    fi
- name: E2E
  run: pnpm test:e2e
- name: axe-core CI
  run: pnpm test --reporter=verbose | grep "axe-core: passed"
```

## 8. Test-driven discipline

### 8.1 Workflow

Pour chaque tâche du runbook (`00-runbook.md`) :

```
1. Lire la phase et ses références.
2. Créer le fichier .test.ts(x) AVANT le fichier de prod.
3. Écrire les 3-5 cas d'usage attendus en describe / it.
4. Lancer test, voir tous les it() rouges.
5. Implémenter le minimum pour rendre les tests verts.
6. Refactor (refactor while green).
7. Ajouter les edge cases si manquants.
8. Lancer le suite complète : aucune régression.
9. Commit + PR.
```

### 8.2 Règles inviolables

- **Pas de PR sans tests** pour le code ajouté.
- **Coverage globale ne descend jamais.**
- **Aucun test `skip` ou `only` mergé.**
- **Tests rouges en CI bloquent le merge.**

## 9. Patterns récurrents

### 9.1 Test d'un composant pur

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import { axe } from 'vitest-axe';
import { ritualFixtures } from '@/test/fixtures/rituals';
import { RitualCard } from '../RitualCard';

describe('RitualCard', () => {
  it('rend la citation', () => {
    render(<RitualCard data={ritualFixtures.basic} variant="default" />);
    expect(screen.getByText(/Trois mois/)).toBeInTheDocument();
  });

  it('passe l’audit axe-core', async () => {
    const { container } = render(<RitualCard data={ritualFixtures.basic} variant="default" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

### 9.2 Test d'un hook avec fetch

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { ritualHandlers } from '@/test/msw/handlers/rituals';
import { useRitualsList } from '../use-rituals-list';

describe('useRitualsList', () => {
  it('fetch la première page', async () => {
    server.use(...ritualHandlers.listPage1);
    const { result } = renderHook(() => useRitualsList('pack-femiglow', {}), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.pages[0].data).toHaveLength(12);
  });

  it('charge la 2e page sur fetchNextPage', async () => {
    server.use(...ritualHandlers.listPage1, ...ritualHandlers.listPage2);
    const { result } = renderHook(() => useRitualsList('pack-femiglow', {}), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('success'));
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });
});
```

### 9.3 Test E2E Playwright

```ts
import { test, expect } from '@playwright/test';

test.describe('Rituals wall — visiteur', () => {
  test('peut lire et filtrer les rituels', async ({ page }) => {
    await page.goto('/kit');
    await expect(page.getByRole('heading', { name: /Les voix de la maison/ })).toBeVisible();
    await page.click('text=Lire les');
    const drawer = page.getByRole('dialog', { name: /Rituels partagés/ });
    await expect(drawer).toBeVisible();
    await page.click('text=Avec photos');
    await expect(page.locator('[data-testid="ritual-card"]')).toHaveCount(1, { timeout: 5000 });
  });
});
```

## 10. Méta-tests : ce qu'on teste sur les tests

### 10.1 Mutation testing (optionnel)

`stryker-mutator` peut être lancé une fois par release pour détecter les zones sous-testées. Coût élevé en CI, donc usage ponctuel.

### 10.2 Snapshot review

Éviter les snapshots automatiques. Préférer des assertions explicites sur le DOM.

Si snapshots inévitables (ex. générateur HTML d'email) : 1 snapshot par template, mise à jour manuelle uniquement après revue.

### 10.3 Test du temps de test

CI cible : suite complète Vitest < 3 min. Si dépassé, profile et optimise (parallélisation, mocks plus légers).

## 11. Convention de naming

| Type | Naming |
| --- | --- |
| Fichier test unit | `Composant.test.tsx` (collocation) |
| Fichier test integration | Idem, distinction par contenu (MSW handlers utilisés) |
| Fichier test E2E | `rituals-{scenario}.spec.ts` |
| describe | Nom du composant ou fonction testée |
| it | Phrase descriptive en français : `it('affiche le badge si signal oui', ...)` |
| Fixture | `makeXxxFixture(overrides)` |
| Handler MSW | `ritualHandlers.scenarioName` |

## 12. Synthèse — règles d'or des tests

1. **Tests écrits en même temps que le code**, jamais après.
2. **Pyramide respectée** : 70 % unit, 25 % integration, 5 % E2E.
3. **Couverture ne descend jamais** dans `lib/rituals/**`.
4. **Aucun `skip` ou `only` mergé.**
5. **Tests rouges = PR bloquée.**
6. **axe-core dans chaque test de composant.**
7. **MSW pour tout test impliquant un fetch**, pas de `fetch` réel en unit.
8. **E2E : 5 scénarios maximum**, fortement choisis pour la valeur de signal.
9. **Fixtures centralisées**, jamais inlines dans les tests.
10. **Tests rapides** : suite < 3 min. Sinon profile et split.
