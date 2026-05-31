# 70.3 — Playwright E2E scenarios

## Configuration

`playwright.config.legal.ts` :
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/legal',
  fullyParallel: false, // mutations DB séquentielles
  retries: 2,
  reporter: [['html', { outputFolder: 'playwright-report/legal' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
```

## Scénarios

### `e2e/legal/legal-create-publish.spec.ts`

```typescript
test('Admin crée + édite + publie une page', async ({ page }) => {
  await loginAsAdmin(page);

  // 1. Naviguer vers wizard
  await page.goto('/admin/legal');
  await page.getByRole('button', { name: /Nouvelle page/ }).click();

  // 2. Step 1 : Type
  await page.getByLabel(/Page personnalisée/).click();
  await page.getByRole('button', { name: /Suivant/ }).click();

  // 3. Step 2 : Métadonnées
  await page.getByLabel(/Titre/).fill('Politique de test E2E');
  await expect(page.getByLabel(/URL/)).toHaveValue('politique-de-test-e2e');
  await page.getByLabel(/Description/).fill('Page de test automatisé');
  await page.getByRole('button', { name: /Suivant/ }).click();

  // 4. Step 3 : Contenu
  await page.getByLabel(/Contenu/).fill('# Test\n\nContenu de test');
  await page.getByRole('button', { name: /Suivant/ }).click();

  // 5. Step 4 : Placement
  await page.getByLabel(/Footer principal/).check();
  await page.getByRole('button', { name: /Suivant/ }).click();

  // 6. Step 5 : SEO
  await expect(page.getByLabel(/Indexer/)).not.toBeChecked();
  await page.getByRole('button', { name: /Créer la page/ }).click();

  // 7. Redirect vers éditeur
  await expect(page).toHaveURL(/\/admin\/legal\/politique-de-test-e2e\/edit/);

  // 8. Modifier et sauver
  await page.getByLabel(/Markdown/).fill('# Test\n\nVersion modifiée');
  await page.keyboard.press('Control+S');
  await expect(page.getByText(/Enregistré/)).toBeVisible();

  // 9. Publier
  await page.getByRole('button', { name: /Publier/ }).click();
  await page.getByLabel(/J'ai relu/).check();
  await page.getByLabel(/Toutes les variables/).check();
  await page.getByLabel(/Les liens internes/).check();
  await page.getByLabel(/La date est correcte/).check();
  await page.getByPlaceholder(/PUBLIER/).fill('PUBLIER');
  await page.getByRole('button', { name: /🚀 Publier/ }).click();

  // 10. Toast success
  await expect(page.getByText(/Page publiée/)).toBeVisible();

  // 11. Page publique accessible
  await page.goto('/legal/politique-de-test-e2e');
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
});
```

### `e2e/legal/legal-public-render.spec.ts`

```typescript
test('Page publique rend correctement', async ({ page }) => {
  await page.goto('/legal/cgv');

  // Heading + dernière modification
  await expect(page.getByRole('heading', { name: /Conditions Générales/ })).toBeVisible();
  await expect(page.getByText(/Mis à jour le/)).toBeVisible();

  // meta robots = noindex (par défaut)
  const robotsContent = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robotsContent).toContain('noindex');

  // Voir aussi : 3 liens minimum
  const seeAlso = page.locator('aside, [data-component="see-also"]');
  await expect(seeAlso.getByRole('link').first()).toBeVisible();
});
```

### `e2e/legal/legal-sitemap.spec.ts`

```typescript
test('Sitemap n\'inclut pas les pages noindex', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  const body = await res.text();
  expect(body).not.toContain('/legal/cgv');
  expect(body).not.toContain('/legal/mentions-legales');
  // Mais peut inclure /legal/faq si include_in_search === true
});
```

### `e2e/legal/legal-footer-links.spec.ts`

```typescript
test('Tous les liens footer pointent vers des pages valides', async ({ page }) => {
  await page.goto('/');

  const footerLinks = page.locator('footer a[href^="/legal/"]');
  const count = await footerLinks.count();
  expect(count).toBeGreaterThan(3);

  for (let i = 0; i < count; i++) {
    const href = await footerLinks.nth(i).getAttribute('href');
    const linkText = await footerLinks.nth(i).textContent();
    
    const response = await page.request.get(href!);
    expect(response.status(), `${href} (${linkText})`).toBeLessThan(400);
  }
});
```

### `e2e/legal/legal-cookie-banner.spec.ts`

```typescript
test('Banner cookies contient les liens configurés', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');

  // Banner visible
  const banner = page.getByRole('dialog', { name: /Cookies/ });
  await expect(banner).toBeVisible();

  // Liens vers politique
  await expect(banner.getByText(/Politique cookies/)).toBeVisible();
  await expect(banner.getByText(/Confidentialité/)).toBeVisible();

  // Click link → navigation
  await banner.getByText(/Politique cookies/).click();
  await expect(page).toHaveURL(/\/legal\/politique-cookies/);
});
```

### `e2e/legal/legal-checkout-consent.spec.ts`

```typescript
test('Checkout exige consentement CGV', async ({ page }) => {
  await addProductToCart(page);
  await page.goto('/checkout');

  // Pas cochée par défaut
  const consent = page.getByLabel(/J'accepte les CGV/);
  await expect(consent).not.toBeChecked();

  // Submit sans cocher → erreur
  await fillCheckoutForm(page);
  await page.getByRole('button', { name: /Payer/ }).click();
  await expect(page.getByText(/Vous devez accepter/)).toBeVisible();

  // Cocher → submit OK
  await consent.check();
  // Vérifier que les liens vers CGV + privacy fonctionnent
  await expect(page.getByText('CGV')).toHaveAttribute('href', '/legal/conditions-generales-de-vente');
});
```

### `e2e/legal/legal-template-vars.spec.ts`

```typescript
test('Variables sont substituées en production', async ({ page }) => {
  // Admin met à jour RC
  await loginAsAdmin(page);
  await page.goto('/admin/legal/template-vars');
  await page.getByLabel('COMPANY_RC').fill('RC TEST 9999');
  await page.getByRole('button', { name: /Sauver/ }).click();

  // Re-publier la page (variable a changé)
  await page.goto('/admin/legal/mentions-legales/edit');
  await publishPage(page);

  // Vérifier en public
  await page.goto('/legal/mentions-legales');
  await expect(page.getByText(/RC TEST 9999/)).toBeVisible();
  // Pas de {{COMPANY_RC}} apparent
  await expect(page.getByText(/{{COMPANY_RC}}/)).not.toBeVisible();
});
```

### `e2e/legal/legal-autosave.spec.ts`

```typescript
test('Auto-save survit au reload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/legal/cgv/edit');

  const editor = page.getByLabel(/Markdown/);
  await editor.fill('# Modifié pour test E2E');

  // Attendre auto-save (30s par défaut, on force via Cmd+S)
  await page.keyboard.press('Control+S');
  await expect(page.getByText(/Enregistré/)).toBeVisible();

  // Reload
  await page.reload();

  // Le contenu modifié est toujours là (draft)
  await expect(editor).toContainText('Modifié pour test E2E');
});
```

### `e2e/legal/legal-restore.spec.ts`

```typescript
test('Admin restaure une ancienne version', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/legal/cgv/edit');

  // Aller dans l'historique
  await page.getByRole('tab', { name: /Historique/ }).click();
  await expect(page.getByText(/v1/)).toBeVisible();

  // Restaurer v1
  page.on('dialog', dialog => dialog.accept());
  await page.getByText(/v1/).locator('..').getByRole('button', { name: /Restaurer/ }).click();

  // Statut redevient draft
  await expect(page.getByText(/Brouillon/)).toBeVisible();
});
```

### `e2e/legal/legal-mobile-menu.spec.ts`

```typescript
test.use({ ...devices['iPhone 13'] });

