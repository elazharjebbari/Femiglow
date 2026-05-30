/**
 * MP-VO/SU/CO E2E (BUG-004) — the "Studio média" tracks panel golden path.
 *
 * Reuses the mocked create flow (idea → variant → video) from create-helpers,
 * then exercises the three new per-draft media-production endpoints
 * (voice-over / subtitles / compose) through the UI. Fully mocked via
 * `page.route` so it is deterministic; requires the server to render with
 * CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true (the panel is flag-gated).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function registerTrackMocks(page: import('@playwright/test').Page) {
  // MP-VO ergonomics — suggested narration fetched on panel mount.
  await page.route('**/api/admin/content-studio/drafts/*/voiceover-script', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ script: 'Le rituel FemiGlow, un geste lent et apaisant.' }),
    }),
  );
  await page.route('**/api/admin/content-studio/drafts/*/generate-voiceover', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        media: {
          id: 'me_vo',
          role: 'voiceover',
          kind: 'audio',
          previewUrl: '/_media/content-studio/mock/reel-9x16.mp4',
          provider: 'mock',
          voice: 'mock',
          durationSec: 4,
          script: 'Le rituel FemiGlow, un geste lent et apaisant.',
        },
      }),
    }),
  );
  await page.route('**/api/admin/content-studio/drafts/*/generate-subtitles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        media: {
          id: 'me_srt',
          role: 'subtitles',
          kind: 'subtitles',
          srt: '1\n00:00:00,000 --> 00:00:01,500\nLe rituel FemiGlow\n',
          cueCount: 3,
          provider: 'rule-based',
        },
      }),
    }),
  );
  await page.route('**/api/admin/content-studio/drafts/*/compose', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        media: {
          id: 'me_co',
          role: 'composed_video',
          kind: 'video',
          previewUrl: '/_media/content-studio/mock/reel-9x16.mp4',
          hasVoiceover: true,
          hasMusic: false,
          hasSubtitles: true,
          durationSec: 5,
        },
      }),
    }),
  );
}

test.describe('Content Studio v2 — media studio tracks (voice-over / subtitles / montage)', () => {
  test('generate video → voice-over → subtitles → compose', async ({ page }) => {
    await registerCreateMocks(page);
    await registerTrackMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Drive to a video draft (reel) — same as the golden path.
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page
      .getByRole('textbox')
      .first()
      .fill('Présenter le rituel du soir comme un geste lent et apaisant.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole("button", { name: /Générer une? (vidéo|visuel) IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });

    // The flag-gated tracks panel must appear for the video draft.
    const panel = page.locator('[data-cs-media-tracks]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Voice-over → the narration textarea is prefilled (editable), then generate.
    const script = page.locator('[data-cs-voiceover-script]');
    await expect(script).toHaveValue(/FemiGlow/i, { timeout: 10_000 });
    await script.fill('Texte de voix-off ajusté par l’opérateur.');
    await page.locator('[data-cs-generate-voiceover]').click();
    await expect(page.locator('[data-cs-voiceover-player]')).toBeVisible({ timeout: 10_000 });

    // Subtitles → cue count.
    await page.locator('[data-cs-generate-subtitles]').click();
    await expect(page.locator('[data-cs-subtitles-count]')).toContainText(/sous-titre/i, {
      timeout: 10_000,
    });

    // Compose → composed video + track manifest.
    await page.locator('[data-cs-compose]').click();
    await expect(page.locator('[data-cs-composed-player]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-cs-compose-manifest]')).toContainText(/voix-off/i);
    await expect(page.locator('[data-cs-compose-manifest]')).toContainText(/sous-titres/i);
  });

  test('compose surfaces a 409 error inline when no primary video exists', async ({ page }) => {
    await registerCreateMocks(page);
    await page.route('**/api/admin/content-studio/drafts/*/voiceover-script', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ script: 'x' }) }),
    );
    // override compose with a 409 to verify error surfacing.
    await page.route('**/api/admin/content-studio/drafts/*/compose', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'invalid_state', message: 'Aucune vidéo principale à monter. Générez d’abord la vidéo.' },
        }),
      }),
    );
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page
      .getByRole('textbox')
      .first()
      .fill('Rituel du soir, geste lent et apaisant pour la peau.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole("button", { name: /Générer une? (vidéo|visuel) IA/i }).click();
    await expect(page.locator('[data-cs-media-tracks]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-cs-compose]').click();
    await expect(page.getByText(/Aucune vidéo principale à monter/i)).toBeVisible({ timeout: 10_000 });
  });
});
