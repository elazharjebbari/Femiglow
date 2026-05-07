# Testing — Scénarios Playwright

7 scénarios e2e couvrent le flux admin produits. DB testcontainer +
seed dédié.

Fichier : `apps/web/test/e2e/products-cms.spec.ts`.

## Pré-requis

- DB testcontainer (Postgres 16 + extensions)
- Migrations + seed `products-bootstrap` + `users-test`
- `.env.test` chargé
- `PLAYWRIGHT_AUTH_BYPASS=admin@femiglow.test`

## Scénario 1 — Créer un produit minimal

```ts
test('création produit + slug unique', async ({ page }) => {
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Nouveau' }).click();
  await page.getByLabel('Slug').fill('serum-eclat');
  await page.getByLabel('Titre').fill('Sérum Éclat');
  await page.getByRole('button', { name: 'Créer le brouillon' }).click();

  await expect(page).toHaveURL(/\/admin\/products\/serum-eclat$/);
  await expect(page.getByText('Statut: Draft')).toBeVisible();

  // tentative de doublon
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Nouveau' }).click();
  await page.getByLabel('Slug').fill('serum-eclat');
  await page.getByRole('button', { name: 'Créer le brouillon' }).click();
  await expect(page.getByText(/déjà pris/i)).toBeVisible();
});
```

## Scénario 2 — Ajouter / éditer / réordonner variantes

```ts
test('CRUD + reorder variantes', async ({ page }) => {
  await page.goto('/admin/products/kit');
  await page.getByRole('tab', { name: 'Variantes' }).click();

  // ajout
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByPlaceholder('SKU').last().fill('KIT-LMT');
  await page.getByPlaceholder('Label').last().fill('Édition limitée');
  await page.getByPlaceholder('Prix').last().fill('99,00');
  await page.getByPlaceholder('Prix').last().blur();
  await expect(page.getByText('Variante créée')).toBeVisible();

  // édition
  await page.getByPlaceholder('Promo').last().fill('79,00');
  await page.getByPlaceholder('Promo').last().blur();
  await expect(page.getByText('-20%')).toBeVisible();

  // promo invalide
  await page.getByPlaceholder('Promo').last().fill('120,00');
  await page.getByPlaceholder('Promo').last().blur();
  await expect(page.getByText('promo doit être < prix')).toBeVisible();

  // reorder
  const rows = page.getByRole('row');
  await rows.nth(2).dragTo(rows.nth(1));
  // vérifier que l'ordre a été persisté via reload
  await page.reload();
  // ...
});
```

## Scénario 3 — Upload packshot puis publish

```ts
test('upload packshot, publish, vérif front', async ({ page }) => {
  await page.goto('/admin/products/serum-eclat');
  await page.getByRole('tab', { name: 'Médias' }).click();

  // upload packshot via MediaPicker
  await page.getByTestId('slot-pick-packshot').click();
  await page.getByLabel('Choisir un fichier').setInputFiles('test/fixtures/packshot.jpg');
  await page.getByRole('button', { name: 'Téléverser' }).click();
  await expect(page.getByText('Téléversement complet')).toBeVisible();

  // publish bloqué tant qu'aucune variante
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText(/au moins 1 variante/i)).toBeVisible();

  // ajout variante minimale
  await page.getByRole('tab', { name: 'Variantes' }).click();
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByPlaceholder('SKU').last().fill('SE-30');
  await page.getByPlaceholder('Label').last().fill('30 ml');
  await page.getByPlaceholder('Prix').last().fill('39,00');
  await page.getByPlaceholder('Prix').last().blur();

  // publish
  await page.getByRole('button', { name: 'Publier' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Statut: Publié')).toBeVisible();

  // vérif front
  const front = await page.request.get('/produits/serum-eclat');
  const html = await front.text();
  expect(html).toContain('Sérum Éclat');
  expect(html).toContain('39');
});
```

## Scénario 4 — Restaurer un snapshot

```ts
test('restore snapshot', async ({ page }) => {
  await page.goto('/admin/products/kit');
  await page.getByRole('tab', { name: 'Historique' }).click();

  const firstSnapshot = page.getByTestId('snapshot-row').first();
  await firstSnapshot.getByRole('button', { name: 'Restaurer' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByText('Brouillon restauré')).toBeVisible();
});
```

## Scénario 5 — Archive et restauration

```ts
test('archiver puis désarchiver', async ({ page }) => {
  await page.goto('/admin/products/kit');
  await page.getByRole('button', { name: 'Plus d\'actions' }).click();
  await page.getByRole('menuitem', { name: 'Archiver' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  // 410 sur le front
  const resp = await page.request.get('/produits/kit');
  expect(resp.status()).toBe(410);

  // listing exclut le produit
  await page.goto('/admin/products');
  await expect(page.getByText('Le Kit FemiGlow')).not.toBeVisible();

  // toggle « inclure archivés »
  await page.getByLabel('Inclure archivés').check();
  await expect(page.getByText('Le Kit FemiGlow')).toBeVisible();

  // restaurer
  await page.getByRole('row', { name: /Le Kit/ }).getByRole('button', { name: 'Restaurer' }).click();
  await expect(page.getByText('Statut: Draft')).toBeVisible();
});
```

## Scénario 6 — Search + filter

```ts
test('recherche live + filtre statut', async ({ page }) => {
  await page.goto('/admin/products');
  await page.getByPlaceholder('recherche').fill('rituel');
  await expect(page.getByRole('row')).toHaveCount(2);     // header + 1 résultat

  await page.getByLabel('Statut').selectOption('draft');
  await expect(page.getByText('Aucun produit')).toBeVisible();
});
```

## Scénario 7 — Cascade : produit né en admin

```ts
test('produit né en admin (pas dans le registre)', async ({ page }) => {
  // créer + variante + packshot + publish (cf scénarios 1+2+3)
  // ...

  // vérifier que /produits affiche bien le nouveau slug
  const listing = await page.request.get('/produits');
  expect(await listing.text()).toContain('serum-eclat');

  // vérifier resolveProduct côté serveur (sans registre codé)
  const detail = await page.request.get('/produits/serum-eclat');
  expect(detail.status()).toBe(200);
});
```

## Run

```bash
pnpm test:e2e -- products-cms
pnpm test:e2e -- products-cms --headed --debug
```

## Convention

- Cleanup : fixture `productsFresh` truncate + reseed avant chaque test
- Sélecteurs : `getByRole` > `getByLabel` > `getByText` > `getByTestId`
- Pas de `waitForTimeout` — toujours `expect.toBeVisible(...)` avec timeout
