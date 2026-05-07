# 12 — QA, debugging & observabilité

> *Un défaut détecté en production coûte 100×. Investir en amont est la posture économique.*

---

## 1. Pyramide de tests

```
                  E2E (10 %)
              ──────────────────
            Intégration (20 %)
        ──────────────────────────
       Unitaires (70 %)
   ──────────────────────────────────
```

| Niveau | Outil | Volume | Vitesse | Cible |
|---|---|---|---|---|
| **Unitaire** | Vitest + Testing Library | 70 % | <1 min | composants, helpers, schemas Zod |
| **Intégration** | Vitest + MSW | 20 % | <2 min | hooks, server actions, API routes |
| **E2E** | Playwright | 10 % | <8 min | parcours d'achat complet, navigation |
| **Visuel** | Storybook + Chromatic (Phase 2) | n/a | n/a | régression visuelle |
| **Accessibilité** | jest-axe + Storybook a11y | continu | <1 min | composants |
| **Performance** | Lighthouse CI | par PR | <3 min | pages clefs |

## 2. Couverture cible

| Catégorie | Couverture minimale |
|---|---|
| **Composants UI primitives** (Button, Input, Card) | 90 % |
| **Patterns** (forms, sections) | 80 % |
| **Lib (helpers, schemas)** | 95 % |
| **Server actions** | 85 % |
| **API routes** | 85 % |
| **Pages (smoke tests)** | 70 % |
| **Cart store (Zustand)** | 100 % |
| **Global** | 70 % minimum, 80 % cible |

CI fail si descend sous 70 %.

