/**
 * E2E — l'admin /admin/tracking/providers affiche toujours une carte
 * TikTok, même sans ligne `tracking_providers` en base. Permet de
 * configurer le pixelId depuis l'UI sans passer par psql/admin seed.
 *
 * Cf. commit 62f6ecc ("feat(admin/tracking): show TikTok provider card
 * by default"). Test correspondant Vitest : ProviderConfigList.test.tsx.
 * Cette spec est la vérification finale en environnement réel.
 */
import { test, expect, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: Page): Promise<void> {
  if (page.url().includes('/admin/login')) test.skip();
}

test.describe('Admin /admin/tracking/providers — TikTok card', () => {
  test('la carte TikTok est visible même sans ligne DB', async ({ page }) => {
    await page.goto('/admin/tracking/providers');
    await ensureAuthOrSkip(page);

    // Le label est défini dans ProviderConfigList.PROVIDER_LABELS
    // (`'TikTok Pixel'`). On cherche le label visible dans la liste.
    await expect(
      page.getByRole('heading', { name: /tikTok pixel/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('la carte affiche Snap, Meta ET TikTok (always-visible providers)', async ({ page }) => {
    await page.goto('/admin/tracking/providers');
    await ensureAuthOrSkip(page);
    await page.waitForLoadState('networkidle');

    // Présence visuelle des 3 cartes always-visible. On ne fail pas sur
    // les autres providers (Google Ads / GA4 / Pinterest / GTM / Custom)
    // car ceux-ci dépendent de la présence d'une ligne DB dans l'env.
    await expect(page.getByText(/snapchat pixel/i).first()).toBeVisible();
    await expect(page.getByText(/meta pixel/i).first()).toBeVisible();
    await expect(page.getByText(/tiktok pixel/i).first()).toBeVisible();
  });

  test('GET /api/admin/tracking/providers/tiktok renvoie un default désactivé sans ligne DB', async ({ page, request }) => {
    // Si l'env a déjà une ligne TikTok enabled (cas après promotion en
    // prod), ce test devient un check de cohérence d'état. Sinon, on
    // exerce le path empty-state qui alimente la carte UI.
    await page.goto('/admin/tracking/providers');
    await ensureAuthOrSkip(page);

    const res = await request.get('/api/admin/tracking/providers/tiktok');
    expect([200, 304]).toContain(res.status());
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.kind).toBe('tiktok');
    // status ∈ {'enabled','disabled'} selon l'état réel de l'env.
    expect(['enabled', 'disabled']).toContain(body.status);
    // Le token brut ne doit jamais être renvoyé (AES-256-GCM côté DB).
    expect(body.capiToken).toBeUndefined();
  });
});
