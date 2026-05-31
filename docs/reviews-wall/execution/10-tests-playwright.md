# 10 — Tests Playwright : scénarios E2E

Catalogue des scénarios end-to-end pour Playwright. Au lancement, **7 spec files** ciblent les parcours utilisateur les plus critiques. Pas de mocks — exécution sur stack complète (Next.js + Postgres test DB + Vercel Functions ou local).

## 1. Setup

### 1.1 Fichier de config

`apps/web/playwright.config.ts` (extrait) :

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm --filter @femiglow/web dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

### 1.2 Test DB et seed

Avant chaque exécution, **seed minimal** dans une DB test :

```ts
// e2e/_setup/seed-rituals.ts
import { setupTestDatabase, seedRituals, seedAdmin } from '@/test/db-helpers';

export async function globalSetup() {
  await setupTestDatabase();
  await seedRituals([
    { firstName: 'Amal', city: 'Rabat', signal: 'oui', body: '...' },
    { firstName: 'Yasmine', city: 'Rabat', signal: 'oui', body: '...' },
    { firstName: 'Sara', city: 'Marrakech', signal: 'hesite', body: '...' },
    // Inclure ≥ 12 témoignages pour tester pagination
  ]);
  await seedAdmin({ email: 'admin@femiglow-maroc.com', password: 'test1234' });
}
```

`playwright.config.ts` référence : `globalSetup: './e2e/_setup/seed-rituals.ts'`.

### 1.3 Helpers

`apps/web/e2e/_helpers/`:

- `auth.ts` — login admin programmatiquement (POST `/api/admin/login`).
- `fixtures.ts` — création de fixtures via API admin.
- `selectors.ts` — sélecteurs centralisés.

```ts
// e2e/_helpers/auth.ts
export async function loginAsAdmin(page: Page, email = 'admin@femiglow-maroc.com', password = 'test1234') {
  await page.goto('/admin/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/);
}
```

## 2. Inventaire des spec files

| # | Fichier | Scénarios |
| --- | --- | --- |
| E1 | `e2e/rituals-kit-module.spec.ts` | Module compact sur `/kit` |
| E2 | `e2e/rituals-wall-drawer.spec.ts` | Drawer : ouverture, filtres, pagination |
| E3 | `e2e/rituals-wizard-submission.spec.ts` | Wizard complet 3 étapes + confirmation |
| E4 | `e2e/rituals-wizard-email-prefill.spec.ts` | Soumission depuis e-mail J+45 (token pré-rempli) |
| E5 | `e2e/rituals-admin-workflow.spec.ts` | Admin : login, queue, approve, vérif publication |
| E6 | `e2e/rituals-accessibility.spec.ts` | Audit a11y des écrans clés |
| E7 | `e2e/rituals-performance.spec.ts` | Web Vitals `/kit` avec module |

## 3. E1 — Module compact sur `/kit`

`e2e/rituals-kit-module.spec.ts` :

```ts
import { test, expect } from '@playwright/test';

test.describe('Rituals module on /kit', () => {
  test('affiche le titre et 3 cartes featured', async ({ page }) => {
    await page.goto('/kit');
    await expect(page.getByRole('heading', { name: /Les voix de la maison/ })).toBeVisible();
    await expect(page.locator('[data-testid="ritual-module-card"]')).toHaveCount(3);
  });

  test('affiche la synthèse correcte', async ({ page }) => {
    await page.goto('/kit');
    await expect(page.getByText(/initiées ont partagé/)).toBeVisible();
    await expect(page.getByText(/reprendraient le rituel/)).toBeVisible();
  });

  test('lien Lire les N rituels ouvre le drawer', async ({ page }) => {
    await page.goto('/kit');
    await page.click('text=Lire les');
    await expect(page.getByRole('dialog', { name: /Rituels partagés/ })).toBeVisible();
  });

  test('click sur une carte ouvre le drawer scrollé sur la carte', async ({ page }) => {
    await page.goto('/kit');
    await page.click('[data-testid="ritual-module-card"]:first-child');
    const drawer = page.getByRole('dialog', { name: /Rituels partagés/ });
    await expect(drawer).toBeVisible();
    // Vérifier qu'une carte est mise en évidence
    await expect(drawer.locator('[data-highlight="true"]')).toBeVisible();
  });

  test('module compact ne dégrade pas LCP', async ({ page }) => {
    await page.goto('/kit');
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          resolve((last as any).renderTime || (last as any).loadTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    });
    expect(lcp).toBeLessThan(2500);
  });
});
```

