/**
 * Content Studio v2 — image upload + crop flow.
 *
 * Validates the Uploader dialog, ImageCropper controls, successful
 * upload with mocked backend, and error states (network error,
 * invalid file type, file too large).
 *
 * All API calls are intercepted via `page.route()` so no real uploads
 * occur against staging.
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

/** Navigate to /create and open the upload dialog. */
async function openUploadDialog(page: import('@playwright/test').Page) {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);
  // Wait for workspace to be interactive
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

  // Click "Importer un media" button in the MediaPicker
  const importBtn = page.getByRole('button', { name: /importer un média/i });
  await expect(importBtn).toBeVisible({ timeout: 10_000 });
  await importBtn.click();
}

test.describe('upload image — dialog & cropper', () => {
  test('opens dialog with drop zone text', async ({ page }) => {
    await openUploadDialog(page);

    // Dialog should show with title
    await expect(page.getByRole('heading', { name: /importer un média/i })).toBeVisible();

    // Drop zone text
    await expect(page.getByText('Glissez un fichier ici')).toBeVisible();
  });

  test('selecting image via file input opens cropper', async ({ page }) => {
    await openUploadDialog(page);

    // Set image via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));

    // Cropper should appear
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });
  });

  test('cropper aspect ratio buttons are interactive', async ({ page }) => {
    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    // Click each ratio button and verify it becomes visually active
    const ratios = ['Libre', '1 : 1', '4 : 5', '9 : 16', '16 : 9'];
    for (const label of ratios) {
      const btn = page.locator('.cs-cropper-toolbar').getByRole('button', { name: label, exact: true });
      await btn.click();
      // The active button gets a different background (fg-primary color).
      // We just verify it's clickable and still visible.
      await expect(btn).toBeVisible();
    }
  });

  test('zoom slider accepts value changes', async ({ page }) => {
    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    const zoom = page.locator('input[aria-label="Zoom"]');
    await expect(zoom).toBeVisible();

    // Set zoom to 2
    await zoom.fill('2');
    await expect(zoom).toHaveValue('2');
  });

  test('rotation button works', async ({ page }) => {
    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    const rotateBtn = page.locator('button[aria-label="Rotation 90°"]');
    await expect(rotateBtn).toBeVisible();
    await rotateBtn.click();
    // Button should remain visible and clickable after rotation
    await expect(rotateBtn).toBeVisible();
  });

  test('confirm crop with mocked upload -> toast success + dialog closes', async ({ page }) => {
    // Mock the upload endpoint
    await page.route('**/api/admin/content-studio-v2/media/upload-and-crop', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          media: {
            id: 'mock-media-001',
            kind: 'image',
            compartment: 'imported',
            alt: 'test-image',
            slug: 'test-image',
            thumbnailUrl: null,
            previewUrl: '/mock-preview.jpg',
            originalUrl: '/mock-original.jpg',
            createdAt: new Date().toISOString(),
          },
        }),
      }),
    );

    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    // The confirm button "Recadrer et importer"
    const confirmBtn = page.getByRole('button', { name: /recadrer et importer/i });
    await expect(confirmBtn).toBeVisible();

    // Wait for react-easy-crop to fire onCropComplete (pixelArea != null)
    // so the button becomes enabled. Small delay for the crop callback.
    await page.waitForTimeout(500);
    await confirmBtn.click();

    // Toast success
    await expect(page.getByText('Image importée avec succès')).toBeVisible({ timeout: 5_000 });

    // Dialog should close (drop zone text should no longer be visible)
    await expect(page.getByText('Glissez un fichier ici')).not.toBeVisible({ timeout: 3_000 });
  });

  test('upload network error (mock 500) -> error panel + Reessayer visible', async ({ page }) => {
    // Mock the upload endpoint to return 500
    await page.route('**/api/admin/content-studio-v2/media/upload-and-crop', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Internal Server Error' },
        }),
      }),
    );

    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));
    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    // Wait for crop callback
    await page.waitForTimeout(500);

    const confirmBtn = page.getByRole('button', { name: /recadrer et importer/i });
    await confirmBtn.click();

    // Error panel with "Erreur" heading and "Reessayer" button
    await expect(page.getByText('Erreur')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  });

  test('invalid file type (.pdf) -> error message', async ({ page }) => {
    await openUploadDialog(page);

    // The file input has accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
    // But Playwright setInputFiles bypasses accept validation.
    // The handleFile function checks file.type — a PDF has type "application/pdf".
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test.pdf'));

    // Should show error stage with the unsupported type message
    await expect(page.getByText('Erreur')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/type non supporté/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  });

  test('server rejects oversized file (mock 413) -> error with message', async ({ page }) => {
    // Mock the upload endpoint to return 413 (as the server would for a >25MB file).
    // We use the small test image to keep the test fast — the server-side
    // size check is what we're validating, not the client-side accept attr.
    await page.route('**/api/admin/content-studio-v2/media/upload-and-crop', (route) =>
      route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Fichier trop volumineux (max 25 Mo)' },
        }),
      }),
    );

    await openUploadDialog(page);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURES, 'test-image.jpg'));

    await expect(page.locator('.cs-cropper')).toBeVisible({ timeout: 5_000 });

    // Wait for crop callback
    await page.waitForTimeout(500);

    const confirmBtn = page.getByRole('button', { name: /recadrer et importer/i });
    await confirmBtn.click();

    // Should show error from the 413 response in the dialog
    const dialog = page.getByLabel('Importer un média');
    await expect(dialog.getByText('Erreur')).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(/trop volumineux/i)).toBeVisible();
  });
});
