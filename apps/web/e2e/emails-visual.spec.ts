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
import {
  seedCustomTemplate,
  seedCampaign,
  cleanupTemplatesBySlugPrefix,
  cleanupCampaignsByIdPrefix,
  closeE2eSql,
} from './_helpers/emails-db';

const ENABLED = process.env.EMAILS_VISUAL === '1';

// ── Entités seedées pour les écrans P3 nécessitant une cible (IDs FIXES :
// les chemins de screenshot sont figés à la collecte, donc on ne peut pas
// dépendre d'un id renvoyé async). Préfixe `e2e-vis-` → cleanup scopé.
const VIS_PREFIX = 'e2e-vis-';
const VIS_TEMPLATE_ID = 'e2e0a000-0000-4000-8000-0000000000f7';
const VIS_TEMPLATE_VERSION_ID = 'e2e0a000-0000-4000-8000-0000000000f8';
const VIS_CAMPAIGN_ID = `${VIS_PREFIX}campaign`;

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
  // ── P3 — surfaces refondues sans dépendance Listmonk (DB pure) ──────────
  // (Le wizard campagne — P3.2 — appelle Listmonk au render ; sa baseline
  // propre attend un Listmonk e2e dédié, même verrou que SM-F05-01.)
  {
    id: 'templates-list',
    path: '/admin/emails/templates',
    ready: (p) => p.getByRole('heading', { level: 1 }).first().waitFor(),
  },
  {
    id: 'template-editor',
    path: `/admin/emails/templates/${VIS_TEMPLATE_ID}/edit`,
    ready: (p) => p.getByTestId('preview-frame').waitFor(),
  },
  {
    id: 'campaign-detail',
    path: `/admin/emails/campaigns/${VIS_CAMPAIGN_ID}`,
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

  // Pose les cibles des écrans P3 (template éditable + campagne au détail).
  // Statut `sending` + métriques figées → screenshot déterministe du Pill
  // « En cours d'envoi » (miroir visuel de l'oracle SM-F05-01).
  test.beforeAll(async () => {
    if (!ENABLED) return;
    await cleanupTemplatesBySlugPrefix(VIS_PREFIX);
    await cleanupCampaignsByIdPrefix(VIS_PREFIX);
    await seedCustomTemplate({
      id: VIS_TEMPLATE_ID,
      versionId: VIS_TEMPLATE_VERSION_ID,
      slug: `${VIS_PREFIX}charte`,
      name: 'Charte FemiGlow',
      description: 'Gabarit éditorial mensuel',
    });
    await seedCampaign({
      id: VIS_CAMPAIGN_ID,
      status: 'sending',
      name: 'Newsletter juin',
      subject: '✨ Rituels de juin',
      preheader: 'Ton rituel du mois',
      sentCount: 1234,
      openCount: 412,
      clickCount: 87,
      bounceCount: 5,
      startedAt: new Date('2026-06-15T09:00:00.000Z'),
      listmonkCampaignId: 90001,
    });
  });

  test.afterAll(async () => {
    if (!ENABLED) return;
    await cleanupTemplatesBySlugPrefix(VIS_PREFIX);
    await cleanupCampaignsByIdPrefix(VIS_PREFIX);
    await closeE2eSql();
  });

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
