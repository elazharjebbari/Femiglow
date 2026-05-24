/**
 * Content Studio v2 — video upload + trim flow.
 *
 * Validates the VideoTrimmer controls (start/end range, duration
 * display) and successful/error upload paths with mocked backend.
 *
 * All API calls are intercepted via `page.route()`.
 */
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

const FIXTURES = path.join(process.cwd(), 'e2e', 'fixtures');

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

/** Navigate to /create and open the upload dialog, then select a video file. */
async function openUploaderWithVideo(page: import('@playwright/test').Page) {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

  const importBtn = page.getByRole('button', { name: /importer un média/i });
  await expect(importBtn).toBeVisible({ timeout: 10_000 });
  await importBtn.click();

  // Wait for dialog
  await expect(page.getByRole('heading', { name: /importer un média/i })).toBeVisible();

  // Select video via file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(FIXTURES, 'test-video.mp4'));
}

test.describe('upload video — trimmer', () => {
  test('selecting video via file input opens trimmer', async ({ page }) => {
    await openUploaderWithVideo(page);

    // Trimmer should appear
    await expect(page.locator('.cs-trimmer')).toBeVisible({ timeout: 10_000 });
  });

  test('trimmer shows start/end range inputs', async ({ page }) => {
    await openUploaderWithVideo(page);
    await expect(page.locator('.cs-trimmer')).toBeVisible({ timeout: 10_000 });

    // Start range input
    const startInput = page.locator('input[aria-label="Début"]');
    await expect(startInput).toBeAttached();

    // End range input
    const endInput = page.locator('input[aria-label="Fin"]');
    await expect(endInput).toBeAttached();
  });

  test('duration display visible', async ({ page }) => {
    await openUploaderWithVideo(page);
    await expect(page.locator('.cs-trimmer')).toBeVisible({ timeout: 10_000 });

    // Duration display shows "{n}s / 90s" pattern
    await expect(page.getByText(/\d+(\.\d+)?s\s*\/\s*90s/)).toBeVisible({ timeout: 5_000 });
  });

  test('confirm trim with mocked upload -> toast success', async ({ page }) => {
    // Mock the upload-and-trim endpoint
    await page.route('**/api/admin/content-studio-v2/media/upload-and-trim', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          media: {
            id: 'mock-video-001',
            kind: 'video',
            compartment: 'imported',
            alt: 'test-video',
            slug: 'test-video',
            thumbnailUrl: null,
            previewUrl: '/mock-video-preview.mp4',
            originalUrl: '/mock-video-original.mp4',
            durationSec: 5,
            createdAt: new Date().toISOString(),
          },
        }),
      }),
    );

    await openUploaderWithVideo(page);
    await expect(page.locator('.cs-trimmer')).toBeVisible({ timeout: 10_000 });

    // The confirm button "Decouper et importer" should be enabled for a 5s video (> 1s, < 90s)
    const confirmBtn = page.getByRole('button', { name: /découper et importer/i });
    await expect(confirmBtn).toBeVisible();

    // Wait for loadedmetadata to set duration
    await page.waitForTimeout(1000);
    await confirmBtn.click();

    // Toast success
    await expect(page.getByText('Vidéo importée avec succès')).toBeVisible({ timeout: 5_000 });
  });

  test('upload network error -> error panel', async ({ page }) => {
    // Mock the trim endpoint to return 500
    await page.route('**/api/admin/content-studio-v2/media/upload-and-trim', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Erreur serveur lors du traitement vidéo' },
        }),
      }),
    );

    await openUploaderWithVideo(page);
    await expect(page.locator('.cs-trimmer')).toBeVisible({ timeout: 10_000 });

    const confirmBtn = page.getByRole('button', { name: /découper et importer/i });
    await page.waitForTimeout(1000);
    await confirmBtn.click();

    // Error panel inside the dialog
    const dialog = page.getByLabel('Importer un média');
    await expect(dialog.getByText('Erreur', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: /réessayer/i })).toBeVisible();
  });
});