## 3. Vitest configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      exclude: ['**/*.stories.tsx', '**/*.config.*', 'src/data/mock/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
afterEach(() => cleanup());
```

## 4. Patterns de test unitaire

### 4.1 Composant pur

```ts
// Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('rend le label', () => {
    render(<Button>Découvrir le rituel</Button>);
    expect(screen.getByRole('button', { name: 'Découvrir le rituel' })).toBeInTheDocument();
  });

  it('appelle onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>OK</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('désactive durant loading', () => {
    render(<Button loading>OK</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('passe axe-core', async () => {
    const { container } = render(<Button>OK</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 4.2 Schéma Zod

```ts
// schemas/order.test.ts
import { describe, it, expect } from 'vitest';
import { orderSchema, phoneMarocSchema } from './order';

describe('phoneMarocSchema', () => {
  it.each([
    ['+212612345678', true],
    ['0612345678', true],
    ['0712345678', true],
    ['612345678', false],
    ['+33612345678', false],
    ['', false],
  ])('valide %s → %s', (phone, expected) => {
    expect(phoneMarocSchema.safeParse(phone).success).toBe(expected);
  });
});

describe('orderSchema', () => {
  it('rejette un id mal formaté', () => {
    const result = orderSchema.safeParse({ id: 'invalid', /* ... */ });
    expect(result.success).toBe(false);
  });
});
```

### 4.3 Zustand store

```ts
// stores/cart.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cart';

describe('cart store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], total: 0 });
  });

  it('ajoute un item', () => {
    useCartStore.getState().addItem({ id: 'kit', quantity: 1, price: 32000 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().total).toBe(32000);
  });

  it('incrémente quantité si item existant', () => {
    const { addItem } = useCartStore.getState();
    addItem({ id: 'kit', quantity: 1, price: 32000 });
    addItem({ id: 'kit', quantity: 1, price: 32000 });
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });
});
```

## 5. Mocks et fixtures

### 5.1 MSW (Mock Service Worker) pour intégration

```ts
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/newsletter', () => HttpResponse.json({ ok: true })),
  http.get('/api/articles', () => HttpResponse.json([{ slug: 'hiver', title: '...' }])),
];
```

### 5.2 Fixtures partagées

```
src/
└── lib/
    └── test/
        ├── fixtures/
        │   ├── article.ts      // makeArticle({ overrides })
        │   ├── product.ts
        │   ├── order.ts
        │   └── address.ts
        └── render.tsx          // custom renderer avec providers
```

```ts
// fixtures/article.ts
import { Article } from '@/lib/schemas/article';

export const makeArticle = (overrides?: Partial<Article>): Article => ({
  slug: 'test-article',
  title: 'Article de test',
  category: 'saison',
  publishedAt: new Date('2026-01-15'),
  // ... defaults
  ...overrides,
});
```

## 6. Tests E2E avec Playwright

### 6.1 Configuration

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'mobile-chrome', use: devices['Pixel 5'] },
    { name: 'mobile-safari', use: devices['iPhone 12'] },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 6.2 Scénarios E2E critiques

| Scénario | Fichier | Commentaire |
|---|---|---|
| Parcours d'achat complet | `purchase-journey.spec.ts` | accueil → kit → panier → checkout → merci |
| Navigation principale | `navigation.spec.ts` | tous les liens header / footer |
| Formulaire contact | `contact-form.spec.ts` | validation, soumission, erreurs |
| Newsletter | `newsletter.spec.ts` | depuis `/journal` |
| Recherche journal (Phase 2) | `journal-search.spec.ts` | mots-clés, 0 résultat |
| Cart drawer | `cart-drawer.spec.ts` | ajouter, modifier qty, supprimer |
| Checkout COD | `checkout-cod.spec.ts` | paiement à la livraison |
| Checkout Stripe | `checkout-stripe.spec.ts` | carte test 4242 |
| Erreur réseau panier | `cart-resilience.spec.ts` | offline, reload, persist |
| 404 / 500 | `errors.spec.ts` | pages d'erreur |

### 6.3 Exemple : parcours d'achat

```ts
// e2e/purchase-journey.spec.ts
import { test, expect } from '@playwright/test';

test('Parcours d\'achat COD complet', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FemiGlow/);

  await page.getByRole('link', { name: /découvrir le rituel/i }).click();
  await expect(page).toHaveURL('/rituel');

  await page.getByRole('link', { name: /voir le kit/i }).click();
  await expect(page).toHaveURL('/kit');

  await page.getByRole('button', { name: /ajouter au rituel/i }).click();
  await expect(page.getByRole('status')).toContainText('1');

  await page.getByRole('link', { name: /panier/i }).click();
  await expect(page).toHaveURL('/panier');

  await page.getByRole('link', { name: /commander/i }).click();
  await expect(page).toHaveURL('/commander');

  // Étape 1
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Prénom').fill('Salma');
  await page.getByLabel('Nom').fill('Test');
  await page.getByLabel('Téléphone').fill('+212612345678');
  await page.getByRole('button', { name: /continuer/i }).click();

  // Étape 2
  await page.getByLabel('Adresse').fill('12 rue Imam Ali');
  await page.getByLabel('Ville').fill('Casablanca');
  await page.getByLabel('Code postal').fill('20000');
  await page.getByRole('button', { name: /continuer/i }).click();

  // Étape 3
  await page.getByLabel('Paiement à la livraison').check();
  await page.getByRole('button', { name: /confirmer la commande/i }).click();

  await expect(page).toHaveURL(/\/merci/);
  await expect(page.getByText(/votre commande est confirmée/i)).toBeVisible();
});
```

## 7. Storybook : référentiel vivant

### 7.1 Structure des stories

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Primitives/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Le bouton primaire FemiGlow. Trois variantes, trois tailles.',
      },
    },
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'link'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

export const Primary: StoryObj<typeof Button> = {
  args: { children: 'Découvrir le rituel', variant: 'primary' },
};

export const Loading: StoryObj<typeof Button> = {
  args: { children: 'Ajouter au rituel', loading: true },
};

export const States = () => (
  <div className="flex flex-col gap-4">
    <Button>Idle</Button>
    <Button data-hover>Hover</Button>
    <Button data-focus>Focus</Button>
    <Button disabled>Disabled</Button>
    <Button loading>Loading</Button>
  </div>
);
```

### 7.2 Addons obligatoires

| Addon | Usage |
|---|---|
| `@storybook/addon-essentials` | controls, actions, viewport, backgrounds, docs |
| `@storybook/addon-a11y` | tests axe-core en live |
| `@storybook/addon-interactions` | scénarios `play()` |
| `@storybook/addon-themes` | bascule thèmes (Phase 2) |
| `storybook-addon-pseudo-states` | hover, focus, active automatiques |

## 8. ESLint + TypeScript strict

```js
// .eslintrc.cjs
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:jsx-a11y/strict',
    'plugin:storybook/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'react/no-unescaped-entities': 'off', // gérer manuellement les apostrophes
    'jsx-a11y/anchor-is-valid': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
};
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## 9. Pre-commit hooks (Husky + lint-staged)

```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"],
  "*.{ts,tsx}": ["bash -c 'tsc --noEmit'"]
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
```

## 10. CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v4

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm exec lhci autorun
```

`lighthouserc.json` :

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/kit", "http://localhost:3000/journal"],
      "startServerCommand": "pnpm start"
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

## 11. Observabilité production

### 11.1 Stack

| Brique | Outil | Usage |
|---|---|---|
| **Errors** | Sentry | exceptions client + serveur |
| **Logs** | Vercel Logs + Logtail (Phase 2) | requêtes API, erreurs |
| **Metrics** | Vercel Analytics + Speed Insights | trafic, perf |
| **Uptime** | Better Uptime | ping toutes 60 s |
| **Synthetic** | Checkly (Phase 2) | parcours critique scripté |

### 11.2 Sentry config

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  beforeSend(event) {
    // Filter PII
    if (event.user?.email) delete event.user.email;
    return event;
  },
});
```

### 11.3 Données sensibles

| Donnée | Traitement |
|---|---|
| Email | masqué dans logs (`***@domain.com`) |
| Téléphone | masqué (`+2126******78`) |
| Adresse | jamais loggée |
| Carte bancaire | jamais traversée par notre serveur (Stripe Elements) |
| Session | tokens hashés en logs |

## 12. Logging conventions

```ts
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  [k: string]: unknown;
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, error?: unknown, ctx?: LogContext) => {
    Sentry.captureException(error);
    log('error', msg, { ...ctx, error: serializeError(error) });
  },
};

function log(level: LogLevel, msg: string, ctx?: LogContext) {
  if (process.env.NODE_ENV === 'test') return;
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx })
  );
}
```

**Aucun `console.log()` direct dans le code applicatif.** ESLint l'interdit (sauf `console.warn` et `console.error`).

## 13. Debugging

### 13.1 Outils

| Outil | Usage |
|---|---|
| Chrome DevTools | Performance, Network, Application (storage) |
| React DevTools | composants, profiler |
| Redux DevTools (via Zustand middleware) | state cart |
| `next dev --turbo` | dev local rapide |
| VS Code debugger | breakpoints serveur (configuration `.vscode/launch.json`) |

### 13.2 Debug helpers locaux

```ts
// lib/debug.ts
export const debug = process.env.NODE_ENV === 'development'
  ? (label: string, value: unknown) => console.log(`[FG:${label}]`, value)
  : () => {};
```

### 13.3 Process pour bug reproduction

1. Récupérer `requestId` depuis Sentry
2. Identifier route, user agent, viewport
3. Reproduire en local avec mêmes inputs
4. Écrire test (unit ou E2E) qui échoue
5. Fix + test passe
6. Add to `e2e/regressions/` si bug critique

## 14. Feature flags (Phase 2)

Phase 1 : aucun flag (simplicité). Phase 2 : intégration Vercel Edge Config ou GrowthBook pour :

- A/B test microcopy `/kit`
- Activation B2B
- Bascule mockAdapter / sanityAdapter

```ts
// lib/flags.ts
import { unstable_flag as flag } from '@vercel/flags/next';

export const useB2BSection = flag({
  key: 'b2b-section',
  decide: () => process.env.B2B_ENABLED === 'true',
});
```

## 15. Health check

```ts
// app/api/health/route.ts
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    cms: await checkCMS(),
    db: 'n/a (Phase 1)',
    stripe: await checkStripe(),
  };
  const ok = Object.values(checks).every(c => c === 'ok' || typeof c === 'string');
  return Response.json(checks, { status: ok ? 200 : 503 });
}
```

Pingé par Better Uptime toutes les 60 s.

## 16. Process de release

| Étape | Action |
|---|---|
| 1. PR créée | CI lance lint + typecheck + tests + lighthouse |
| 2. Review | au moins 1 approbation |
| 3. Merge sur `main` | Vercel deploy preview |
| 4. Tests E2E sur preview | manuels ou auto |
| 5. Promote to production | bouton Vercel ou auto via main |
| 6. Smoke test prod | parcours d'achat manuel |
| 7. Watch metrics 24h | Sentry, Speed Insights |

**Hot fix** : branche `hotfix/*` → cherry-pick sur `main` → re-deploy.

## 17. Postmortem

Tout incident production produit un postmortem dans `docs/postmortems/YYYY-MM-DD-titre.md` :

- Timeline (UTC)
- Impact utilisateur
- Cause racine
- Détection
- Résolution
- Actions correctives (avec dates)

**Blameless** — focus sur les processus, pas les personnes.

## 18. Audit régulier

| Audit | Fréquence |
|---|---|
| Dépendances obsolètes | hebdomadaire (Dependabot) |
| Vulnérabilités CVE | continu (Snyk ou GitHub Advanced Security) |
| Bundle size | par PR |
| Lighthouse | par PR + hebdomadaire prod |
| axe-core | par PR + manuel mensuel |
| Logs Sentry triage | hebdomadaire |
| Postmortem review | mensuel |

## 19. Anti-patterns QA

- ❌ Tests qui dépendent de l'ordre d'exécution
- ❌ `setTimeout` ou `wait` arbitraires (utiliser `waitFor`)
- ❌ Tests E2E qui hit production
- ❌ Mocks qui divergent du contrat API
- ❌ Snapshots géants (preferable de tester ce qui compte)
- ❌ Console.log laissés en production
- ❌ `as any` ou `// @ts-ignore`
- ❌ Tests skipped sans ticket associé
- ❌ Couverture inflated par tests triviaux

## 20. Checklist QA avant release

- [ ] Tous les tests unitaires passent (≥ 70 % coverage)
- [ ] Tous les tests E2E passent
- [ ] Lighthouse ≥ 95 sur les 9 pages
- [ ] axe-core 0 violation
- [ ] TypeScript 0 erreur
- [ ] ESLint 0 warning
- [ ] Bundle budget respecté
- [ ] Storybook publié et à jour
- [ ] Sentry sourcemaps uploadés
- [ ] Smoke test parcours d'achat manuel
- [ ] Monitoring 24h post-release vert

> *Document suivant : [13 — Modularité, évolutivité, maintenabilité](./13-modularite-evolutivite.md)*