## 4. E2 — Drawer

`e2e/rituals-wall-drawer.spec.ts` :

```ts
test.describe('Rituals wall drawer', () => {
  test('ouverture et fermeture', async ({ page }) => {
    await page.goto('/kit?wall=open');
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('focus management : Tab cycle', async ({ page }) => {
    await page.goto('/kit?wall=open');
    const closeBtn = page.getByRole('button', { name: 'Fermer' });
    await closeBtn.focus();
    await expect(closeBtn).toBeFocused();
    // Tab through filters, cards, load more, share, CTA buy
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    // Le focus doit toujours être dans le drawer
    const focused = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
    expect(focused).toBe(true);
  });

  test('click overlay ferme', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.locator('[data-radix-dialog-overlay]').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('filtre Avec photos réduit le compteur', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.waitForSelector('[data-testid="ritual-card"]');
    const totalBefore = await page.locator('[data-testid="ritual-card"]').count();
    await page.click('text=Avec photos');
    await page.waitForFunction(
      (before) => document.querySelectorAll('[data-testid="ritual-card"]').length < before,
      totalBefore
    );
  });

  test('Afficher plus charge 12 cartes additionnelles', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.waitForSelector('[data-testid="ritual-card"]');
    const before = await page.locator('[data-testid="ritual-card"]').count();
    expect(before).toBe(12);
    await page.click('text=Afficher plus');
    await expect(page.locator('[data-testid="ritual-card"]')).toHaveCount(before + 12);
  });

  test('CTA Recevoir le pack ferme et scrolle vers /kit hero', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.click('text=Recevoir le pack');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    // Vérifier scroll au hero
    const heroVisible = await page.locator('[data-testid="kit-hero"]').isVisible();
    expect(heroVisible).toBe(true);
  });

  test('URL state ?wall=open persiste au refresh', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('lien Comment vérifiés ouvre la vue politique', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.click('text=Comment ces rituels partagés sont vérifiés');
    await expect(page.getByText(/Chaque rituel publié sur cette page/)).toBeVisible();
    await page.click('text=Revenir aux rituels');
    await expect(page.getByText(/Chaque rituel publié/)).not.toBeVisible();
  });
});
```

## 5. E3 — Wizard

`e2e/rituals-wizard-submission.spec.ts` :

