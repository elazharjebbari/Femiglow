# Tests E2E — Playwright

| Aspect | Valeur |
|---|---|
| Outil | Playwright 1.x |
| Browser v1 | Chromium uniquement |
| Browsers v2 | + Firefox, WebKit |
| Environnement | Neon branch (preview Vercel) ou local avec DB de test |
| Parallélisme | `workers: 4` en CI |
| Retries | 1 sur CI, 0 en local |

## Configuration

`apps/web/playwright.config.ts` :

```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 4 : undefined,
  reporter: isCI ? [['html'], ['github']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } }, // smoke
  ],
  webServer: !isCI
    ? {
        command: 'pnpm dev',
        port: 3000,
        reuseExistingServer: true,
      }
    : undefined,
});
```

## Catalogue des specs

| Spec | Domaine | Parcours |
|---|---|---|
| `e2e/login.spec.ts` | auth | login OK, login échec, redirect après login |
| `e2e/login-rate-limit.spec.ts` | auth | 6 tentatives → message rate-limit |
| `e2e/login-redirect-next.spec.ts` | auth | `?next=/admin/leads` honoré, ouverte/fermée |
| `e2e/logout.spec.ts` | auth | logout → redirect login + session détruite |
| `e2e/session-timeout.spec.ts` | auth | cookie expiré → redirect mid-navigation |
| `e2e/middleware-redirect.spec.ts` | auth | accès non auth → redirect, déjà auth → dashboard |
| `e2e/dashboard.spec.ts` | dashboard | login → 3 KPIs visibles, click KPI → page filtrée |
| `e2e/dashboard-streaming.spec.ts` | dashboard | skeletons → contenu chargé |
| `e2e/leads.spec.ts` | leads | filtre, recherche, pagination, click ligne |
| `e2e/leads-export.spec.ts` | leads | bouton export → fichier .csv téléchargé |
| `e2e/lead-detail.spec.ts` | leads-detail | charger, changer statut, ajouter note |
| `e2e/lead-detail-404.spec.ts` | leads-detail | id inconnu → 404 |
| `e2e/webhooks-list.spec.ts` | webhooks | toggle, suppression avec confirmation |
| `e2e/webhook-form.spec.ts` | webhooks | créer, éditer, tester, rotation secret |
| `e2e/webhook-deliveries.spec.ts` | deliveries | filtres, drawer, renvoyer |
| `e2e/webhook-flow.spec.ts` | engine | poster lead public → delivery visible en admin |
| `e2e/cron-flow.spec.ts` | cron | insérer pending → invoquer cron → status delivered |
| `e2e/public-forms.spec.ts` | public | contact, order, newsletter |
| `e2e/public-forms-rate-limit.spec.ts` | public | 11e soumission → 429 |
| `e2e/security-headers.spec.ts` | sécurité | HSTS, CSP, X-Frame-Options présents |
| `e2e/csp.spec.ts` | sécurité | violation CSP → bloquée + report |
| `e2e/cookie-flags.spec.ts` | sécurité | cookie session HttpOnly + Secure + SameSite |
| `e2e/consent-form.spec.ts` | RGPD | checkbox non pré-cochée, lien politique |
| `e2e/privacy-page.spec.ts` | RGPD | sections obligatoires présentes |
| `e2e/a11y-focus.spec.ts` | a11y | focus visible sur tous les éléments tabbables |
| `e2e/a11y-skip-link.spec.ts` | a11y | "Aller au contenu" fonctionne |
| `e2e/a11y-contrast.spec.ts` | a11y | aucune violation de contraste sur pages clés |
| `e2e/a11y-aria.spec.ts` | a11y | scan @axe-core/playwright |

## Helpers partagés

`apps/web/e2e/helpers/auth.ts` :

```ts
import type { Page } from '@playwright/test';

export async function login(
  page: Page,
  email = process.env.E2E_ADMIN_EMAIL!,
  password = process.env.E2E_ADMIN_PASSWORD!,
) {
  await page.goto('/admin/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('/admin/dashboard');
}
```

`apps/web/e2e/helpers/seed.ts` :

```ts
import { db } from '@/lib/db/client';

export async function seedLead(...) { … }
export async function cleanLeads() { … }
```

## Exemple : `e2e/lead-detail.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { seedLead } from './helpers/seed';

test.describe('Lead detail', () => {
  test('change status optimistically', async ({ page }) => {
    const lead = await seedLead({ status: 'new' });
    await login(page);
    await page.goto(`/admin/leads/${lead.id}`);

    await expect(page.getByText('Nouveau')).toBeVisible();
    await page.getByRole('button', { name: 'Statut' }).click();
    await page.getByRole('menuitem', { name: 'En cours' }).click();

    await expect(page.getByText('En cours')).toBeVisible();
    await expect(page.getByRole('alert')).not.toBeVisible();
  });
});
```

## Conventions

| Pratique | Règle |
|---|---|
| Sélecteurs | rôle ARIA puis label en français accessible |
| Pas de CSS selectors fragiles | jamais `.css-xxx`, `nth-child` etc. |
| Données isolées | chaque test seed son propre lead/endpoint |
| `expect.toBeVisible()` | préférer à `toBeAttached()` (utilisateur ne voit pas l'attaché invisible) |
| Pas de `page.waitForTimeout` | utiliser `expect(...).toPass()` ou `waitForResponse` |

## Stratégie d'environnement

### Local

- `pnpm dev` lance le serveur.
- Postgres local (Docker) avec seed dev.
- `pnpm e2e` exécute les tests.

### CI

- Vercel preview branch déployée pour la PR.
- Neon branch éphémère (auto-créée par Neon GitHub integration).
- Variables d'env : `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.
- Job lancé après `lint` + `test` réussis.

```yaml
e2e:
  needs: [lint, test]
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm playwright install chromium
    - run: pnpm e2e
      env:
        E2E_BASE_URL: ${{ vars.PREVIEW_URL }}
        E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
        E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: apps/web/playwright-report/
```

## Flakiness — politique

Un test E2E qui échoue de façon intermittente est **immédiatement
isolé** (`test.fixme`) avec un ticket de remédiation à 7j. Pas de
"retry à 3" pour masquer un test fragile.

## Exécution

```bash
pnpm e2e                            # tous les tests
pnpm e2e leads                      # filtre par nom
pnpm e2e --headed                   # voir le browser
pnpm e2e --debug                    # mode pas-à-pas
pnpm e2e --ui                       # mode interactif Playwright
pnpm exec playwright show-report    # rapport HTML
```
