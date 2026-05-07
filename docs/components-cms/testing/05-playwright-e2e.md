# T5 — Tests E2E Playwright

> Parcours bout en bout admin : login → édition → save draft →
> publish → vérification du rendu public. 1 nominal par page-group +
> 3 parcours d'erreur (validation 422, conflit 409, droits 403).

## Setup

`apps/web/playwright.config.ts` est déjà configuré (cf. existant
`admin-components.spec.ts`). On ajoute :

- une **fixture admin** pour réutiliser une session connectée,
- un **seed de test** posé via les API admin (pas via `vitest`),
- un **tag `@cms`** pour filtrer en CI PR (`--grep @cms`), nightly run sans tag.

### Fixture admin (storage state)

```ts
// e2e/fixtures/admin.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ adminPage: import('@playwright/test').Page }>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
```

`e2e/.auth/admin.json` est généré par `globalSetup` : connexion via
`/api/admin/login` (existant) puis sauvegarde du cookie.

```ts
// e2e/global-setup.ts
import { chromium } from '@playwright/test';
async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel(/mot de passe/i).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /connexion/i }).click();
  await page.waitForURL('**/admin');
  await context.storageState({ path: 'e2e/.auth/admin.json' });
  await browser.close();
}
export default globalSetup;
```

> Si le fichier n'existe pas (env CI sans secret), on garde le pattern
> existant : redirection vers `/admin/login` acceptée, le test sort
> proprement (cf. `admin-components.spec.ts`).

### Seed de test

Avant les parcours d'écriture, on remet le composant dans un état
connu via l'API. Helper :

```ts
// e2e/helpers/seed.ts
export async function resetComponentFields(request: APIRequestContext, componentKey: string) {
  await request.post(`/api/test/reset-component-fields`, {
    data: { componentKey },
    headers: { 'X-Test-Reset-Token': process.env.E2E_RESET_TOKEN! },
  });
}
```

Cette route `/api/test/reset-component-fields` existe **uniquement en
mode test/dev** (gate par `NODE_ENV !== 'production'` + token shared
secret). Elle réinsère les valeurs du registre.

## Parcours nominaux par page-group

> Tag `@cms @nominal`. 1 par page-group (Home, Maison, Journal,
> Rituel, Kit). Chaque parcours édite un champ, sauvegarde le draft,
> publie, vérifie sur la route publique.

### Home — éditer le titre du hero

```ts
// e2e/admin-components-fields-home.spec.ts
import { test, expect } from './fixtures/admin';
import { resetComponentFields } from './helpers/seed';

test.describe('@cms @nominal Home — hero title', () => {
  test.beforeEach(async ({ request }) => {
    await resetComponentFields(request, 'home-hero');
  });

  test('édite le titre, sauvegarde, publie, visible sur /', async ({ adminPage, page }) => {
    await adminPage.goto('/admin/components/home-hero');

    // Édite le champ title
    const titleInput = adminPage.getByRole('textbox', { name: /^titre$/i });
    await titleInput.fill('Le rituel du soir, en cinq minutes — édité E2E');

    // Vérifie le badge "brouillon" / dirty
    await expect(adminPage.getByText(/brouillon non publié/i)).toBeVisible();

    // Auto-save : on attend le toast de save
    await expect(adminPage.getByRole('status')).toContainText(/enregistré/i, { timeout: 2000 });

    // Publier
    await adminPage.getByRole('button', { name: /publier/i }).click();
    await adminPage.getByRole('button', { name: /confirmer/i }).click();
    await expect(adminPage.getByRole('status')).toContainText(/publié/i);

    // Vérifie sur la route publique
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/édité E2E/);
  });
});
```

### Maison — cross-link label + scheduling