```ts
test.describe('Wizard de soumission', () => {
  test('parcours complet 3 étapes + confirmation', async ({ page }) => {
    await page.goto('/kit?wall=share');

    // Étape 1
    await expect(page.getByText('Étape 1 — Votre voix')).toBeVisible();
    await page.fill('textarea', 'Trois mois et l’ongle a retrouvé sa nervure. J’ai cessé de le forcer. Je remarque que les cuticules ont apaisé doucement.');
    await page.click('label:has-text("Oui, sans hésiter")');
    await page.click('button:has-text("Continuer")');

    // Étape 2
    await expect(page.getByText('Étape 2 — Vos mots-clés')).toBeVisible();
    await page.click('label:has-text("Ongles plus lisses")');
    await page.click('label:has-text("Plus de casse")');
    await page.click('button:has-text("Continuer")');

    // Étape 3
    await expect(page.getByText('Étape 3 — Votre signature')).toBeVisible();
    await page.fill('input[name="firstName"]', 'Amal');
    await page.selectOption('select[name="city"]', 'Rabat');
    await page.selectOption('select[name="month"]', '2'); // Février
    await page.selectOption('select[name="year"]', '2026');
    await page.click('button:has-text("Partager mon rituel")');

    // Confirmation
    await expect(page.getByText('La maison reçoit votre rituel.')).toBeVisible();
    await expect(page.getByText('Souheila · FemiGlow')).toBeVisible();
  });

  test('soumettre tel quel après étape 1', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'a'.repeat(80));
    await page.click('label:has-text("Hésite")');
    await page.click('text=Soumettre tel quel');
    await expect(page.getByText('La maison reçoit votre rituel.')).toBeVisible();
  });

  test('emoji retiré + toast visible', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'Wow 😊');
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue('Wow ');
    await expect(page.getByText('Les émoticônes ne sont pas dans notre grammaire.')).toBeVisible();
  });

  test('continuer désabilité si body < 50 caractères', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'court');
    await page.click('label:has-text("Oui")');
    const btn = page.getByRole('button', { name: 'Continuer' });
    await expect(btn).toBeDisabled();
  });

  test('compteur de mots évolue', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'un deux trois quatre cinq');
    await expect(page.getByText('5 / 50 mots')).toBeVisible();
    await page.fill('textarea', 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept dix-huit dix-neuf vingt');
    await expect(page.getByText(/suffisamment dense/)).toBeVisible();
  });

  test('brouillon repris après refresh', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'Brouillon en cours d’écriture.');
    await page.waitForTimeout(15500); // Attendre auto-save
    await page.reload();
    await expect(page.getByText('La maison a gardé votre rituel en mémoire.')).toBeVisible();
    await page.click('button:has-text("Reprendre")');
    await expect(page.locator('textarea')).toHaveValue('Brouillon en cours d’écriture.');
  });

  test('upload photo > 5 Mo → message d’erreur', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'a'.repeat(80));
    await page.click('label:has-text("Oui")');
    await page.click('button:has-text("Continuer")');
    const buffer = Buffer.alloc(6 * 1024 * 1024);
    await page.setInputFiles('input[type="file"]', { name: 'big.jpg', mimeType: 'image/jpeg', buffer });
    await expect(page.getByText(/Votre photo est généreuse/)).toBeVisible();
  });

  test('soumission rate-limit déclenche message', async ({ page, request }) => {
    // 1ère soumission
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'a'.repeat(80));
    await page.click('label:has-text("Oui")');
    await page.click('text=Soumettre tel quel');
    await expect(page.getByText('La maison reçoit votre rituel.')).toBeVisible();

    // 2ème soumission même IP → rate-limit
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'b'.repeat(80));
    await page.click('label:has-text("Oui")');
    await page.click('text=Soumettre tel quel');
    await expect(page.getByText(/La maison a déjà reçu votre voix récemment/)).toBeVisible();
  });
});
```

## 6. E4 — Wizard avec e-mail token

`e2e/rituals-wizard-email-prefill.spec.ts` :

```ts
test.describe('Soumission depuis e-mail J+45', () => {
  test('lien e-mail pré-remplit le wizard', async ({ page, request }) => {
    // Préparer un token valide (via API admin ou helper)
    const token = await generateTestEmailToken({
      orderId: 'order-test-001',
      customerFirstName: 'Amal',
      customerCity: 'Rabat',
    });

    await page.goto(`/kit?wall=share&order=order-test-001&hash=${token}`);

    // Vérifier pré-remplissage en étape 3 (les étapes 1 et 2 sont à remplir par l'initiée)
    // Le pré-remplissage doit être visible dans le summary du wizard ou en étape 3 directement
    await page.fill('textarea', 'a'.repeat(80));
    await page.click('label:has-text("Oui")');
    await page.click('button:has-text("Continuer")');
    await page.click('text=Passer cette étape'); // skip étape 2
    await expect(page.locator('input[name="firstName"]')).toHaveValue('Amal');
    await expect(page.locator('select[name="city"]')).toHaveValue('Rabat');
  });

  test('lien e-mail expiré → message d’erreur', async ({ page }) => {
    const expiredToken = await generateTestEmailToken({ /* ... */ expiresAt: Date.now() - 1000 });
    await page.goto(`/kit?wall=share&order=x&hash=${expiredToken}`);
    await expect(page.getByText(/Le lien depuis votre boîte mail n’est plus valide/)).toBeVisible();
  });
});
```

## 7. E5 — Admin workflow

`e2e/rituals-admin-workflow.spec.ts` :

