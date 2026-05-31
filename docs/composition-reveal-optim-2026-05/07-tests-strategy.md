# 07 — Stratégie de tests

Vitest (unit + integration MSW) + Playwright (E2E + a11y). Pyramide classique. Test-first sur la logique métier. Couverture cible 90 % sur `components/kit/Composition*` + `lib/composition/**` + `lib/schemas/product.ts`.

## 1. Pyramide

```
         +-------------------+
         |  E2E Playwright   |  ~ 5-8 specs
         +-------------------+
        +---------------------+
        |  Integration (MSW)  |  ~ 15 specs
        +---------------------+
       +-----------------------+
       |   Unit (Vitest)       |  ~ 60 specs
       +-----------------------+
```

Cible : 70 % unit, 22 % MSW, 8 % E2E.

## 2. Outillage

| Couche | Outil | Localisation |
|---|---|---|
| Unit | Vitest + Testing Library | Co-localisée `.test.ts(x)` |
| Integration | Vitest + MSW v2 | À côté + setup global |
| E2E | Playwright | `apps/web/e2e/composition/*.spec.ts` |
| A11y | `@axe-core/playwright` | `apps/web/e2e/composition/a11y.spec.ts` |
| Snapshot | Vitest snapshot + Playwright screenshot (visual regression) | Inline |

## 3. Conventions

### 3.1 Nommage

- Fichier : `<source>.test.ts(x)` à côté de `<source>.ts(x)`.
- Describe : nom du composant/fonction.
- It : phrase complète en français, commence par « doit ».

### 3.2 Fixtures partagées

```ts
// apps/web/src/test/fixtures/composition.ts
import type { SubProduct } from '@/lib/schemas';

export function makeSubProduct(overrides: Partial<SubProduct> = {}): SubProduct {
  return {
    id: '1-paste',
    name: 'Paste',
    volume: '15 g',
    shortDescription:
      'Crème onctueuse, sauge verte. Une noisette filme dix doigts.',
    sensation: 'Tiède au contact.',
    accentColor: 'sauge',
    image: {
      src: '/uploads/paste.jpg',
      alt: 'Pot Paste FemiGlow',
      width: 800,
      height: 1000,
    },
    ingredients: [
      { name: 'Cera Alba', inci: 'Cera Alba', function: 'filmogène', origin: 'Atlas', percent: 12 },
    ],
    certifications: [{ label: 'Halal', issuer: 'Halal Cosmetics Council' }],
    ...overrides,
  };
}
```

## 4. Tests par phase

### 4.1 Phase 0 — Quick wins visuels

Aucun test required (cosmétique pur). Reset CSS sur le snapshot HTML acceptable.

### 4.2 Phase 1 — Schema étendu

`apps/web/src/lib/schemas/product.test.ts` (nouveau, ~12 cas) :

```ts
describe('subProductSchema — extension Kolenda', () => {
  it('accepte un sub-produit sans sensation (rétrocompat)', () => { /* ... */ });
  it('accepte sensation avec point final', () => { /* ... */ });
  it('accepte sensation avec point d\'exclamation', () => { /* ... */ });
  it('accepte sensation avec guillemet français »', () => { /* ... */ });
  it('rejette sensation sans ponctuation', () => { /* ... */ });
  it('rejette sensation vide', () => { /* ... */ });
  it('rejette sensation > 80 chars', () => { /* ... */ });
  it('accepte accentColor sauge/petale/ciel/champagne', () => { /* ... */ });
  it('rejette accentColor inconnu', () => { /* ... */ });
  it('accepte sub-produit sans accentColor (fallback champagne au rendu)', () => { /* ... */ });
  it('accepte contextualImage optionnelle', () => { /* ... */ });
  it('rejette contextualImage sans alt', () => { /* ... */ });
});
```

`apps/web/src/data/mock/kit.test.ts` (nouveau, ~3 cas) :

```ts
describe('mockKitPageContent', () => {
  it('passe la validation kitPageContentSchema', () => { /* ... */ });
  it('a exactement 3 sous-produits', () => { /* ... */ });
  it('chaque sous-produit a sensation et accentColor renseignés (post-phase 1)', () => { /* ... */ });
});
```

### 4.3 Phase 2 — `CompositionCard` extrait

`apps/web/src/components/kit/CompositionCard.test.tsx` (nouveau, ~12 cas) :

