# Testing — Scénarios Playwright

6 scénarios e2e couvrent le flux admin SEO. Tous tournent contre une
DB testcontainer + un seed dédié (`pnpm test:e2e:setup`).

Fichier : `apps/web/test/e2e/seo-cms.spec.ts`.

## Pré-requis

- DB testcontainer démarrée (Postgres 16 + extensions)
- Migrations appliquées + seed `seo-known-pages` + `users-test`
- Variables `.env.test` chargées
- Auth bypass activé (`PLAYWRIGHT_AUTH_BYPASS=admin@femiglow.test`)

## Scénario 1 — Créer + publier un override

```ts
test('create + publish override pour /kit', async ({ page }) => {
  await page.goto('/admin/seo');
  await page.getByRole('button', { name: 'Nouveau' }).click();
  await page.getByLabel('Scope').selectOption('page');
  await page.getByLabel('Target key').fill('kit');
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();

  await expect(page).toHaveURL(/\/admin\/seo\/page\/kit$/);
  await page.getByLabel('Title').fill('Le Kit FemiGlow — soin essentiel');
  await page.getByLabel('Description').fill('Routine douce, pensée pour les peaux fatiguées.');
  await page.getByRole('button', { name: 'Sauver le brouillon' }).click();

  await expect(page.getByRole('status')).toContainText('Brouillon enregistré');

  await page.getByRole('button', { name: 'Publier' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByRole('status')).toContainText('Publié');

  // vérification front
  const frontResp = await page.request.get('/kit');
  expect(await frontResp.text()).toContain('<title>Le Kit FemiGlow — soin essentiel');
});
```

## Scénario 2 — Le linter bloque le publish si erreur

```ts
test('publish bloqué tant qu une erreur reste', async ({ page }) => {
  await page.goto('/admin/seo/page/kit');
  await page.getByLabel('Canonical').fill('not-a-url');

  await expect(page.getByRole('button', { name: 'Publier' })).toBeDisabled();
  await expect(page.getByText('canonical: URL absolue requise')).toBeVisible();

  await page.getByLabel('Canonical').fill('https://femiglow.com/kit');
  await expect(page.getByRole('button', { name: 'Publier' })).toBeEnabled();
});
```

## Scénario 3 — Preview SERP / FB / Twitter live

```ts
test('previews suivent la frappe avec debounce', async ({ page }) => {
  await page.goto('/admin/seo/page/kit');
  const titleField = page.getByLabel('Title');
  await titleField.fill('Nouveau titre test');

  // attendre debounce 350 ms
  await expect(page.getByTestId('serp-title')).toContainText('Nouveau titre test', { timeout: 1500 });
  await expect(page.getByTestId('facebook-title')).toContainText('Nouveau titre test');
  await expect(page.getByTestId('twitter-title')).toContainText('Nouveau titre test');
});
```

## Scénario 4 — Restaurer un snapshot

```ts
test('restore d un snapshot pré-remplit le draft', async ({ page }) => {
  await page.goto('/admin/seo/page/kit');
  await page.getByRole('tab', { name: 'Historique' }).click();

  const firstSnapshot = page.getByTestId('snapshot-row').first();
  await firstSnapshot.getByRole('button', { name: 'Restaurer' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByRole('status')).toContainText('Brouillon restauré');
  // le draft doit avoir le payload du snapshot, pas re-publié
  await expect(page.getByText('Modifications non publiées')).toBeVisible();
});
```

## Scénario 5 — `noindex` exclut du sitemap

```ts
test('noindex exclut bien la page du sitemap', async ({ page }) => {
  await page.goto('/admin/seo/page/kit');
  await page.getByLabel('Indexable').uncheck();
  await page.getByRole('button', { name: 'Sauver le brouillon' }).click();
  await page.getByRole('button', { name: 'Publier' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  const sitemap = await page.request.get('/sitemap.xml').then(r => r.text());
  expect(sitemap).not.toContain('https://femiglow.com/kit</loc>');
});
```

## Scénario 6 — OG dynamique

```ts
test('og image dynamique servi pour /kit', async ({ page }) => {
  // override déjà publié avec ogImageTemplate='marketing'
  const resp = await page.request.get('/api/og/page/kit');
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toMatch(/image\/png/);

  const buffer = await resp.body();
  expect(buffer.byteLength).toBeGreaterThan(20_000);
  expect(buffer.byteLength).toBeLessThan(220_000);
});
```

## Convention

- Un scénario par user story (pas de tests « combinés »)
- Sélecteurs : `getByRole` > `getByLabel` > `getByText` > `getByTestId`
- Pas de `page.waitForTimeout` — toujours un `expect.toBeVisible` /
  `toContainText` avec timeout
- Cleanup : un fixture Playwright `seoOverride` truncate les tables
  avant chaque test (cf. `test/e2e/fixtures/seo.ts`)

## Run

```bash
pnpm test:e2e -- seo-cms
pnpm test:e2e -- seo-cms --headed --debug   # debug local
pnpm test:e2e -- seo-cms --reporter=html    # rapport CI
```

CI : tests SEO regroupés dans le workflow `e2e-admin.yml` qui tourne
sur PR sur `apps/web/src/{lib,components,app}/seo/**`.