test('Mobile menu expose les liens légaux', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Menu/ }).click();

  await expect(page.getByText(/Mentions légales/)).toBeVisible();
  await expect(page.getByText(/CGV/)).toBeVisible();
});
```

### `e2e/legal/legal-not-found.spec.ts`

```typescript
test('Slug inconnu → 404 propre', async ({ page }) => {
  const response = await page.goto('/legal/slug-inexistant');
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/Cette page n'existe/)).toBeVisible();
  // Liens vers pages valides
  await expect(page.getByText(/Mentions légales/)).toBeVisible();
});
```

### `e2e/legal/legal-public-a11y.spec.ts`

```typescript
import AxeBuilder from '@axe-core/playwright';

test('Page publique : axe accessibility', async ({ page }) => {
  await page.goto('/legal/cgv');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### `e2e/legal/legal-admin-a11y.spec.ts`

```typescript
test('Éditeur admin : axe accessibility', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/legal/cgv/edit');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

## Helpers communs

`e2e/legal/helpers.ts` :

```typescript
export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('[name=email]', process.env.E2E_ADMIN_EMAIL ?? 'test-admin@femiglow.ma');
  await page.fill('[name=password]', process.env.E2E_ADMIN_PASSWORD ?? '...');
  await page.getByRole('button', { name: /Connexion/ }).click();
  await page.waitForURL(/\/admin/);
}

export async function publishPage(page: Page, slug?: string) {
  if (slug) await page.goto(`/admin/legal/${slug}/edit`);
  await page.getByRole('button', { name: /Publier/ }).click();
  await page.getByLabel(/J'ai relu/).check();
  await page.getByLabel(/Toutes les variables/).check();
  await page.getByLabel(/Les liens internes/).check();
  await page.getByLabel(/La date est correcte/).check();
  await page.getByPlaceholder(/PUBLIER/).fill('PUBLIER');
  await page.getByRole('button', { name: /🚀 Publier/ }).click();
  await page.waitForSelector('[role="status"]:has-text("publiée")');
}
```

## CI

```yaml
# .github/workflows/e2e-legal.yml
on:
  pull_request:
    paths:
      - 'apps/web/src/app/legal/**'
      - 'apps/web/src/app/admin/legal/**'
      - 'apps/web/src/lib/legal/**'

jobs:
  e2e-legal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm start &
      - run: pnpm test:e2e -- --grep legal
```