```ts
test('@cms @nominal Maison — schedule cross-link pour demain', async ({ adminPage }) => {
  await adminPage.goto('/admin/components/maison-cross-links');

  await adminPage.getByRole('textbox', { name: /libellé rituel/i }).fill('Découvrir le rituel');

  // Programme pour demain 09:00 Paris
  await adminPage.getByRole('button', { name: /programmer/i }).click();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await adminPage.getByLabel(/date/i).fill(tomorrow);
  await adminPage.getByLabel(/heure/i).fill('09:00');
  await adminPage.getByRole('button', { name: /confirmer/i }).click();

  await expect(adminPage.getByText(/programmé pour/i)).toBeVisible();
  await expect(adminPage.getByText(new RegExp(tomorrow))).toBeVisible();

  // Vérifie qu'il est encore dans l'état "scheduled" (non publié)
  const status = await adminPage.getByTestId('field-status').textContent();
  expect(status).toMatch(/programmé/i);
});
```

### Journal — restore version précédente

```ts
test('@cms @nominal Journal — restore prev version', async ({ adminPage }) => {
  await adminPage.goto('/admin/components/journal-article-cinq-minutes-le-soir');

  // Ouvre l'historique
  await adminPage.getByRole('button', { name: /historique/i }).click();
  const history = adminPage.getByRole('dialog', { name: /historique/i });
  await expect(history).toBeVisible();

  // Restaure la version précédente
  const items = history.getByRole('listitem');
  await items.nth(1).getByRole('button', { name: /restaurer/i }).click();
  await adminPage.getByRole('button', { name: /confirmer la restauration/i }).click();

  // Un draft est créé, pas encore publié
  await expect(adminPage.getByText(/brouillon créé depuis l'historique/i)).toBeVisible();

  // Publier le restore
  await adminPage.getByRole('button', { name: /publier/i }).click();
  await adminPage.getByRole('button', { name: /confirmer/i }).click();
});
```

### Rituel et Kit

Mêmes templates ; on factorise dans une fonction :

```ts
async function nominalEditAndPublish(adminPage: Page, page: Page, componentKey: string, fieldKey: string, value: string, publicRoute: string, publicMatcher: RegExp) {
  await adminPage.goto(`/admin/components/${componentKey}`);
  await adminPage.getByRole('textbox', { name: new RegExp(fieldKey, 'i') }).fill(value);
  await expect(adminPage.getByRole('status')).toContainText(/enregistré/i);
  await adminPage.getByRole('button', { name: /publier/i }).click();
  await adminPage.getByRole('button', { name: /confirmer/i }).click();
  await page.goto(publicRoute);
  await expect(page.getByText(publicMatcher)).toBeVisible();
}
```

## Parcours d'erreur

### Validation 422

```ts
test('@cms @error 422 — titre trop court', async ({ adminPage }) => {
  await adminPage.goto('/admin/components/home-hero');
  await adminPage.getByRole('textbox', { name: /^titre$/i }).fill('A'); // < minLength
  await expect(adminPage.getByRole('alert')).toContainText(/min 3/i);
  await expect(adminPage.getByRole('button', { name: /publier/i })).toBeDisabled();
});
```

### Conflit 409 — deux pages parallèles

```ts
test('@cms @error 409 — deux admins éditent en parallèle', async ({ browser }) => {
  const ctx1 = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
  const ctx2 = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await page1.goto('/admin/components/home-hero');
  await page2.goto('/admin/components/home-hero');

  // p1 modifie + publie
  await page1.getByRole('textbox', { name: /^titre$/i }).fill('Version A');
  await expect(page1.getByRole('status')).toContainText(/enregistré/i);
  await page1.getByRole('button', { name: /publier/i }).click();
  await page1.getByRole('button', { name: /confirmer/i }).click();

  // p2 (qui avait l'ancien updatedAt) tente de publier
  await page2.getByRole('textbox', { name: /^titre$/i }).fill('Version B');
  await page2.getByRole('button', { name: /publier/i }).click();
  await page2.getByRole('button', { name: /confirmer/i }).click();

  // p2 voit le dialog conflit
  const dialog = page2.getByRole('dialog', { name: /conflit/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /recharger/i })).toBeVisible();
});
```

### Droits 403 — admin révoqué

