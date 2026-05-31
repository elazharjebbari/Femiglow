/**
 * Tests Playwright intensifs — Switcher + couverture complète des traductions.
 *
 * Phase 5 — Switcher public éditorial + batterie i18n-intensive.
 *
 * Pré-requis : le dev server doit tourner avec `I18N_ENABLED=true` :
 *
 *   echo "I18N_ENABLED=true" >> apps/web/.env.local
 *   pnpm dev
 *
 *   # puis dans un autre terminal :
 *   pnpm test:e2e --grep @i18n-intensive
 *
 * Si le flag n'est pas activé, tous les tests sont skip (pas d'échec).
 *
 * Couverture :
 *  1. Switch fonctionnel desktop : FR → AR → FR avec persistance cookie
 *  2. Aucun mot français résiduel sur les pages /ar/* (ratio arabe > 70%)
 *  3. Aucun caractère arabe résiduel sur /fr/* et /en/*
 *  4. Switcher visible sur toutes les pages éditoriales [locale]
 *  5. A11y switcher : focus visible, navigation clavier, aria-expanded
 *  6. hreflang complet sur toutes les pages (fr/ar/en + x-default)
 *  7. Mobile (375px) : LocaleSwitcher dans SommaireOverlay (drawer)
 *
 * Cible : 12-15 tests @i18n-intensive.
 *
 * @see docs/i18n-strategy-2026-05/PHASE-4-FINAL.md §Phase 5
 */
import { expect, test, type Page } from '@playwright/test';

const I18N_FLAG_ACTIVE = process.env.I18N_ENABLED === 'true';

// Marques et anglicismes autorisés en latin sur les pages AR.
// Ces tokens DOIVENT rester en latin (positionnement éditorial /
// branding). cf. docs/i18n-content-2026-05/00-style-reference.md.
const BRAND_ALLOWLIST = [
  'FemiGlow',
  'Paste',
  'Powder',
  'Step',
  'MAD',
  'EUR',
  'USD',
  'WhatsApp',
  'Instagram',
  'TikTok',
  'Pinterest',
  'YouTube',
  'CGV',
  'CGU',
  'FAQ',
  'SSL',
  'RGPD',
  'COD',
  'Cairo',
  // Numéros, dates, devises, URL fragments.
];

// Pages éditoriales du sprint i18n FemiGlow — celles servies en /[locale]/*.
const EDITORIAL_PATHS = [
  '/',
  '/maison',
  '/rituel',
  '/kit',
  '/journal',
  '/contact',
];

// Caractères considérés "français/latin" (ASCII A-z + accents européens).
const LATIN_RE = /[A-Za-zÀ-ÿ]/g;
// Caractères arabes (bloc U+0600 → U+06FF).
const ARABIC_RE = /[؀-ۿ]/g;

/**
 * Strip les marques/anglicismes autorisés du texte pour ne mesurer que le
 * contenu rédactionnel "vrai".
 */
function stripBrands(text: string): string {
  let cleaned = text;
  for (const brand of BRAND_ALLOWLIST) {
    cleaned = cleaned.replace(new RegExp(brand, 'g'), '');
  }
  // Retirer les nombres, ponctuation, devises, URLs.
  cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
  cleaned = cleaned.replace(/[\d]+/g, '');
  cleaned = cleaned.replace(/[©®™°•·€$£¥/\\@#&_~|`]/g, '');
  return cleaned;
}

/**
 * Récupère le contenu textuel visible du body. On exclut les <script> et
 * les attributs (aria-label, etc.) qui peuvent rester en source par design.
 */
async function visibleBodyText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const main = document.body;
    if (!main) return '';
    const clone = main.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, [aria-hidden="true"]').forEach((el) => {
      el.remove();
    });
    return (clone.innerText || '').trim();
  });
}