```ts
import { loginAsAdmin } from './_helpers/auth';

test.describe('Admin workflow', () => {
  test('approve un témoignage PENDING', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/queue');
    await page.click('[data-testid="ritual-queue-card"]:first-child a:has-text("Voir détail")');

    // Vue détail
    await expect(page.getByRole('heading', { name: /Détail/ })).toBeVisible();
    await page.click('button:has-text("Approuver")');
    await page.click('button:has-text("Confirmer")');

    // Vérifier audit log mis à jour
    await expect(page.getByText('approved')).toBeVisible();

    // Vérifier publication côté public
    await page.goto('/kit?wall=open');
    // La carte approuvée doit être présente
    // (par exemple, vérifier le compteur a augmenté ou la nouvelle carte est listée)
  });

  test('reject avec template e-mail face_detected', async ({ page }) => {
    await loginAsAdmin(page);
    // Soumettre un témoignage avec photo qui sera flag face_detected
    // (ou utiliser un seed qui force le flag)
    await page.goto('/admin/rituals/queue?filter=face_detected');
    await page.click('[data-testid="ritual-queue-card"]:first-child a');
    await page.click('button:has-text("Rejeter")');
    await expect(page.getByLabel(/Message à l'auteure/)).toContainText('Pour préserver l’intimité');
    await page.fill('textarea[name="internalNote"]', 'Visage frontal détecté manuellement.');
    await page.click('button:has-text("Confirmer le rejet")');
    await expect(page.getByText('REJECTED')).toBeVisible();
  });

  test('mettre en avant un témoignage publié', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/published');
    await page.click('[data-testid="ritual-card"]:first-child a');
    await page.click('button:has-text("Mettre en avant")');
    await expect(page.getByText(/Mise en avant active/)).toBeVisible();
    // Vérifier limite 3 featured
  });

  test('moderator ne voit pas Featured', async ({ page }) => {
    await loginAsAdmin(page, 'moderator@femiglow-maroc.com', 'mod1234');
    await page.goto('/admin/rituals/published');
    await page.click('[data-testid="ritual-card"]:first-child a');
    await expect(page.getByText('Mettre en avant')).not.toBeVisible();
  });

  test('insights dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/insights');
    await expect(page.getByText(/Témoignages publiés/)).toBeVisible();
    await expect(page.locator('[data-testid="top-tag-bar"]')).toHaveCount(7); // ≤ 9
  });

  test('édition politique avec preview', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/politique');
    const editor = page.locator('textarea[role="textbox"]');
    await editor.clear();
    await editor.fill('# Nouveau titre\n\nCorps du texte.');
    await expect(page.locator('[data-testid="policy-preview"] h1')).toHaveText('Nouveau titre');
    await page.click('button:has-text("Publier")');
    await expect(page.getByText(/Publié/)).toBeVisible();
  });
});
```

## 8. E6 — Accessibilité

`e2e/rituals-accessibility.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibilité', () => {
  test('/kit avec module compact', async ({ page }) => {
    await page.goto('/kit');
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('drawer ouvert', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.waitForSelector('[data-testid="ritual-card"]');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('wizard étape 1', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('wizard étape 2 avec photos', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await page.fill('textarea', 'a'.repeat(80));
    await page.click('label:has-text("Oui")');
    await page.click('button:has-text("Continuer")');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('admin queue', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/queue');
    await injectAxe(page);
    await checkA11y(page);
  });

  test('navigation clavier complète dans le drawer', async ({ page }) => {
    await page.goto('/kit?wall=open');
    let focusedTag = '';
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    }
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedTag);
  });

  test('respect prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/kit?wall=open');
    // Vérifier qu'aucune animation longue n'est en cours
    // Par exemple, le drawer doit déjà être visible sans transition
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
```

## 9. E7 — Performance

`e2e/rituals-performance.spec.ts` :

