# 04 — Stratégie de tests

> Couverture vitest + playwright + MSW + axe-core. Patterns, exemples, gates de qualité. À lire **avant chaque phase** pour planifier les tests à écrire en parallèle du code.

---

## 1. Pyramide des tests

```
                ┌──────────────────────┐
                │   E2E Playwright     │  4 tests — hero desktop/mobile, gallery,
                │   (lent, intégré)    │   a11y
                ├──────────────────────┤
                │  Intégration vitest  │  6 tests — data resolvers, RSC binding,
                │  + MSW (mock fetch)  │   API routes
                ├──────────────────────┤
                │   Unit vitest + RTL  │  12+ tests — composants, hooks, helpers
                │   (rapides)          │
                └──────────────────────┘
```

**Règle d'or** : si un comportement peut être testé en unit (vitest pur), pas la peine de l'écrire en e2e. Les e2e couvrent uniquement le parcours utilisateur complet.

---

## 2. Vitest — Unit tests

### 2.1 Setup existant

Source : `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts`.

- Environment : `jsdom`
- Setup : `@testing-library/jest-dom/vitest`, cleanup auto, mocks `next/font/google`, `next/navigation`, `IntersectionObserver`, `ResizeObserver`
- Convention : tests à côté du composant, suffixe `.test.tsx`

### 2.2 Tests à écrire — Composants

#### `useGallery.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGallery } from './useGallery';

describe('useGallery', () => {
  it('initialise à 0 par défaut', () => {
    const { result } = renderHook(() => useGallery({ count: 5 }));
    expect(result.current.currentIndex).toBe(0);
  });

  it('respecte initialIndex', () => {
    const { result } = renderHook(() => useGallery({ count: 5, initialIndex: 2 }));
    expect(result.current.currentIndex).toBe(2);
  });

  it('clamp initialIndex hors borne', () => {
    const { result } = renderHook(() => useGallery({ count: 3, initialIndex: 10 }));
    expect(result.current.currentIndex).toBe(2);
  });

  it('next() wrap à 0 après le dernier', () => {
    const { result } = renderHook(() => useGallery({ count: 3, initialIndex: 2 }));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
  });

  it('prev() wrap au dernier depuis 0', () => {
    const { result } = renderHook(() => useGallery({ count: 3 }));
    act(() => result.current.prev());
    expect(result.current.currentIndex).toBe(2);
  });

  it('setIndex avec valeur négative wrap correctement', () => {
    const { result } = renderHook(() => useGallery({ count: 4 }));
    act(() => result.current.setIndex(-1));
    expect(result.current.currentIndex).toBe(3);
  });

  it('count=0 ne crash pas', () => {
    const { result } = renderHook(() => useGallery({ count: 0 }));
    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(0);
  });
});
```

#### `HeroGalleryDots.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroGalleryDots } from './HeroGalleryDots';