```ts
describe('CompositionCard', () => {
  describe('rendu de base', () => {
    it('rend le nom et le volume inline (« Paste · 15 g »)', () => { /* ... */ });
    it('rend la sensation entre guillemets si présente', () => { /* ... */ });
    it('rend SANS sensation si absente du subProduct', () => { /* ... */ });
    it('rend la pastille numérotée formatée 01 / 02 / 03', () => { /* ... */ });
    it('applique la couleur d\'accent selon accentColor', () => { /* ... */ });
    it('utilise champagne en fallback si accentColor manque', () => { /* ... */ });
    it('rend le lien « Lire le détail » avec href attendu', () => { /* ... */ });
  });
  describe('a11y', () => {
    it('pastille marquée aria-hidden', () => { /* ... */ });
    it('lien focus-visible', () => { /* ... */ });
  });
  describe('animation', () => {
    it('motion.article a les transitions Framer attendues', () => { /* ... */ });
  });
});
```

`apps/web/src/lib/composition/copy.test.ts` (nouveau, ~10 cas) :

```ts
describe('buildCardHeader', () => {
  it('formate « Paste · 15 g »', () => { /* ... */ });
  it('lowercase le volume (« 15 G » → « 15 g »)', () => { /* ... */ });
  it('trim les espaces autour du volume', () => { /* ... */ });
});
describe('formatSensation', () => {
  it('encadre avec « … »', () => { /* ... */ });
  it('retourne null si sensation absente', () => { /* ... */ });
});
describe('formatIndex', () => {
  it('pad 0 → « 01 »', () => { /* ... */ });
  it('pad 9 → « 10 » pour index 9', () => { /* ... */ });
});
describe('resolveAccentHex', () => {
  it('mappe sauge → #A8B89E', () => { /* ... */ });
  it('fallback champagne pour undefined', () => { /* ... */ });
});
```

### 4.4 Phase 3 — Crossfade

`apps/web/src/components/kit/MediaCrossfade.test.tsx` (nouveau, ~8 cas) :

```ts
describe('MediaCrossfade', () => {
  it('rend uniquement isolated si contextual absent', () => { /* ... */ });
  it('rend les deux superposés si contextual présent', () => { /* ... */ });
  it('toggle au click', () => { /* ... */ });
  it('toggle au keydown Enter', () => { /* ... */ });
  it('toggle au keydown Space', () => { /* ... */ });
  it('expose role="button" et aria-pressed quand interactif', () => { /* ... */ });
  it('aria-hidden sur layer inactive', () => { /* ... */ });
  it('respecte prefers-reduced-motion (pas de transition)', () => { /* ... */ });
});
```

### 4.5 Phase 4 — Animations

`CompositionCard.test.tsx` étendu :

```ts
describe('CompositionCard — motion', () => {
  it('initial { opacity: 0, y: 12 }', () => { /* ... */ });
  it('whileInView { opacity: 1, y: 0 }', () => { /* ... */ });
  it('delay = index × 0.12', () => { /* ... */ });
  it('duration 0.6, viewport once: true', () => { /* ... */ });
});
```

### 4.6 Phase 5 — Vue éclatée

`CompositionReveal.test.tsx` (étendu) :

```ts
describe('CompositionReveal — vue éclatée', () => {
  it('rend la figure si exploded.image fourni', () => { /* ... */ });
  it('omet la figure si exploded absent (rétrocompat)', () => { /* ... */ });
});
```

### 4.7 Phase 6 — Admin

Vitest + MSW :

```ts
// apps/web/src/components/admin/kit/KitCompositionEditor.test.tsx
describe('KitCompositionEditor', () => {
  it('pré-remplit le form depuis l\'override existant', () => { /* ... */ });
  it('Save appelle PATCH /api/admin/kit/composition/[id] avec body Zod valide', () => { /* ... */ });
  it('affiche les erreurs de validation Zod côté UI', () => { /* ... */ });
  it('Publish désactivé si dirty', () => { /* ... */ });
  it('Reset ouvre la modale RESET-<id>', () => { /* ... */ });
  it('Aperçu live met à jour à chaque keystroke', () => { /* ... */ });
});

// apps/web/src/lib/composition/composition-resolver.test.ts
describe('resolveKitComposition', () => {
  it('retombe sur mock si aucun override', () => { /* ... */ });
  it('applique override DB publié', () => { /* ... */ });
  it('ignore override drafté (publishedAt null)', () => { /* ... */ });
});
```

API routes :

```ts
// apps/web/src/app/api/admin/kit/composition/[id]/route.test.ts
describe('PATCH /api/admin/kit/composition/[id]', () => {
  it('401 sans session admin', () => { /* ... */ });
  it('422 si body invalide Zod', () => { /* ... */ });
  it('200 + draft persisté si body valide', () => { /* ... */ });
});
```

### 4.8 Phase 7 — Playwright E2E