```ts
test('@cms @error 403 — admin désactivé', async ({ browser, request }) => {
  // Désactive l'admin via API test
  await request.post('/api/test/admin-set-status', { data: { email: process.env.E2E_ADMIN_EMAIL, status: 'inactive' }, headers: { 'X-Test-Reset-Token': process.env.E2E_RESET_TOKEN! } });

  const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
  const page = await ctx.newPage();
  await page.goto('/admin/components/home-hero');
  await page.getByRole('textbox', { name: /^titre$/i }).fill('X');
  // Le PATCH renvoie 403
  await expect(page.getByRole('alert')).toContainText(/compte désactivé/i);

  // Cleanup : réactive
  await request.post('/api/test/admin-set-status', { data: { email: process.env.E2E_ADMIN_EMAIL, status: 'active' }, headers: { 'X-Test-Reset-Token': process.env.E2E_RESET_TOKEN! } });
});
```

## Visual regression sur le rendu public

Réutilise la config Playwright existante (cf. `public-images.spec.ts`).
On vérifie que **les valeurs admin se reflètent** sur la route :

```ts
test('@cms @visual Home — title binding visible', async ({ page, request }) => {
  // Setup : pose une valeur stable
  await request.post('/api/test/reset-component-fields', { data: { componentKey: 'home-hero' }, headers: { 'X-Test-Reset-Token': process.env.E2E_RESET_TOKEN! } });
  await page.goto('/');
  await expect(page).toHaveScreenshot('home-hero-binding.png', {
    mask: [page.locator('[data-test-volatile]')], // dates, compteurs
    maxDiffPixelRatio: 0.01,
  });
});
```

> Les snapshots vivent sous `e2e/__screenshots__/` ; on les regénère
> volontairement avec `--update-snapshots` lors d'une PR explicite.

## Run en CI

```yaml
# .github/workflows/ci.yml (extrait)
- name: Playwright (PR)
  run: pnpm --filter @femiglow/web test:e2e --grep @cms
  env:
    E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
    E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
    E2E_RESET_TOKEN: ${{ secrets.E2E_RESET_TOKEN }}

- name: Playwright (nightly main)
  run: pnpm --filter @femiglow/web test:e2e
  if: github.event_name == 'schedule'
```

## Specs attendues

| Fichier | Tags | Couvre |
|---|---|---|
| `admin-components-fields-home.spec.ts` | `@cms @nominal` | Home, Avis, Rituel-cards |
| `admin-components-fields-maison.spec.ts` | `@cms @nominal` | Maison hero, cross-links, schedule |
| `admin-components-fields-journal.spec.ts` | `@cms @nominal` | Article kicker, restore |
| `admin-components-fields-rituel.spec.ts` | `@cms @nominal` | Hero lifestyle, manifeste |
| `admin-components-fields-kit.spec.ts` | `@cms @nominal` | Hero produit, comparatif |
| `admin-components-fields-errors.spec.ts` | `@cms @error` | 422, 409, 403, 401 |
| `admin-components-fields-visual.spec.ts` | `@cms @visual` | Snapshots des routes publiques |

## Bonnes pratiques

- **Locators par rôle** uniquement (`getByRole`, `getByLabel`). Pas
  de `data-testid` sauf pour les conteneurs volatiles
  (`[data-test-volatile]`).
- **Pas de `page.waitForTimeout()`**. On attend des conditions
  (`toBeVisible`, `toContainText`, `waitForResponse`).
- **Pas de retry**. Si flaky, on quarantine (cf. T1 §Politique flaky).
- **Cleanup explicite** dans `afterEach` ou `beforeEach` (reset DB).
- **Pas de mock côté Playwright** : on tape la vraie API. C'est ce qui
  distingue E2E d'intégration.

## Cross-références

- A1 §Qualité (1 nominal/page-group + 3 erreurs).
- A4 §E1 (parcours conflit), A6 §Tests sécurité.
- T1 §Gates CI, T3 (les vrais handlers ne sont pas mockés ici).
- T6 (matrice composants × scénarios).