describe('HeroGalleryDots', () => {
  it('rend N dots', () => {
    render(<HeroGalleryDots count={5} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it("marque le dot actif via aria-current='true'", () => {
    render(<HeroGalleryDots count={3} activeIndex={1} onSelect={() => {}} />);
    const dots = screen.getAllByRole('button');
    expect(dots[1]).toHaveAttribute('aria-current', 'true');
    expect(dots[0]).not.toHaveAttribute('aria-current', 'true');
  });

  it('appelle onSelect au click', async () => {
    const onSelect = vi.fn();
    render(<HeroGalleryDots count={3} activeIndex={0} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button')[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("aria-label inclut l'ordinal et le total", () => {
    render(<HeroGalleryDots count={4} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getByLabelText(/voir l'image 3 sur 4/i)).toBeInTheDocument();
  });
});
```

#### `HeroGalleryThumbnails.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroGalleryThumbnails } from './HeroGalleryThumbnails';

const IMAGES = [
  { id: '1', src: '/1.jpg', alt: 'one', width: 100, height: 125, kind: 'product' as const },
  { id: '2', src: '/2.jpg', alt: 'two', width: 100, height: 125, kind: 'context' as const },
  { id: '3', src: '/3.jpg', alt: 'three', width: 100, height: 125, kind: 'review' as const },
];

describe('HeroGalleryThumbnails', () => {
  it('rend une vignette par image', () => {
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={0} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marque la vignette active', () => {
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={1} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')[1]).toHaveAttribute('aria-current', 'true');
  });

  it('appelle onSelect au click', async () => {
    const onSelect = vi.fn();
    render(<HeroGalleryThumbnails images={IMAGES} currentIndex={0} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole('button')[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
```

#### `HeroGallery.test.tsx` (intégration sous-composants)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroGallery } from './HeroGallery';

describe('HeroGallery', () => {
  const IMAGES_3 = [
    { id: '1', src: '/1.jpg', alt: 'a', width: 100, height: 125, kind: 'product' as const },
    { id: '2', src: '/2.jpg', alt: 'b', width: 100, height: 125, kind: 'context' as const },
    { id: '3', src: '/3.jpg', alt: 'c', width: 100, height: 125, kind: 'review' as const },
  ];

  it('ne rend rien si images vide', () => {
    const { container } = render(<HeroGallery images={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('rend juste l\'image si 1 seule', () => {
    render(<HeroGallery images={[IMAGES_3[0]]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); // pas de dots ni thumbs
  });

  it('rend dots + viewport pour N>=2 images', () => {
    render(<HeroGallery images={IMAGES_3} />);
    // Sous mobile (default jsdom mediaQuery = false), on attend des dots
    expect(screen.getByRole('region', { name: /galerie/i })).toBeInTheDocument();
  });

  it("appelle onChange à l'init", () => {
    const onChange = vi.fn();
    render(<HeroGallery images={IMAGES_3} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(0, IMAGES_3[0]);
  });
});
```

#### `AttributeChips.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttributeChips } from './AttributeChips';

describe('AttributeChips', () => {
  it('rend chaque chip', () => {
    render(<AttributeChips items={['A', 'B', 'C']} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('rend liste avec rôle list + items', () => {
    render(<AttributeChips items={['A', 'B']} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it("aria-label par défaut = 'Attributs produit'", () => {
    render(<AttributeChips items={['A']} />);
    expect(screen.getByLabelText('Attributs produit')).toBeInTheDocument();
  });

  it('ne rend rien si items vide', () => {
    const { container } = render(<AttributeChips items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

#### `SocialProofBadge.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialProofBadge } from './SocialProofBadge';

describe('SocialProofBadge', () => {
  it("affiche la note formatée à 1 décimale avec virgule (FR)", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(screen.getByText(/4,8/)).toBeInTheDocument();
  });

  it("affiche le compte d'avis", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(screen.getByText(/287 avis/i)).toBeInTheDocument();
  });

  it('utilise au singulier "1 avis"', () => {
    render(<SocialProofBadge rating={5} reviewsCount={1} />);
    expect(screen.getByText(/1 avis/i)).toBeInTheDocument();
    expect(screen.queryByText(/avis/i)?.textContent).not.toMatch(/avis(s|x)/i);
  });

  it("aria-label inclut note et compte", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={287} />);
    expect(
      screen.getByLabelText(/note 4,8 sur 5 basée sur 287 avis/i)
    ).toBeInTheDocument();
  });

  it("rend 5 étoiles dont 4 pleines et 1 demi pour 4.5", () => {
    render(<SocialProofBadge rating={4.5} reviewsCount={10} />);
    const stars = screen.getAllByTestId('proof-star');
    expect(stars).toHaveLength(5);
    expect(stars.filter((s) => s.dataset.fill === 'full')).toHaveLength(4);
    expect(stars.filter((s) => s.dataset.fill === 'half')).toHaveLength(1);
  });

  it("est un span non-cliquable par défaut", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={10} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it("devient lien si href fourni", () => {
    render(<SocialProofBadge rating={4.8} reviewsCount={10} href="#reviews" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#reviews');
  });
});
```

#### `TrustRow.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustRow } from './TrustRow';

describe('TrustRow', () => {
  it('rend chaque item séparé par le séparateur par défaut', () => {
    render(<TrustRow items={['A', 'B', 'C']} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getAllByText('·')).toHaveLength(2);
  });

  it('séparateur custom', () => {
    render(<TrustRow items={['A', 'B']} separator="—" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it("ne rend rien si items vide", () => {
    const { container } = render(<TrustRow items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

### 2.3 Tests à écrire — Helpers data

#### `kit-hero-gallery.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetMemoryStore, memoryStore } from '@/lib/db/client';
import { getKitHeroGalleryImages } from './kit-hero-gallery';

describe('getKitHeroGalleryImages', () => {
  beforeEach(() => {
    _resetMemoryStore();
  });

  it('retourne uniquement le slot primary si aucune review photo', async () => {
    const images = await getKitHeroGalleryImages('kit-femiglow');
    expect(images.filter((i) => i.kind === 'review')).toHaveLength(0);
    expect(images.find((i) => i.kind === 'product')).toBeDefined();
  });

  it('inclut les review photos triées par display_order', async () => {
    memoryStore().productReviewPhotos.set('rp_1', {
      id: 'rp_1', productId: 'kit-femiglow', src: '/r1.jpg', alt: 'one',
      width: 800, height: 1000, displayOrder: 2, status: 'published',
      reviewId: null, blurDataUrl: null, reviewerInitials: 'I.R.', reviewerCity: 'Rabat',
      createdAt: new Date(), updatedAt: new Date(),
    });
    memoryStore().productReviewPhotos.set('rp_2', {
      id: 'rp_2', productId: 'kit-femiglow', src: '/r2.jpg', alt: 'two',
      width: 800, height: 1000, displayOrder: 1, status: 'published',
      reviewId: null, blurDataUrl: null, reviewerInitials: 'S.C.', reviewerCity: 'Casa',
      createdAt: new Date(), updatedAt: new Date(),
    });
    const images = await getKitHeroGalleryImages('kit-femiglow');
    const reviews = images.filter((i) => i.kind === 'review');
    expect(reviews).toHaveLength(2);
    expect(reviews[0].src).toBe('/r2.jpg'); // displayOrder=1 first
  });

  it("ignore les photos status='draft'", async () => {
    memoryStore().productReviewPhotos.set('rp_3', {
      id: 'rp_3', productId: 'kit-femiglow', src: '/r3.jpg', alt: 'd',
      width: 800, height: 1000, displayOrder: 0, status: 'draft',
      reviewId: null, blurDataUrl: null, reviewerInitials: null, reviewerCity: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const images = await getKitHeroGalleryImages('kit-femiglow');
    expect(images.filter((i) => i.kind === 'review')).toHaveLength(0);
  });

  it("ne retourne pas les photos d'un autre produit", async () => {
    memoryStore().productReviewPhotos.set('rp_x', {
      id: 'rp_x', productId: 'OTHER', src: '/x.jpg', alt: 'x',
      width: 800, height: 1000, displayOrder: 0, status: 'published',
      reviewId: null, blurDataUrl: null, reviewerInitials: null, reviewerCity: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const images = await getKitHeroGalleryImages('kit-femiglow');
    expect(images.find((i) => i.src === '/x.jpg')).toBeUndefined();
  });
});
```

### 2.4 Couverture cible

- Composants nouveaux : **≥ 85 % lignes / 80 % branches**
- Helpers data : **≥ 90 % lignes / 85 % branches**
- Hooks : **100 % lignes / 95 % branches** (petits + critiques)

Commande : `pnpm --filter @femiglow/web test:coverage`

---

## 3. MSW — Introduction (nouveau pour ce projet)

### 3.1 Pourquoi introduire MSW maintenant ?

MSW n'était pas utilisé jusqu'à présent (memoryStore mocké à la place). Pour ce projet :

- **Pas nécessaire en V1 stricte** — les helpers data sont testés via memoryStore.
- **Recommandé pour les futures phases** (upload photos via admin, fetch reviews) — MSW devient utile quand on a des routes API à mock côté client.

**Décision** : on installe et configure MSW **mais on l'utilise uniquement pour 1-2 tests pilotes** (le helper de chargement des review images si une route API est créée). Le reste continue avec memoryStore.

### 3.2 Setup

```bash
pnpm add -D -w msw@latest
```

`apps/web/test/msw/server.ts` :

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

`apps/web/test/msw/handlers.ts` :

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/products/:id/review-photos', ({ params }) => {
    if (params.id === 'kit-femiglow') {
      return HttpResponse.json({
        photos: [
          { id: 'mock_1', src: '/mock-r1.jpg', alt: 'mock', width: 800, height: 1000 },
        ],
      });
    }
    return HttpResponse.json({ photos: [] });
  }),
];
```

`apps/web/vitest.setup.ts` (étendre) :

```typescript
import { server } from './test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 3.3 Test pilote utilisant MSW

```typescript
// apps/web/src/lib/products/review-photos-client.test.ts
import { describe, it, expect } from 'vitest';
import { fetchReviewPhotos } from './review-photos-client';

describe('fetchReviewPhotos (via MSW)', () => {
  it('parse la réponse correctement', async () => {
    const photos = await fetchReviewPhotos('kit-femiglow');
    expect(photos).toHaveLength(1);
    expect(photos[0].src).toBe('/mock-r1.jpg');
  });

  it('retourne [] si produit inconnu', async () => {
    const photos = await fetchReviewPhotos('unknown');
    expect(photos).toEqual([]);
  });
});
```

> Si la route API `/api/products/:id/review-photos` n'est pas créée dans ce plan (elle ne l'est pas en V1 — données passées en RSC props), ce test pilote est **différé**. La configuration MSW reste en place pour les futures phases.

---

## 4. Playwright — E2E tests

### 4.1 Setup existant

Source : `apps/web/playwright.config.ts`. Projets configurés :

- `setup` (auth admin)
- `chromium-desktop` (1280 × 800)
- `chromium-mobile` (375 × 812)
- Auth via storageState

### 4.2 Tests à écrire

#### `e2e/kit-hero.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Hero /kit — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('affiche les 7 éléments clés above-the-fold', async ({ page }) => {
    await page.goto('/kit');

    // Galerie principale visible
    await expect(page.getByRole('region', { name: /galerie produit/i })).toBeVisible();

    // H1
    await expect(page.getByRole('heading', { name: /pack femiglow/i, level: 1 })).toBeVisible();

    // Social proof
    await expect(page.getByText(/4,8\/5/)).toBeVisible();
    await expect(page.getByText(/287 avis/i)).toBeVisible();

    // Tagline
    await expect(page.getByText(/manucure japonaise halal/i)).toBeVisible();

    // Chips
    for (const chip of ['Sans vernis', 'Sans UV', 'Sans acétone', 'Halal']) {
      await expect(page.getByText(chip, { exact: true })).toBeVisible();
    }

    // Prix
    await expect(page.getByText(/199\s*MAD/)).toBeVisible();

    // Trust row
    await expect(page.getByText(/livraison offerte/i)).toBeVisible();

    // CTA
    await expect(page.getByRole('link', { name: /commander le rituel/i }).first()).toBeVisible();
  });

  test('thumbnails visibles et cliquables', async ({ page }) => {
    await page.goto('/kit');
    const thumbs = page.getByRole('button', { name: /voir l'image \d+ sur \d+/i });
    const count = await thumbs.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click sur la 2e thumbnail
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('navigation clavier dans la galerie', async ({ page }) => {
    await page.goto('/kit');
    const region = page.getByRole('region', { name: /galerie produit/i });
    await region.focus();
    await page.keyboard.press('ArrowRight');

    // Le second thumbnail doit être actif
    const thumbs = page.getByRole('button', { name: /voir l'image \d+ sur \d+/i });
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true');
  });

  test('a11y — zéro violation sérieuse axe-core', async ({ page }) => {
    await page.goto('/kit');
    const results = await new AxeBuilder({ page })
      .include('main') // limit au contenu principal
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter((v) =>
      v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });
});

test.describe('Hero /kit — mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('CTA visible above fold (< 700 px)', async ({ page }) => {
    await page.goto('/kit');

    const cta = page.getByRole('link', { name: /commander le rituel/i }).first();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(700); // au-dessus du fold 812 - safety margin
  });

  test('dots indicator présent', async ({ page }) => {
    await page.goto('/kit');
    const dots = page.getByRole('button', { name: /voir l'image \d+ sur \d+/i });
    expect(await dots.count()).toBeGreaterThanOrEqual(2);
  });

  test('a11y mobile', async ({ page }) => {
    await page.goto('/kit');
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter((v) =>
      v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });
});
```

### 4.3 Visual regression (optionnel — décision à prendre)

Playwright supporte `page.screenshot()` + `expect(buffer).toMatchSnapshot()`. **Pas inclus dans V1** (effort de maintenance des baselines élevé), mais à considérer si le projet a déjà un workflow visual regression.

---

## 5. Tests a11y dédiés

### 5.1 axe-core integration

Installer `@axe-core/playwright` :

```bash
pnpm add -D -w @axe-core/playwright
```

Inclus dans `kit-hero.spec.ts` (cf. §4.2).

### 5.2 Tests manuels d'accessibilité

À effectuer **avant chaque merge** :

- [ ] Navigation au clavier (Tab → Tab → Enter → flèches) sans souris.
- [ ] VoiceOver macOS sur Safari → cohérence des annonces.
- [ ] Zoom 200 % (vérif WCAG 1.4.10 reflow) — pas de scroll horizontal forcé.
- [ ] `prefers-reduced-motion: reduce` activé → animations désactivées.
- [ ] `prefers-color-scheme: dark` → page reste en clair (par choix).

---

## 6. Stratégie de mocking

| Couche | Outil | Quand |
|---|---|---|
| Composants RSC (server) | Mock direct des helpers (`vi.mock('@/lib/...')`) | Tests d'intégration |
| Composants client | RTL + jsdom, props mocks | Unit |
| Hooks media query | `window.matchMedia` mock dans `vitest.setup.ts` | Unit |
| IntersectionObserver | Mock global dans `vitest.setup.ts` (déjà présent) | Unit |
| Fetch routes | MSW | Tests qui fetchent depuis le client |
| DB Drizzle | memoryStore | Helpers + queries |
| Réponse e2e | Aucun mock — DB locale réelle | Playwright |

---

## 7. Gates de qualité (CI)

À ajouter dans le pipeline si présent, sinon vérification manuelle :

```bash
# Linting
pnpm --filter @femiglow/web lint

# Type-checking
pnpm --filter @femiglow/web typecheck

# Unit + integration
pnpm --filter @femiglow/web test --run

# Couverture
pnpm --filter @femiglow/web test:coverage
# Vérifier que les fichiers nouveaux atteignent 85 %+

# E2E
pnpm --filter @femiglow/web test:e2e

# Build
pnpm --filter @femiglow/web build
```

**Gate** : aucune étape ne doit échouer pour merger. Si une étape échoue, fix avant merge.

---

## 8. Anti-patterns de test à éviter

| Anti-pattern | Pourquoi éviter |
|---|---|
| Tester l'implémentation (CSS class names) | Fragile, casse au moindre rename |
| Mock global de `fetch` brut | Préférer MSW (plus proche du réel) |
| Tests qui dépendent de l'ordre d'exécution | Casse en parallèle |
| Snapshots géants (whole page) | Maintenance lourde, low signal |
| Tester les Tailwind classes spécifiques | Tester le visuel via e2e, pas le CSS |
| Wait fixe `await sleep(1000)` en e2e | Préférer `expect.toBeVisible()` avec timeout auto |
| Tester les helpers Next.js (`useRouter`, etc.) | Faire confiance au framework |

---

## 9. Plan de couverture par phase

| Phase (cf. `05-action-plan.md`) | Tests ajoutés | Cumulé |
|---|---|---|
| P1 — Seed + registry | 0 (config) | 0 |
| P2 — Migration + helpers data | 4 unit + 2 intégration | 6 |
| P3 — `HeroGallery` complet | 8 unit | 14 |
| P4 — `AttributeChips` + `SocialProofBadge` + `TrustRow` | 6 unit | 20 |
| P5 — Refonte `HeroProduit` + Bound | 2 intégration | 22 |
| P6 — Playwright e2e | 5 e2e + 2 a11y | 29 |
| P7 — Polish + perf | 0 (vérif) | 29 |

**Total cible** : 29 tests dont 22 unit + 4 intégration + 5 e2e + 2 a11y intégrés à e2e.

---

## 10. Voir aussi

- [`05-action-plan.md`](05-action-plan.md) — quand écrire quel test
- [`06-runbook.md`](06-runbook.md) — commandes exactes
- `apps/web/vitest.config.ts` — config existante
- `apps/web/playwright.config.ts` — config existante
- `apps/web/src/components/commerce/PriceDisplay.test.tsx` — pattern unit ref
