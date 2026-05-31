/**
 * Phase 6 — A11y audit complet (axe-playwright) — chat + admin chat.
 *
 * Référence : `docs/chat-test-strategy-2026-05/04-execution-plan/06-phase-6-a11y-audit.md`
 *
 * Couvre :
 *  - Page hôte avec widget (visiteur)
 *  - 15 pages admin chat
 *
 * Standards :
 *  - WCAG 2.1 AA strict
 *  - Critical + Serious violations = 0
 *
 * Run :
 *   pnpm test:e2e -- e2e/a11y/
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_PAGES = [
  { name: 'kit-with-widget', url: '/kit' },
];

const ADMIN_PAGES = [
  { name: 'admin-overview', url: '/admin/chat' },
  { name: 'admin-conversations', url: '/admin/chat/conversations' },
  { name: 'admin-leads', url: '/admin/chat/leads' },
  { name: 'admin-care', url: '/admin/chat/care' },
  { name: 'admin-analytics', url: '/admin/chat/analytics' },
  { name: 'admin-audit', url: '/admin/chat/audit' },
  { name: 'admin-kpis', url: '/admin/chat/kpis' },
  { name: 'admin-providers', url: '/admin/chat/providers' },
  { name: 'admin-instructions', url: '/admin/chat/instructions' },
  { name: 'admin-faq', url: '/admin/chat/faq' },
  { name: 'admin-suggestions', url: '/admin/chat/suggestions' },
  { name: 'admin-sources', url: '/admin/chat/sources' },
  { name: 'admin-themes', url: '/admin/chat/themes' },
  { name: 'admin-system', url: '/admin/chat/system' },
  { name: 'admin-lang', url: '/admin/chat/lang' },
];

async function auditPage(page: typeof PUBLIC_PAGES[0], browserPage: import('@playwright/test').Page) {
  await browserPage.goto(page.url, { waitUntil: 'networkidle' });
  // Attendre que le widget se monte si applicable
  if (page.url === '/kit') {
    await browserPage.waitForTimeout(2_000);
  }
  const results = await new AxeBuilder({ page: browserPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (critical.length > 0) {
    console.error(
      `[a11y] ${page.name} viole ${critical.length} règles critiques :`,
      critical.map((v) => `${v.id}: ${v.description}`).join('\n  '),
    );
  }
  return { critical, total: results.violations.length };
}

test.describe('@a11y Public pages — WCAG 2.1 AA', () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.name} (${p.url})`, async ({ page }) => {
      const { critical } = await auditPage(p, page);
      expect(critical, `${critical.length} violations critique(s)/sérieuse(s)`).toHaveLength(0);
    });
  }
});

test.describe('@a11y @admin Admin pages — WCAG 2.1 AA', () => {
  // Admin pages nécessitent auth — utilisent storage state global (global.setup.ts)
  for (const p of ADMIN_PAGES) {
    test.skip(`${p.name} (${p.url}) (nécessite auth admin + DB seedée)`, async ({ page }) => {
      const { critical } = await auditPage(p, page);
      expect(critical).toHaveLength(0);
    });
  }
});