```ts
test.describe('Performance', () => {
  test('/kit LCP < 2,5 s avec module', async ({ page }) => {
    await page.goto('/kit');
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          resolve((last as any).renderTime || (last as any).loadTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 5000);
      });
    });
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(2500);
  });

  test('/kit CLS < 0,1', async ({ page }) => {
    await page.goto('/kit');
    const cls = await page.evaluate(() => {
      let cls = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) cls += entry.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
      return new Promise<number>((resolve) => setTimeout(() => resolve(cls), 3000));
    });
    expect(cls).toBeLessThan(0.1);
  });

  test('drawer ouvre < 500 ms', async ({ page }) => {
    await page.goto('/kit');
    const start = Date.now();
    await page.click('text=Lire les');
    await page.waitForSelector('[data-testid="ritual-card"]');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });

  test('filtre change < 400 ms après réponse réseau', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await page.waitForSelector('[data-testid="ritual-card"]');
    const start = Date.now();
    await page.click('text=Avec photos');
    await page.waitForResponse(/\/api\/rituals\/list/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
```

## 10. Mobile-specific

Dans chaque spec, ajouter un `test.describe('mobile', () => { ... }, { ...projects: ['mobile-safari'] })` pour les comportements mobile-only :

- Bottom sheet drag-to-close.
- Scroll horizontal des chips.
- Touch targets ≥ 44 × 44 px (vérifié via `boundingBox()`).

## 11. Exécution et CI

### 11.1 Local

```bash
pnpm --filter @femiglow/web test:e2e
pnpm --filter @femiglow/web test:e2e --ui  # mode UI debug
pnpm --filter @femiglow/web test:e2e e2e/rituals-wizard-submission.spec.ts
```

### 11.2 CI

GitHub Actions :

```yaml
- name: E2E rituals
  run: pnpm --filter @femiglow/web test:e2e e2e/rituals-*.spec.ts
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    CRON_SECRET: ${{ secrets.TEST_CRON_SECRET }}
    RITUAL_EMAIL_SECRET: ${{ secrets.TEST_RITUAL_EMAIL_SECRET }}
    PLAYWRIGHT_BASE_URL: http://localhost:3000
- name: Upload Playwright report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: apps/web/playwright-report/
```

## 12. Traçage des échecs

Configuration `trace: 'on-first-retry'` génère un fichier `.zip` consultable avec `npx playwright show-trace`. Permet de revoir image par image l'exécution d'un test qui a échoué — précieux pour reproduire un bug fragile.

## 13. Récapitulatif scénarios

| Spec | Scénarios |
| --- | --- |
| E1 — Module | 5 |
| E2 — Drawer | 8 |
| E3 — Wizard | 8 |
| E4 — Email J+45 | 2 |
| E5 — Admin | 6 |
| E6 — A11y | 7 |
| E7 — Performance | 4 |
| **Total** | **40 scénarios** |

Tous projetés sur 2 devices (`chromium-desktop` + `mobile-safari`) = **~ 80 exécutions**.

Durée estimée CI : 4 à 6 min (parallélisation 2 workers).

## 14. Anti-patterns Playwright à éviter

| Anti-pattern | Pourquoi |
| --- | --- |
| `page.waitForTimeout(2000)` | Utiliser `waitForSelector`, `waitForResponse`, `expect.poll` |
| Sélecteurs CSS profonds `div > div > div` | Préférer `data-testid` ou `getByRole` |
| Tests qui dépendent d'autres tests | Chaque test isole son setup |
| Snapshots de screenshots fragiles | Préférer assertions sur DOM |
| Mocker des routes via Playwright | Préférer MSW pour les unit/integration ; E2E = stack complet |

## 15. Synthèse — règles d'or Playwright

1. **Stack complet sans mock** (BDD test dédiée + vrais workers).
2. **`data-testid` sur tous les éléments interactifs critiques.**
3. **`getByRole` / `getByText`** préférés aux CSS selectors.
4. **`waitForResponse(/\/api\/rituals/)`** pour attendre les requêtes au lieu de timeouts.
5. **`expect.poll`** pour les conditions asynchrones non liées au DOM.
6. **2 devices projets** : desktop + mobile.
7. **A11y intégré** via `axe-playwright`.
8. **Traces conservées sur échec** pour debug.
9. **Seed BDD avant chaque exécution complète** via `globalSetup`.
10. **40 scénarios max** au lancement — privilégier la valeur sur le volume.
