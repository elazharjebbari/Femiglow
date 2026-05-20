/**
 * E2E vidéo `/kit` — refonte Kolenda §4.4.
 *
 * Tags utilisés (filtrer via `pnpm playwright test --grep`) :
 *  - `@video-render`      : présence des éléments clés (poster, chapitres, CTA)
 *  - `@video-interaction` : click poster → iframe, click chapitre, CTA scroll
 *  - `@video-a11y`        : 0 violation axe sérieuse/critique sur la section
 *
 * Couvre aussi (CHA-243 historique) :
 *  - L'iframe (montée après clic) pointe sur `youtube-nocookie.com`.
 *  - Aucune fuite vers `youtube.com` (cookie domain) au paint initial.
 *  - Params privacy (`rel=0`, `modestbranding=1`, etc.) présents.
 *
 * Tests publics — pas d'auth nécessaire.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/kit vidéo — rendu @video-render', () => {
  test('section vidéo visible avec heading « Quatre gestes »', async ({ page }) => {
    await page.goto('/kit');
    const heading = page.getByRole('heading', {
      name: /quatre gestes,? en un seul plan/i,
      level: 2,
    });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('poster cover (click-to-play) visible au paint, AUCUNE iframe avant clic', async ({
    page,
  }) => {
    // Tracker toute fuite vers youtube.com (cookie domain).
    const youtubeCookieRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/^https?:\/\/(www\.|m\.)?youtube\.com\b/.test(url)) {
        youtubeCookieRequests.push(url);
      }
    });

    await page.goto('/kit');
    const poster = page.getByTestId('video-poster-cover');
    await expect(poster).toBeVisible();
    expect(await page.locator('iframe[src*="youtube"]').count()).toBe(0);

    // Aucune requête vers youtube.com avant clic — l'iframe n'est pas montée
    // donc même youtube-nocookie.com ne doit pas être appelé.
    await page.waitForTimeout(500);
    expect(
      youtubeCookieRequests,
      `Fuites vers youtube.com: ${youtubeCookieRequests.join(', ')}`,
    ).toHaveLength(0);
  });

  test('mini-timeline avec 4 chapitres visible sous la vidéo', async ({ page }) => {
    await page.goto('/kit');
    const nav = page.getByTestId('video-chapters');
    await expect(nav).toBeVisible();
    const items = nav.locator('[data-testid^="video-chapter-"]');
    await expect(items).toHaveCount(4);
  });

  test('badge durée affiché sur le poster', async ({ page }) => {
    await page.goto('/kit');
    const badge = page.getByTestId('video-poster-duration-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/\d+/);
  });

  test('CTA « Voir le pack » pointe sur #commander-femiglow', async ({ page }) => {
    await page.goto('/kit');
    const cta = page.getByTestId('video-post-cta');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '#commander-femiglow');
  });
});

test.describe('/kit vidéo — interactions @video-interaction', () => {
  test('clic poster monte une iframe YouTube avec autoplay + mute + captions FR', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page.getByTestId('video-poster-cover').click();
    const iframe = page.locator('iframe[src*="youtube"]').first();
    await expect(iframe).toBeVisible({ timeout: 5_000 });
    const src = await iframe.getAttribute('src');
    expect(src).toContain('youtube-nocookie.com');
    expect(src).toContain('autoplay=1');
    expect(src).toContain('mute=1');
    expect(src).toContain('cc_load_policy=1');
    expect(src).toContain('cc_lang_pref=fr');
    expect(src).toContain('enablejsapi=1');
  });

  test('iframe garde les params privacy YouTube (modestbranding, rel=0, etc.)', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page.getByTestId('video-poster-cover').click();
    const iframe = page.locator('iframe[src*="youtube"]').first();
    const src = (await iframe.getAttribute('src')) ?? '';
    const u = new URL(src);
    expect(u.searchParams.get('rel')).toBe('0');
    expect(u.searchParams.get('modestbranding')).toBe('1');
    expect(u.searchParams.get('iv_load_policy')).toBe('3');
    expect(u.searchParams.get('playsinline')).toBe('1');
  });

  test('iframe attributs a11y/perf : title, loading=lazy, referrerpolicy, allow', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page.getByTestId('video-poster-cover').click();
    const iframe = page.locator('iframe[src*="youtube"]').first();
    await expect(iframe).toHaveAttribute('title', /vidéo|gestes/i);
    await expect(iframe).toHaveAttribute('loading', 'lazy');
    await expect(iframe).toHaveAttribute(
      'referrerpolicy',
      'strict-origin-when-cross-origin',
    );
    const allow = (await iframe.getAttribute('allow')) ?? '';
    expect(allow).toContain('fullscreen');
    expect(allow).toContain('autoplay');
  });

  test('clic chapitre conserve un seul aria-current="step" dans la timeline', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page.getByTestId('video-chapter-powder').click();
    const active = page.locator(
      '[data-testid^="video-chapter-"][aria-current="step"]',
    );
    await expect(active).toHaveCount(1);
  });

  test('clic CTA scrolle vers #commander-femiglow', async ({ page }) => {
    await page.goto('/kit');
    const cta = page.getByTestId('video-post-cta');
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await page.waitForTimeout(800);
    const target = page.locator('#commander-femiglow').first();
    expect(await target.count()).toBeGreaterThan(0);
  });
});

test.describe('/kit vidéo — a11y @video-a11y', () => {
  test('0 violation axe sérieuse/critique sur la section vidéo', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');
    const results = await new AxeBuilder({ page })
      .include('section[data-testid="video-section-youtube"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log('AXE violations (video):', JSON.stringify(serious, null, 2));
    }
    expect(serious).toHaveLength(0);
  });
});
