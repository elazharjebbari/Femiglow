/**
 * E2E — Vérifie que l'endpoint /api/admin/content-studio/models retourne les
 * modèles fetchés live depuis l'API OpenAI / Higgsfield (gpt-image-2, flux_2,
 * etc.) en complément des modèles statiques du registry.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function fetchModels(
  page: import('@playwright/test').Page,
  qs: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  await page.goto('/admin/content-studio-v2/create');
  await page.waitForLoadState('domcontentloaded');
  return page.evaluate(async (q) => {
    const r = await fetch(`/api/admin/content-studio/models?${q}`);
    return { status: r.status, json: await r.json() };
  }, qs);
}

test('models endpoint exposes live-discovered OpenAI models (gpt-image-2 etc.)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { status, json } = await fetchModels(page, 'role=image&format=post');
  expect(status).toBe(200);
  const models = json.models as Array<{ id: string; provider: string; source: string }>;
  const ids = models.map((m) => m.id);
  console.log('Image models count:', models.length);
  console.log('Discovery sources:', json.discovery);
  console.log('First 10 IDs:', ids.slice(0, 10));

  // Statiques toujours présents
  expect(ids).toContain('gpt-image-1');
  expect(ids).toContain('dall-e-3');
  expect(ids).toContain('hf-flux-1');

  // Au moins un modèle découvert live au-delà des statiques (preuve que la
  // discovery fonctionne). Le registry static a 6 modèles image, on doit en
  // avoir plus.
  expect(models.length).toBeGreaterThan(6);

  // Source 'live' présent pour au moins un modèle
  const liveCount = models.filter((m) => m.source === 'live').length;
  expect(liveCount).toBeGreaterThan(0);
});

test('models endpoint returns chat models including live discovered', async ({ page }) => {
  test.setTimeout(60_000);
  const { status, json } = await fetchModels(page, 'role=chat&format=post');
  expect(status).toBe(200);
  const models = json.models as Array<{ id: string }>;
  console.log('Chat models count:', models.length);
  console.log('First 10 chat IDs:', models.slice(0, 10).map((m) => m.id));
  expect(models.length).toBeGreaterThan(3); // > 3 statiques
});

test('models endpoint exposes Higgsfield video models', async ({ page }) => {
  test.setTimeout(60_000);
  const { status, json } = await fetchModels(page, 'role=video&format=reel');
  expect(status).toBe(200);
  const models = json.models as Array<{ id: string }>;
  const ids = models.map((m) => m.id);
  console.log('Video models count:', models.length);
  console.log('Video IDs:', ids);
  expect(ids).toContain('hf-video-lite');
  expect(ids).toContain('hf-video-turbo');
  expect(ids).toContain('mock-video-1.0');
});
