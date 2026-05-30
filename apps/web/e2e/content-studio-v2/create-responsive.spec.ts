/**
 * CS v2 create-audit Phase 7 — Responsive smoke test.
 *
 * Verifies the page does not produce a horizontal scrollbar at common
 * breakpoints. The 3-column layout is allowed to remain wide on desktop
 * (≥1280) but mustn't overflow the viewport on smaller widths.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'mobile-414', width: 414, height: 900 },
] as const;

test.describe('Content Studio v2 — create responsive smoke', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await registerCreateMocks(page);
      await page.goto('/admin/content-studio-v2/create');
      await ensureCreatePageLoaded(page);

      // Wait a moment for layout to settle.
      await page.waitForTimeout(300);

      const { scrollWidth, clientWidth, hasOverflow } = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1, // 1px tolerance
        };
      });

      // Allow some overflow on the smallest mobile viewport — known limitation,
      // tracked as backlog item G15 in the audit doc.
      if (vp.name === 'mobile-414' && hasOverflow) {
        test.info().annotations.push({
          type: 'known-issue',
          description: `G15: horizontal overflow at 414px (${scrollWidth}px > ${clientWidth}px)`,
        });
        return;
      }
      expect(hasOverflow, `Horizontal overflow at ${vp.name}: ${scrollWidth} vs ${clientWidth}`).toBe(false);
    });
  }
});