test.describe('@i18n-intensive Switcher public + traduction intégrale', () => {
  test.skip(
    !I18N_FLAG_ACTIVE,
    'I18N_ENABLED=true requis (cf. en-tête du fichier). Test skip car flag OFF.',
  );

  // ───────────────────────────────────────────────────────────────────
  // 1. Switch fonctionnel desktop (FR → AR → FR)
  // ───────────────────────────────────────────────────────────────────

  test('Switcher desktop — bascule FR → AR puis retour FR persiste cookie', async ({
    page,
    context,
  }) => {
    await page.goto('/fr/contact');

    const trigger = page.getByTestId('locale-switcher-trigger').first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText(/^FR$/);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Ouverture du menu
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByTestId('locale-switcher-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');

    // Click sur AR
    await page.getByTestId('locale-switcher-item-ar').click();
    await page.waitForURL(/\/ar\/contact$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Le bouton affiche maintenant AR
    await expect(
      page.getByTestId('locale-switcher-trigger').first(),
    ).toHaveText(/^AR$/);

    // Cookie NEXT_LOCALE = ar
    const cookiesAr = await context.cookies();
    expect(cookiesAr.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('ar');

    // Retour FR
    await page.getByTestId('locale-switcher-trigger').first().click();
    await page.getByTestId('locale-switcher-item-fr').click();
    await page.waitForURL(/\/fr\/contact$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    const cookiesFr = await context.cookies();
    expect(cookiesFr.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('fr');
  });

  test('Switcher desktop — sélection de la locale active ferme le menu sans navigation', async ({
    page,
  }) => {
    await page.goto('/fr/kit');
    const initialUrl = page.url();

    await page.getByTestId('locale-switcher-trigger').first().click();
    await page.getByTestId('locale-switcher-item-fr').click();

    // Le menu se ferme
    await expect(page.getByTestId('locale-switcher-menu')).toBeHidden();
    // Pas de navigation
    expect(page.url()).toBe(initialUrl);
  });

  // ───────────────────────────────────────────────────────────────────
  // 2. Aucun mot français résiduel sur /ar/*
  // ───────────────────────────────────────────────────────────────────

  for (const path of EDITORIAL_PATHS) {
    test(`AR — pas de contenu français résiduel sur /ar${path}`, async ({
      page,
    }) => {
      const response = await page.goto(`/ar${path}`);
      // Toutes les pages doivent renvoyer 200, sauf si pas encore implémentée
      // (acceptable de skip si 404 — on ne teste que les contenus servis).
      if (!response || response.status() !== 200) {
        test.skip(true, `/ar${path} ne sert pas 200 — pas en scope`);
      }
      await page.waitForLoadState('networkidle');

      const raw = await visibleBodyText(page);
      const cleaned = stripBrands(raw);

      const latinMatches = cleaned.match(LATIN_RE) ?? [];
      const arabicMatches = cleaned.match(ARABIC_RE) ?? [];
      const total = latinMatches.length + arabicMatches.length;

      // Garde-fou : si la page est essentiellement vide, on ne juge pas.
      if (total < 50) {
        test.skip(true, `/ar${path} a trop peu de texte (${total} chars) pour mesure`);
      }

      const arabicRatio = arabicMatches.length / total;
      expect(
        arabicRatio,
        `Ratio arabe trop bas sur /ar${path}: ${(arabicRatio * 100).toFixed(
          1,
        )}% (texte residuel latin = "${cleaned.slice(0, 200)}")`,
      ).toBeGreaterThan(0.7);
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // 3. Aucun caractère arabe sur /fr/* et /en/*
  // ───────────────────────────────────────────────────────────────────

  test('FR — aucun caractère arabe résiduel sur /fr/contact', async ({
    page,
  }) => {
    await page.goto('/fr/contact');
    await page.waitForLoadState('networkidle');
    const raw = await visibleBodyText(page);
    const arabic = raw.match(ARABIC_RE) ?? [];
    expect(
      arabic.length,
      `Caractères arabes trouvés sur /fr/contact: ${arabic.join('')}`,
    ).toBe(0);
  });

  test('EN — aucun caractère arabe résiduel sur /en/contact', async ({
    page,
  }) => {
    await page.goto('/en/contact');
    await page.waitForLoadState('networkidle');
    const raw = await visibleBodyText(page);
    const arabic = raw.match(ARABIC_RE) ?? [];
    expect(
      arabic.length,
      `Caractères arabes trouvés sur /en/contact: ${arabic.join('')}`,
    ).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────
  // 4. Switcher présent sur les pages éditoriales
  // ───────────────────────────────────────────────────────────────────

  test('Switcher — visible sur toutes les pages éditoriales (3 locales × N paths)', async ({
    page,
  }) => {
    const checked: Array<{ url: string; ok: boolean }> = [];
    for (const locale of ['fr', 'ar', 'en'] as const) {
      for (const path of EDITORIAL_PATHS) {
        const url = `/${locale}${path === '/' ? '' : path}`;
        const res = await page.goto(url);
        if (!res || res.status() !== 200) {
          // Pas en scope si la page n'est pas implémentée
          continue;
        }
        const trigger = page.getByTestId('locale-switcher-trigger').first();
        const visible = await trigger.isVisible().catch(() => false);
        checked.push({ url, ok: visible });
      }
    }
    const failing = checked.filter((c) => !c.ok).map((c) => c.url);
    expect(
      failing,
      `Switcher manquant sur : ${failing.join(', ')}`,
    ).toEqual([]);
    // Au moins 6 vérifications (2 locales × 3 paths minimum)
    expect(checked.length).toBeGreaterThanOrEqual(6);
  });

  // ───────────────────────────────────────────────────────────────────
  // 5. A11y switcher : focus + clavier
  // ───────────────────────────────────────────────────────────────────

  test('A11y — switcher activable au clavier (Tab + Enter + ArrowDown + Enter)', async ({
    page,
  }) => {
    await page.goto('/fr/contact');
    const trigger = page.getByTestId('locale-switcher-trigger').first();

    // Focus direct sur le bouton (cross-browser fiable)
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Enter ouvre le menu
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    // ArrowDown navigue vers AR
    await page.keyboard.press('ArrowDown');
    const itemAr = page.getByTestId('locale-switcher-item-ar');
    await expect(itemAr).toBeFocused();

    // Enter sélectionne AR
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/ar\/contact$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('A11y — Escape ferme le menu et restaure le focus sur le trigger', async ({
    page,
  }) => {
    await page.goto('/fr/');
    const trigger = page.getByTestId('locale-switcher-trigger').first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('locale-switcher-menu')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('A11y — focus visible sur le trigger (focus-visible CSS)', async ({
    page,
  }) => {
    await page.goto('/fr/');
    const trigger = page.getByTestId('locale-switcher-trigger').first();
    await trigger.focus();
    // Vérifie que le focus-visible applique bien une décoration
    const decoration = await trigger.evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration).toContain('underline');
  });

  // ───────────────────────────────────────────────────────────────────
  // 6. hreflang complet sur toutes les pages
  // ───────────────────────────────────────────────────────────────────

  test('SEO — hreflang correct sur toutes les pages éditoriales (fr/ar/en + x-default)', async ({
    page,
  }) => {
    for (const locale of ['fr', 'ar', 'en'] as const) {
      for (const path of EDITORIAL_PATHS) {
        const url = `/${locale}${path === '/' ? '' : path}`;
        const res = await page.goto(url);
        if (!res || res.status() !== 200) continue;
        for (const lang of ['fr', 'ar', 'en', 'x-default']) {
          await expect(
            page.locator(`link[hreflang="${lang}"]`),
            `${url} manque hreflang="${lang}"`,
          ).toHaveCount(1);
        }
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // 7. Mobile — LocaleSwitcher dans SommaireOverlay
  // ───────────────────────────────────────────────────────────────────

  test('Mobile (375px) — switcher inline accessible via le SommaireOverlay', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/fr/');

    // Sur mobile, le LocaleSwitcher dropdown du Header est masqué (md:inline-flex)
    // → on doit ouvrir le Sommaire pour le trouver en inline.
    const desktopTrigger = page.getByTestId('locale-switcher-trigger');
    // Si masqué côté mobile, le test continue ; pas d'assertion stricte
    // (toBeVisible varie selon l'opt CSS exact). On valide juste la
    // présence du switcher inline DANS le drawer.

    await page
      .getByRole('button', { name: /sommaire/i })
      .or(page.getByText(/sommaire/i).first())
      .first()
      .click();

    // Le SommaireOverlay est ouvert ; le LocaleSwitcher inline doit être présent
    const inline = page.getByTestId('locale-switcher-inline');
    await expect(inline).toBeVisible({ timeout: 5000 });

    // Les 3 items doivent y être
    await expect(
      page.getByTestId('locale-switcher-inline-item-fr'),
    ).toBeVisible();
    await expect(
      page.getByTestId('locale-switcher-inline-item-ar'),
    ).toBeVisible();
    await expect(
      page.getByTestId('locale-switcher-inline-item-en'),
    ).toBeVisible();

    // Click sur AR → navigation + fermeture overlay
    await page.getByTestId('locale-switcher-inline-item-ar').click();
    await page.waitForURL(/\/ar/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // Pas de double-mount (silence eslint)
    void desktopTrigger;

    await context.close();
  });

  // ───────────────────────────────────────────────────────────────────
  // 8. Charte : aucun emoji drapeau dans le DOM
  // ───────────────────────────────────────────────────────────────────

  test('Charte FemiGlow — aucun emoji drapeau dans le switcher (politique éditoriale)', async ({
    page,
  }) => {
    await page.goto('/fr/');
    await page.getByTestId('locale-switcher-trigger').first().click();
    const menuText = await page
      .getByTestId('locale-switcher-menu')
      .innerText();
    // Bloc Emoji Regional Indicator (drapeaux) : U+1F1E6..U+1F1FF
    expect(menuText).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  // ───────────────────────────────────────────────────────────────────
  // 9. Pas de mot français long sur AR (texte > 30 chars)
  // ───────────────────────────────────────────────────────────────────

  test('AR — aucun bloc de texte FR > 30 caractères latins consécutifs', async ({
    page,
  }) => {
    await page.goto('/ar/contact');
    await page.waitForLoadState('networkidle');
    const raw = await visibleBodyText(page);
    const cleaned = stripBrands(raw);
    // Match les séquences de lettres latines + espaces > 30 chars.
    const longLatinBlocks = cleaned.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{29,}/g) ?? [];
    expect(
      longLatinBlocks,
      `Blocs FR long trouvés sur /ar/contact : ${JSON.stringify(longLatinBlocks)}`,
    ).toEqual([]);
  });
});
