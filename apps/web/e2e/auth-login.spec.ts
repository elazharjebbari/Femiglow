import { test, expect } from '@playwright/test';

test.describe('admin login', () => {
  test('rend le formulaire de connexion', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  test('redirige /admin → /admin/login si non authentifié', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res).not.toBeNull();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('refuse les identifiants invalides', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel(/email/i).fill('inexistant@femiglow.ma');
    await page.getByLabel(/mot de passe/i).fill('mauvaisMotDePasse123');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page.getByText(/identifiants invalides|email ou mot de passe/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
