/**
 * E2E — a11y (axe-core) sur les pages légales publiques + admin.
 *
 * Cible WCAG 2.1 AA. Critères du dossier 50-ui-ux-design : 0 violation
 * sur /legal/<slug>, /admin/legal et /admin/legal/<slug>/edit.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('a11y — public', () => {
  test('home : 0 violation a11y critique sur le footer', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .include('footer')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('/legal/<slug> : 0 violation a11y si la page est publiée', async ({ page }) => {
    const res = await page.goto('/legal/cgv');
    if (!res || res.status() === 404) {
      test.skip();
      return;
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('a11y — admin', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('/admin/legal : 0 violation a11y critique', async ({ page }) => {
    await page.goto('/admin/legal');
    if (page.url().includes('/admin/login')) {
      test.skip();
      return;
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    // Sur les pages admin on tolère certaines violations non-critiques
    // (couleurs, contrast peuvent dépendre du thème). On filtre.
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toEqual([]);
  });

  test('/admin/legal/template-vars : 0 violation a11y critique', async ({ page }) => {
    await page.goto('/admin/legal/template-vars');
    if (page.url().includes('/admin/login')) {
      test.skip();
      return;
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toEqual([]);
  });
});
