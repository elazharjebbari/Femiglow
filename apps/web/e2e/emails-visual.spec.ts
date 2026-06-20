/**
 * Couche D — non-régression visuelle du sous-système admin/emails (charte 09
 * §A.6, gate G10). Snapshots Playwright par écran refondu, aux 3 viewports
 * (mobile 375 / tablette 768 / desktop 1280).
 *
 * OPT-IN : ce fichier ne tourne QUE si `EMAILS_VISUAL=1` — sinon il est skip
 * (les baselines de screenshot sont sensibles à l'environnement de rendu :
 * police, anti-aliasing… ; elles ne doivent pas casser la CI fonctionnelle).
 *
 * Cycle de revue de phase (08-runbook §5.5a) :
 *   # générer/mettre à jour la baseline sur l'instance :3100 (build à jour) :
 *   EMAILS_VISUAL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
 *     pnpm exec playwright test e2e/emails-visual.spec.ts --update-snapshots
 *   # puis vérifier (doit être vert, 0 diff) :
 *   EMAILS_VISUAL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
 *     pnpm exec playwright test e2e/emails-visual.spec.ts
 *
 * La baseline validée est archivée au journal (verdict design signé).
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

const ENABLED = process.env.EMAILS_VISUAL === '1';

/** Écrans refondus à épingler (un par chantier livré ; étendu à chaque phase). */
const SCREENS: { id: string; path: string; ready: (p: Page) => Promise<unknown> }[] = [
  {
    id: 'dashboard',
    path: '/admin/emails',
    ready: (p) => p.getByTestId('kpi-card-total').waitFor(),
  },
  {
    id: 'cockpit',
    path: '/admin/emails/transactional',
    ready: (p) => p.getByTestId('filtered-table').waitFor(),
  },
  {
    id: 'suppression',
    path: '/admin/emails/suppression',
    ready: (p) => p.getByTestId('suppression-list').waitFor(),
  },
  {
    id: 'audiences',
    path: '/admin/emails/audiences',
    ready: (p) => p.getByRole('heading', { level: 1 }).first().waitFor(),
  },
];

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

test.describe('Couche D — régression visuelle emails @emails-visual', () => {
  test.skip(!ENABLED, 'EMAILS_VISUAL=1 requis (baselines validées en revue de phase)');
  test.use({ storageState: ADMIN_STORAGE_PATH });

  for (const screen of SCREENS) {
    for (const vp of VIEWPORTS) {
      test(`D-${screen.id}-${vp.name} — ${screen.path} @ ${vp.width}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path);
        await screen.ready(page);
        // Masque les zones intrinsèquement variables (dates relatives, compteurs
        // temps réel) pour des diffs stables sur la STRUCTURE/design, pas la donnée.
        await expect(page).toHaveScreenshot(`${screen.id}-${vp.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          mask: [page.locator('[data-testid="dashboard-age"]')],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
