/**
 * E2E — visual regression de `<ProductFeedSection/>` sur `/kit`.
 *
 * Pourquoi un visual regression dédié ?
 *  - La section feed produit matérialise des principes Kolenda précis
 *    (small-word-near-price, microcopy dense, pastilles colorées). Une
 *    régression CSS sur ces détails (oubli de `font-display`, perte de
 *    l'accent sur une pastille…) passe sous le radar des tests
 *    fonctionnels (le DOM est correct, mais le rendu commercial est
 *    cassé).
 *  - Un snapshot pixel-by-pixel rattrape :
 *     1. les régressions Tailwind (purge agressive),
 *     2. les régressions polices (next/font, fontFeatureSettings),
 *     3. les régressions layout (grid sm/lg).
 *
 * Stratégie tolérance :
 *  - `maxDiffPixels: 100` — assez pour absorber l'antialiasing de la
 *    police entre macOS-CI et macOS-dev (les hinting subpixel diffèrent
 *    de quelques px). Au-delà, c'est un vrai changement visuel à
 *    intentionaliser via `--update-snapshots`.
 *  - `animations: 'disabled'` — fige la première frame des transitions
 *    Tailwind (`transition-opacity`, slide-over) pour stabiliser le
 *    snapshot.
 *
 * Mise à jour intentionnelle :
 *   pnpm playwright test product-feed-section.visual --update-snapshots
 *
 * **Cross-platform note** : le snapshot est généré sur la plateforme du
 * dev qui le commit (Darwin pour la team FemiGlow). En CI sur Linux,
 * Playwright préfixe automatiquement le snapshot avec la plateforme
 * (`product-feed-section-linux.png`) — il faudra générer le baseline
 * Linux séparément lors du premier run CI.
 */
import { expect, test } from '@playwright/test';

test.describe('Feed produit — visual regression', () => {
  test('<ProductFeedSection/> rend un layout pixel-stable', async ({ page }) => {
    // Les hits froids /kit peuvent dépasser le timeout par défaut (init
    // hydratation + chargement des SVG décoratifs). On bumpe à 60s.
    test.setTimeout(60_000);

    await page.goto('/kit');
    const section = page.getByTestId('product-feed-section');
    await expect(section).toBeVisible();

    // Attendre que les pastilles de step soient rendues (sinon le
    // snapshot peut capturer un layout pré-hydratation).
    await expect(
      section.getByRole('list', { name: /quatre gestes/i }),
    ).toBeVisible();

    // Snapshot complet de la section. `maxDiffPixels` tolère le bruit
    // antialiasing inter-machines sans masquer une vraie régression.
    await expect(section).toHaveScreenshot('product-feed-section.png', {
      maxDiffPixels: 100,
      animations: 'disabled',
    });
  });
});
