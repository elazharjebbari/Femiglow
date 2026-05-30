/**
 * E2E — Bouton « Charger les connaissances par défaut » de la base de
 * connaissances AI Engine.
 *
 * Vérifie que :
 *  - Le bouton est visible dans le header de la page knowledge.
 *  - Un clic déclenche POST /api/admin/ai-engine/knowledge/seed-defaults.
 *  - Le bandeau de résultat affiche des compteurs (collections + documents).
 *  - Le rapport stratégique est bien présent après seed (un document
 *    stratégique apparaît dans la collection viral-content).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('seed-defaults button loads default knowledge and strategic brief', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/admin/content-studio-v2/ai-engine/knowledge');
  await expect(page.getByRole('heading', { name: /base de connaissances/i })).toBeVisible({
    timeout: 15_000,
  });

  const seedBtn = page.getByTestId('seed-defaults-button');
  await expect(seedBtn).toBeVisible({ timeout: 10_000 });
  await seedBtn.click();

  // Le bandeau de résultat doit apparaître avec des compteurs.
  const result = page.getByTestId('seed-defaults-result');
  await expect(result).toBeVisible({ timeout: 150_000 });
  const text = await result.textContent();
  console.log('Seed result:', text);
  expect(text).toMatch(/collections prêtes/i);
  expect(text).toMatch(/documents stratégiques chargés/i);
});

test('strategic brief documents are retrievable via the models/knowledge API', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/admin/content-studio-v2/ai-engine/knowledge');
  await page.waitForLoadState('domcontentloaded');

  // S'assurer que le seed a tourné (idempotent — sans effet si déjà fait).
  await page.evaluate(() =>
    fetch('/api/admin/ai-engine/knowledge/seed-defaults', { method: 'POST' }),
  );

  // La collection viral-content doit contenir le document stratégique réécrit.
  const docs = await page.evaluate(async () => {
    const r = await fetch('/api/admin/ai-engine/knowledge/viral-content/documents');
    return r.ok ? ((await r.json()).documents as Array<{ title: string }>) : [];
  });
  const titles = docs.map((d) => d.title);
  console.log('viral-content documents:', titles);
  expect(titles.some((t) => /STEPPS/i.test(t))).toBe(true);
});
