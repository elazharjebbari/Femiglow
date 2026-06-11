/**
 * AI Engine — Golden Path scenario (serial).
 *
 * Complete end-to-end flow: Brief -> Generate -> Result -> Library link.
 * Uses page.route() to mock the generate API.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip, disableHumanReview } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_GENERATE_RESPONSE = {
  jobId: 'golden-path-job-001',
  status: 'completed',
  script: {
    hook: 'Decouvrez le secret des Japonaises pour une peau eclatante',
    scenes: [
      { sceneNumber: 1, description: 'Gros plan sur le produit Tsubaki Oil' },
      { sceneNumber: 2, description: 'Application du serum sur le visage' },
    ],
    cta: 'Commandez votre rituel FemiGlow',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Votre peau merite le meilleur de la J-Beauty. Le rituel FemiGlow transforme votre routine en un moment de luxe.',
  hashtags: ['femiglow', 'jbeauty', 'skincare', 'rituel'],
  images: [],
  videos: [],
  qualityScores: {
    text_quality: 0.92,
    brand_compliance: 0.95,
    hook_strength: 0.88,
    average: 0.91,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.25, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 4200,
  bridgeResult: { ideaId: 'ci_golden', briefId: 'cb_golden', draftId: 'cd_golden' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_golden',
};

test.describe.serial('Golden Path: Brief -> Generate -> Library', () => {
  let sharedPage: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_PATH });
    sharedPage = await context.newPage();

    // Mock the generate API for all requests in this context.
    await sharedPage.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GENERATE_RESPONSE),
      });
    });
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  // 1. Navigate to AI Engine dashboard
  test('navigate to AI Engine dashboard', async () => {
    await gotoAIEngine(sharedPage);
    ensureAuthOrSkip(sharedPage);

    // « AI Engine » apparaît plusieurs fois (sidebar, subnav, eyebrow) : on cible l'eyebrow.
    await expect(sharedPage.locator('.cs-eyebrow', { hasText: 'AI Engine' })).toBeVisible({ timeout: 15_000 });
    await expect(sharedPage.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible({ timeout: 15_000 });
  });

  // 2. Click "Nouvelle generation IA"
  test('click "Nouvelle generation IA"', async () => {
    const ctaLink = sharedPage.getByRole('link', { name: /Nouvelle génération IA/i });
    await expect(ctaLink).toBeVisible({ timeout: 15_000 });
    await ctaLink.click();
    await sharedPage.waitForURL(/\/ai-engine\/create/, { timeout: 15_000 });
  });

  // 3. Verify create page loaded
  test('verify create page loaded', async () => {
    await expect(
      sharedPage.getByRole('heading', { name: /Nouvelle génération/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(sharedPage.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  });

  // 4. Fill objective
  test('fill objective: "Engagement communauté"', async () => {
    await sharedPage.locator('select').nth(0).selectOption('engagement');
    await expect(sharedPage.locator('select').nth(0)).toHaveValue('engagement');
  });

  // 5. Fill platform
  test('fill platform: "Instagram"', async () => {
    await sharedPage.locator('select').nth(1).selectOption('instagram');
    await expect(sharedPage.locator('select').nth(1)).toHaveValue('instagram');
  });

  // 6. Fill format
  test('fill format: "Carrousel"', async () => {
    await sharedPage.locator('select').nth(2).selectOption('carousel');
    await expect(sharedPage.locator('select').nth(2)).toHaveValue('carousel');
  });

  // 7. Fill tone
  test('fill tone: "Premium / Luxe"', async () => {
    await sharedPage.locator('select').nth(3).selectOption('luxurious');
    await expect(sharedPage.locator('select').nth(3)).toHaveValue('luxurious');
  });

  // 8. Fill key message
  test('fill key message', async () => {
    await sharedPage.locator('textarea').first().fill('Le rituel FemiGlow transforme votre routine beaute');
    await expect(sharedPage.locator('textarea').first()).toHaveValue(
      'Le rituel FemiGlow transforme votre routine beaute',
    );
  });

  // 9. Fill product focus
  test('fill product focus', async () => {
    await sharedPage.locator('input[type="text"]').first().fill('Tsubaki Oil Serum');
    await expect(sharedPage.locator('input[type="text"]').first()).toHaveValue('Tsubaki Oil Serum');
  });

  // 10. Click "Générer"
  test('click "Générer"', async () => {
    // HITL ON par défaut : on le désactive pour atteindre la phase « Contenu généré ».
    await disableHumanReview(sharedPage);
    const genButton = sharedPage.getByRole('button', { name: /Générer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();
  });

  // 11. Wait for pipeline progress to show
  test('pipeline progress is visible', async () => {
    await expect(sharedPage.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });
  });

  // 12. Verify result appears with script
  test('result appears with script', async () => {
    await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    await expect(sharedPage.getByText('Script')).toBeVisible({ timeout: 10_000 });
  });

  // 13. Verify caption is displayed
  test('caption is displayed', async () => {
    await expect(sharedPage.getByText('Caption')).toBeVisible({ timeout: 10_000 });
    await expect(
      sharedPage.getByText(/Votre peau merite le meilleur/),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 14. Verify quality score badge
  test('quality scores are displayed', async () => {
    await expect(sharedPage.getByText('Scores qualité')).toBeVisible({ timeout: 10_000 });
  });

  // 15. Verify "Voir dans la Bibliotheque" link is present
  test('"Voir dans la Bibliotheque" link is present', async () => {
    const link = sharedPage.getByRole('link', { name: /Voir dans la Bibliothèque/i });
    await expect(link).toBeVisible({ timeout: 10_000 });
    const href = await link.getAttribute('href');
    expect(href).toContain('/library');
  });
});