```ts
// apps/web/e2e/composition/render.spec.ts
test.describe('Composition rendering', () => {
  test('@composition rend 3 cards avec numéros 01/02/03', async ({ page }) => { /* ... */ });
  test('@composition fond sable + bordure gris-sauge', async ({ page }) => { /* ... */ });
  test('@composition lien « Lire le détail » scrolle vers INCI', async ({ page }) => { /* ... */ });
});

// apps/web/e2e/composition/interaction.spec.ts
test.describe('Composition interactions', () => {
  test('@composition hover desktop déclenche crossfade', async ({ page }) => { /* ... */ });
  test('@composition tap mobile toggle crossfade', async ({ page, viewport }) => { /* ... */ });
  test('@composition navigation clavier (Tab + Enter)', async ({ page }) => { /* ... */ });
});

// apps/web/e2e/composition/a11y.spec.ts
test('@composition @a11y axe sur /kit#composition-title', async ({ page }) => { /* ... */ });
```

## 5. Non-régression (tests existants à préserver)

| Test | Risque de casse |
|---|---|
| `feed.xml/route.test.ts` (mock `getKitPageContent`) | Moyen (extension schema) |
| `feed-xml-endpoint.test.ts` | Moyen |
| `lib/products/feed/kit-feed.test.ts` | Faible (n'utilise pas la composition) |

Stratégie : **avant chaque commit**, `pnpm vitest run` complet sur ces 3 fichiers.

## 6. Couverture

### 6.1 Cibles

| Module | Branches | Functions | Lines |
|---|---|---|---|
| `lib/schemas/product.ts` | 95 % | 100 % | 95 % |
| `lib/composition/copy.ts` | 95 % | 100 % | 95 % |
| `lib/composition/media.ts` | 80 % | 100 % | 90 % |
| `components/kit/Composition*.tsx` | 85 % | 95 % | 90 % |
| `components/sections/CompositionReveal.tsx` | 80 % | 100 % | 90 % |
| `components/admin/kit/**` | 80 % | 90 % | 85 % |

### 6.2 Configuration vitest

Étendre `apps/web/vitest.config.ts` :

```ts
coverage: {
  ...,
  include: [
    'src/lib/schemas/product.ts',
    'src/lib/composition/**',
    'src/components/kit/Composition*.tsx',
    'src/components/sections/CompositionReveal.tsx',
    'src/components/admin/kit/**',
  ],
  thresholds: { branches: 85, functions: 95, lines: 90, statements: 90 },
}
```

## 7. CI

Ajouter au workflow existant (`.github/workflows/ci.yml`) :

```yaml
- name: Composition tests
  run: pnpm --filter web vitest run \
    src/components/kit \
    src/components/sections/CompositionReveal \
    src/lib/composition \
    src/lib/schemas/product \
    src/data/mock/kit \
    src/components/admin/kit

- name: Playwright composition
  run: pnpm --filter web playwright test --grep '@composition'
```

## 8. Tags Playwright

- `@composition` — tous tests composition.
- `@composition-render` — rendu visuel.
- `@composition-interaction` — hover / tap / kbd.
- `@composition-admin` — éditeur admin (phase 6).
- `@a11y` — accessibilité.

## 9. Données de test E2E

### 9.1 Seed

```ts
// apps/web/e2e/fixtures/seed-composition.ts
export async function seedCompositionTestData() {
  // Met le mock TS dans l'état attendu (sensations remplies, accentColors set).
  // En phase 6, seed l'override DB d'un sous-produit pour tester le cascade.
}
```

### 9.2 Fixture auth admin

Réutilise `apps/web/e2e/fixtures/admin-auth.ts` du dossier SEO (phase 3).

## 10. Anti-flake

- Pas de `setTimeout` arbitraire. `expect.poll` ou `waitFor` uniquement.
- Mocker `/api/admin/kit/composition/*` côté MSW pour les tests intégration.
- Reset state DB entre suites E2E (`afterAll`).
- `--workers=1` pour les suites E2E qui touchent l'override DB.
- `--retries=2` en CI uniquement, jamais en local (signal de bug).

## 11. Visual regression (optionnel, P4 backlog)

Playwright `toHaveScreenshot` sur `section#composition-title` avec un threshold 0,3 %. Détecte les régressions visuelles sur la grille, bordures, pastilles.

Stocké dans `apps/web/e2e/composition/__snapshots__/composition-{viewport}.png`. À actualiser manuellement après une refonte intentionnelle (`--update-snapshots`).

## 12. Métriques

| Métrique | Outil | Cadence |
|---|---|---|
| Couverture | Codecov via CI | À chaque PR |
| Flake rate | GitHub Actions reruns | Hebdo |
| Latence Playwright @composition | Reporter Playwright | À chaque CI |
| Axe violations | A11y spec | À chaque PR |
