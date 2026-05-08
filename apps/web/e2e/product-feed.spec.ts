/**
 * E2E — Feed produit Kolenda-driven.
 *
 * Couvre :
 *  - /kit affiche bien la section <ProductFeedSection/> avec le rituel
 *    4 gestes + les 3 promesses + le bandeau social proof,
 *  - /feed.xml répond 200 application/xml (Google Merchant feed public),
 *  - /admin/products → bouton "Feed produit" visible et clickable,
 *  - /admin/products/feed → page preview + lien de téléchargement.
 *
 * Migration storageState (5.4.1) :
 *   Les specs admin déclarent `test.use({ storageState: ADMIN_STORAGE_PATH })`
 *   au niveau du describe. Le storageState est généré une fois par
 *   `e2e/global.setup.ts` (cf. playwright.config.ts → projet `setup`).
 *   On évite ainsi ~3 s × N tests de login répété.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('Feed produit — public', () => {
  test('/kit affiche la section feed produit avec rituel 4 gestes', async ({ page }) => {
    await page.goto('/kit');
    const section = page.getByTestId('product-feed-section');
    await expect(section).toBeVisible();

    // Heading principal du feed.
    await expect(
      section.getByRole('heading', { name: /rituel/i, level: 2 }),
    ).toBeVisible();

    // 4 gestes du rituel (titres officiels).
    await expect(section.getByText(/Préparez vos ongles/i)).toBeVisible();
    await expect(section.getByText(/Appliquez Paste/i)).toBeVisible();
    await expect(section.getByText(/Appliquez Powder/i)).toBeVisible();
    await expect(section.getByText(/Brillance naturelle/i)).toBeVisible();

    // Pastilles 1..4 visibles.
    const stepsList = section.getByRole('list', { name: /quatre gestes/i });
    await expect(stepsList).toBeVisible();
    for (const n of ['1', '2', '3', '4']) {
      await expect(stepsList.getByText(n, { exact: true }).first()).toBeVisible();
    }
  });

  test('/kit affiche les 3 promesses du visuel officiel', async ({ page }) => {
    await page.goto('/kit');
    const claimsList = page
      .getByTestId('product-feed-section')
      .getByRole('list', { name: /promesses/i });
    await expect(claimsList).toBeVisible();
    await expect(claimsList.getByText(/origine naturelle/i)).toBeVisible();
    await expect(claimsList.getByText(/sans produits chimiques agressifs/i)).toBeVisible();
    await expect(claimsList.getByText(/forts et éclatants/i)).toBeVisible();
  });

  test('/kit affiche le bandeau social proof (rating + count + citation)', async ({ page }) => {
    await page.goto('/kit');
    const proof = page.getByTestId('product-feed-social-proof');
    await expect(proof).toBeVisible();
    await expect(proof.getByText(/\d\.\d\/5/)).toBeVisible();
    await expect(proof.getByText(/\d+\s*avis/)).toBeVisible();
  });

  test('/feed.xml répond 200 application/xml avec le namespace g:', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/xml');
    expect(res.headers()['cache-control']).toContain('public');
    expect(res.headers()['etag']).toMatch(/^"[a-f0-9]{64}"$/);
    expect(res.headers()['last-modified']).toBeTruthy();
    const body = await res.text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).toContain('<g:brand>FemiGlow</g:brand>');
  });

  test('/feed.xml renvoie 304 sur If-None-Match correspondant à l\'ETag', async ({
    request,
  }) => {
    // Premier appel pour récupérer l'ETag.
    const first = await request.get('/feed.xml');
    const etag = first.headers()['etag'];
    expect(etag, 'attendu un ETag sur la 200 initiale').toBeTruthy();
    // Deuxième appel avec If-None-Match → 304 attendu.
    const second = await request.get('/feed.xml', {
      headers: { 'If-None-Match': etag },
    });
    expect(second.status()).toBe(304);
    // 304 sans body — Playwright .text() renvoie '' sur un body vide.
    expect(await second.text()).toBe('');
  });

  test('/feed.xml expose une image_link raster (pas de SVG)', async ({ request }) => {
    const res = await request.get('/feed.xml');
    const body = await res.text();
    const m = body.match(/<g:image_link>([^<]+)<\/g:image_link>/);
    expect(m, 'g:image_link doit être présent').not.toBeNull();
    const url = m![1]!;
    expect(url).not.toMatch(/\.svg(\?|$)/i);
    expect(url).toMatch(/\.(png|jpe?g|gif|bmp|tiff)(\?|$)/i);
  });

  test('/kit injecte un JSON-LD Schema.org Product avec aggregateRating', async ({
    page,
  }) => {
    await page.goto('/kit');
    // Cherche tous les <script type="application/ld+json"> et trouve celui
    // avec @type=Product.
    const productLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]',
        ),
      );
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent ?? '');
          if (data['@type'] === 'Product') return data;
        } catch {
          /* skip */
        }
      }
      return null;
    });
    expect(productLd, 'JSON-LD Product attendu sur /kit').not.toBeNull();
    expect(productLd['@context']).toBe('https://schema.org');
    expect(productLd.aggregateRating).toBeDefined();
    expect(productLd.aggregateRating['@type']).toBe('AggregateRating');
    expect(Number(productLd.aggregateRating.ratingValue)).toBeGreaterThan(4);
    expect(productLd.aggregateRating.reviewCount).toBeGreaterThan(0);
    expect(Array.isArray(productLd.review)).toBe(true);
    expect(productLd.review.length).toBeGreaterThan(0);
  });

  test('a11y — /kit ne présente aucune violation critique/serious (WCAG 2.1 AA)', async ({
    page,
  }) => {
    // Axe-core analyse l'arbre DOM complet (~200 règles) ; sur dev
    // server la première compilation de /kit + l'init axe peuvent
    // approcher 30 s. On bumpe à 60 s pour rester safe en CI froide.
    test.setTimeout(60_000);
    await page.goto('/kit');
    // Attendre le rendu du feed produit : sans ça axe scanne un DOM
    // partiellement hydraté et rate des règles (focus, ARIA dynamique).
    await expect(page.getByTestId('product-feed-section')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Politique : on bloque uniquement sur `critical` et `serious`.
    // Les `moderate` / `minor` (ex. contraste à 0.1 près) sont remontés
    // hors-CI via les rapports axe, mais ne cassent pas le pipeline.
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(
      blocking,
      `Violations a11y critiques/serious sur /kit :\n${JSON.stringify(
        blocking.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
        })),
        null,
        2,
      )}`,
    ).toEqual([]);
  });
});

