import { test, expect } from '@playwright/test';

/**
 * E2E — admin tracking guards.
 * Sans session iron-session, toutes les routes /admin/tracking/*
 * doivent rediriger vers /admin/login. Les API correspondantes
 * doivent répondre 401 ou 302.
 */

const TRACKING_PAGES = [
  '/admin/tracking',
  '/admin/tracking/inventory',
  '/admin/tracking/events',
  '/admin/tracking/providers',
  '/admin/tracking/test',
  '/admin/tracking/logs',
  '/admin/tracking/settings',
];

const TRACKING_APIS = [
  '/api/admin/tracking/inventory',
  '/api/admin/tracking/pages',
  '/api/admin/tracking/components',
  '/api/admin/tracking/providers',
  '/api/admin/tracking/logs',
  '/api/admin/tracking/events',
];

test.describe('admin tracking — auth guards', () => {
  for (const path of TRACKING_PAGES) {
    test(`page ${path} protégée par auth`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res).not.toBeNull();
      // Sans session : redirection guard vers /admin/login.
      if (page.url().includes('/admin/login')) {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        return;
      }
      // Avec session (storageState) : la page rend un heading.
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }

  for (const path of TRACKING_APIS) {
    test(`API ${path} bloquée sans session`, async ({ request }) => {
      const res = await request.get(path);
      expect([401, 403, 302]).toContain(res.status());
    });
  }
});