test.describe('Feed produit — admin', () => {
  // Hérite de la session admin pré-établie par `global.setup.ts`.
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('/admin/products affiche le bouton « Feed produit »', async ({ page }) => {
    await page.goto('/admin/products');
    const link = page.getByTestId('admin-products-feed-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/products/feed');
  });

  test('/admin/products/feed rend l\'aperçu UI + JSON + XML + bouton télécharger', async ({
    page,
  }) => {
    await page.goto('/admin/products/feed');
    await expect(page.getByRole('heading', { name: 'Feed produit', level: 1 })).toBeVisible();

    // Aperçu UI → contient une instance de la section.
    await expect(page.getByTestId('admin-feed-preview')).toBeVisible();

    // Sections JSON et XML rendues.
    await expect(page.getByTestId('admin-feed-json')).toBeVisible();
    await expect(page.getByTestId('admin-feed-xml')).toBeVisible();

    // Bouton de téléchargement.
    const dl = page.getByTestId('admin-feed-download');
    await expect(dl).toBeVisible();
    await expect(dl).toHaveAttribute('href', '/feed.xml');
  });

  test('/admin/products/feed expose le bouton « Forcer revalidation » et POST 200', async ({
    page,
  }) => {
    // La 1re hit de /admin/products/feed compile la page + ses
    // dépendances (AdminShell, ToastProvider, ProductFeedSection,
    // FeedRevalidateButton…). Idem pour la route API au premier
    // POST. Sur dev server froid, on dépasse le timeout par défaut.
    test.setTimeout(60_000);
    await page.goto('/admin/products/feed');
    const btn = page.getByTestId('admin-feed-revalidate');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();

    // Intercepte la requête POST déclenchée par le clic et valide
    // qu'elle aboutit en 200 — on ne veut pas seulement « le bouton
    // existe », on veut « il revalide vraiment ». Le payload JSON
    // (`ok`, `slug`) est testé séparément côté integration vitest
    // (`admin-product-feed-revalidate.test.ts`) — éviter ici car
    // `router.refresh()` côté client interrompt le stream de réponse
    // avant que Playwright puisse lire `.json()` sur certains setups.
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/admin/products/feed/revalidate') &&
        res.request().method() === 'POST',
    );
    await btn.click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Toast inline « Feed revalidé. » rendu après la réponse — c'est
    // la confirmation visuelle que le composant a bien traité le 200
    // (sinon l'état `success` ne serait pas set).
    await expect(page.getByText(/Feed revalidé/i)).toBeVisible();
  });

  test('clic sur « Télécharger feed.xml » télécharge un XML Merchant valide', async ({
    page,
  }) => {
    await page.goto('/admin/products/feed');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('admin-feed-download').click();
    const download = await downloadPromise;

    // Le bouton porte `download="femiglow-feed.xml"` — le navigateur
    // utilise ce nom pour la sauvegarde locale.
    expect(download.suggestedFilename()).toBe('femiglow-feed.xml');

    // Lecture du fichier téléchargé via l'API Playwright (createReadStream).
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString('utf8');

    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">');
    expect(body).toContain('<g:brand>FemiGlow</g:brand>');
    expect(body).toMatch(/<g:image_link>[^<]+\.png<\/g:image_link>/);
    // Pas de SVG côté Merchant (validateur Google rejette).
    expect(body).not.toMatch(/<g:image_link>[^<]+\.svg<\/g:image_link>/);
  });
});

test.describe('Feed produit — admin (auth requise)', () => {
  // Pas de storageState → session anonyme, on vérifie la redirection.
  test('/admin/products/feed redirige vers /admin/login si non authentifié', async ({
    page,
  }) => {
    await page.goto('/admin/products/feed');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
