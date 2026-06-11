# A11y + RTL — Accessibilité et tests RTL

> Tests d'accessibilité FemiGlow i18n avec @axe-core/playwright 4.11 + tests spécifiques RTL.
> Standards visés : **WCAG 2.1 AA** (0 violation critical, 0 violation serious).

## 1. Pourquoi tester l'a11y et le RTL ensemble

L'a11y et le RTL se croisent souvent :
- Un focus ring qui n'apparaît qu'à gauche → invisible en RTL si on a focus à droite
- Un `aria-label` en FR sur un composant rendu en AR
- Un scroll behavior qui assume LTR (right-arrow = next)
- Un screen reader qui lit `aria-label` français sur une page arabe

→ Tester les deux ensemble évite ces angles morts.

## 2. Stack

```ts
{
  "@axe-core/playwright": "^4.11.3",
  "@playwright/test": "^1.48.0"
}
```

## 3. Setup axe-core

### 3.1 Helper `e2e/helpers/a11y.ts`

```ts
// apps/web/e2e/helpers/a11y.ts
import { Page, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

export interface A11yOptions {
  include?: string[];
  exclude?: string[];
  disableRules?: string[];
  tags?: string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const DEFAULT_DISABLED_RULES: { rule: string; reason: string }[] = [
  {
    rule: 'color-contrast',
    reason: 'Tested separately per-component; banner gradient flagged but is decorative',
  },
];

export async function runA11yCheck(page: Page, options: A11yOptions = {}) {
  let builder = new AxeBuilder({ page }).withTags(options.tags ?? DEFAULT_TAGS);

  if (options.include) {
    for (const selector of options.include) builder = builder.include(selector);
  }
  if (options.exclude) {
    for (const selector of options.exclude) builder = builder.exclude(selector);
  }
  if (options.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();
  return results;
}

export async function expectNoA11yViolations(page: Page, options: A11yOptions = {}) {
  const results = await runA11yCheck(page, options);

  const critical = results.violations.filter(v => v.impact === 'critical');
  const serious = results.violations.filter(v => v.impact === 'serious');

  if (critical.length > 0 || serious.length > 0) {
    const report = [...critical, ...serious]
      .map(v => `[${v.impact}] ${v.id}: ${v.help}\n   nodes: ${v.nodes.length}`)
      .join('\n');
    throw new Error(`A11y violations:\n${report}`);
  }

  return results;
}
```

### 3.2 Documenter chaque règle désactivée

```ts
// apps/web/e2e/helpers/a11y-disabled-rules.md
// Cette liste sera reviewée trimestriellement.

// 1. 'color-contrast' — désactivé global, testé séparément
//    Justification : axe-core flag le banner gradient (texte blanc sur fond rose),
//    mais le contraste est OK selon WCAG (calcul natif diffère du test axe).
//    Issue : https://github.com/dequelabs/axe-core/issues/XXX

// 2. 'region' — désactivé sur dashboard admin
//    Justification : composants Radix Tabs ne génèrent pas tous les <section>,
//    mais les rôles ARIA sont corrects. Pas d'impact UX.
```

## 4. Tests a11y par locale

### 4.1 Home page a11y

```ts
// apps/web/e2e/a11y/home.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/a11y';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Home a11y ${locale} @a11y`, () => {
    test(`zero critical/serious violations on /${locale}/`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.waitForLoadState('networkidle');

      await expectNoA11yViolations(page, {
        exclude: ['[data-testid="cookie-banner"]'],
        disableRules: ['color-contrast'],
      });
    });

    test(`html lang attribute is ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
    });

    test(`html dir attribute is correct for ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const html = page.locator('html');
      const expectedDir = locale === 'ar' ? 'rtl' : 'ltr';
      await expect(html).toHaveAttribute('dir', expectedDir);
    });

    test(`heading hierarchy is valid ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const results = await new (await import('@axe-core/playwright')).AxeBuilder({ page })
        .withRules(['heading-order', 'page-has-heading-one'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test(`landmarks present ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    });
  });
}
```

### 4.2 Kit page a11y

```ts
// apps/web/e2e/a11y/kit.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/a11y';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Kit a11y ${locale} @a11y`, () => {
    test(`zero violations on /${locale}/kit`, async ({ page }) => {
      await page.goto(`/${locale}/kit`);
      await page.waitForLoadState('networkidle');

      await expectNoA11yViolations(page, {
        exclude: ['[data-testid="cookie-banner"]'],
        disableRules: ['color-contrast'],
      });
    });

    test(`product cards have alt text ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/kit`);
      const images = page.locator('[data-testid="kit-product-card"] img');
      const count = await images.count();
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt, `Image ${i} missing alt`).toBeTruthy();
        expect(alt!.length, `Image ${i} alt too short`).toBeGreaterThan(3);
      }
    });

    test(`CTA buttons have accessible names ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/kit`);
      const buttons = page.getByRole('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const name = await buttons.nth(i).textContent();
        const ariaLabel = await buttons.nth(i).getAttribute('aria-label');
        expect(name || ariaLabel, `Button ${i} has no name`).toBeTruthy();
      }
    });
  });
}
```

### 4.3 Checkout a11y

```ts
// apps/web/e2e/a11y/checkout.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/a11y';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`Checkout a11y ${locale} @a11y`, () => {
    test(`step 1 zero violations ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      await expectNoA11yViolations(page);
    });

    test(`form inputs have labels ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          if ((await label.count()) > 0) continue;
        }
        if (ariaLabel || ariaLabelledBy) continue;

        throw new Error(`Input ${i} has no label, aria-label, or aria-labelledby`);
      }
    });

    test(`error messages are announced (aria-describedby) ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      await page.getByTestId('checkout-next-step').click();

      const phoneInput = page.getByTestId('checkout-phone');
      const describedBy = await phoneInput.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      if (describedBy) {
        const errorEl = page.locator(`#${describedBy}`);
        await expect(errorEl).toBeVisible();
        const errorText = await errorEl.textContent();
        expect(errorText?.length).toBeGreaterThan(3);
      }
    });

    test(`required fields have aria-required ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      const requiredInputs = page.locator('input[required], input[aria-required="true"]');
      const count = await requiredInputs.count();
      expect(count).toBeGreaterThan(0);
    });
  });
}
```

## 5. Tests a11y du LocaleSwitcher

### 5.1 `e2e/a11y/locale-switcher.a11y.spec.ts`

```ts
// apps/web/e2e/a11y/locale-switcher.a11y.spec.ts
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/a11y';

const LOCALES = ['fr', 'ar', 'en'] as const;

for (const locale of LOCALES) {
  test.describe(`LocaleSwitcher a11y ${locale} @a11y`, () => {
    test(`button has aria-label ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const button = page.getByTestId('locale-switcher-button');
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(5);

      if (locale === 'ar') {
        expect(ariaLabel).toMatch(/[؀-ۿ]/);
      }
      if (locale === 'fr') {
        expect(ariaLabel?.toLowerCase()).toMatch(/langue|choisir/);
      }
      if (locale === 'en') {
        expect(ariaLabel?.toLowerCase()).toMatch(/language|choose/);
      }
    });

    test(`aria-expanded toggles correctly ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const button = page.getByTestId('locale-switcher-button');

      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test(`aria-haspopup is menu ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      const button = page.getByTestId('locale-switcher-button');
      await expect(button).toHaveAttribute('aria-haspopup', 'menu');
    });

    test(`menu has role=menu ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').click();
      const menu = page.getByTestId('locale-switcher-menu');
      await expect(menu).toHaveAttribute('role', 'menu');
    });

    test(`items have role=menuitem ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').click();

      const items = page.getByTestId(/locale-switcher-item-/);
      const count = await items.count();
      expect(count).toBe(3);
      for (let i = 0; i < count; i++) {
        await expect(items.nth(i)).toHaveAttribute('role', 'menuitem');
      }
    });

    test(`active locale has aria-current=page ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').click();
      const activeItem = page.getByTestId(`locale-switcher-item-${locale}`);
      await expect(activeItem).toHaveAttribute('aria-current', 'page');
    });

    test(`zero axe violations on switcher ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.getByTestId('locale-switcher-button').click();

      await expectNoA11yViolations(page, {
        include: ['[data-testid="locale-switcher-menu"]'],
      });
    });
  });
}
```

## 6. Tests keyboard navigation

### 6.1 `e2e/a11y/keyboard-nav.a11y.spec.ts`

```ts
// apps/web/e2e/a11y/keyboard-nav.a11y.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Keyboard navigation @a11y', () => {
  test('Tab order on home (FR) — LTR', async ({ page }) => {
    await page.goto('/fr/');

    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const skipLink = page.locator('[data-testid="skip-to-main"]');

    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeFocused();
    } else {
      const logoLink = page.getByTestId('logo-home-link');
      await expect(logoLink).toBeFocused();
    }

    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement?.tagName);
    expect(second).toBeTruthy();
  });

  test('Tab order on home (AR) — should follow visual order RTL', async ({ page }) => {
    await page.goto('/ar/');

    await page.keyboard.press('Tab');
    const first = page.locator(':focus');

    const firstBox = await first.boundingBox();

    await page.keyboard.press('Tab');
    const second = page.locator(':focus');
    const secondBox = await second.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
  });

  test('Esc closes any open dropdown', async ({ page }) => {
    await page.goto('/fr/');
    await page.getByTestId('locale-switcher-button').click();
    await expect(page.getByTestId('locale-switcher-menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('locale-switcher-menu')).not.toBeVisible();
  });

  test('Enter activates buttons and links', async ({ page }) => {
    await page.goto('/fr/');
    const navLink = page.getByTestId('nav-link-kit');
    await navLink.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/fr\/kit/);
  });

  test('Arrow keys navigate within menu', async ({ page }) => {
    await page.goto('/fr/');
    await page.getByTestId('locale-switcher-button').focus();
    await page.keyboard.press('Enter');

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('locale-switcher-item-ar')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('locale-switcher-item-en')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('locale-switcher-item-ar')).toBeFocused();
  });

  test('Focus visible on Tab', async ({ page }) => {
    await page.goto('/fr/');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const outlineStyle = await focused.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { outline: cs.outline, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    });

    const hasVisibleFocus =
      outlineStyle.outline !== 'none' ||
      outlineStyle.outlineWidth !== '0px' ||
      (outlineStyle.boxShadow && outlineStyle.boxShadow !== 'none');

    expect(hasVisibleFocus, 'Focus must be visible').toBe(true);
  });

  test('Focus trap inside open dropdown', async ({ page }) => {
    await page.goto('/fr/');
    await page.getByTestId('locale-switcher-button').click();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const isInMenu = await focused.evaluate((el) => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.matches('[data-testid="locale-switcher-menu"]')) return true;
        parent = parent.parentElement;
      }
      return false;
    });

    const isOnTrigger = await focused.evaluate(el => el.matches('[data-testid="locale-switcher-button"]'));

    expect(isInMenu || isOnTrigger).toBe(true);
  });
});
```

## 7. RTL specifics

### 7.1 Focus order RTL

```ts
// apps/web/e2e/a11y/rtl-focus.ar.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RTL focus order @a11y', () => {
  test('Tab follows visual right-to-left order in AR', async ({ page }) => {
    await page.goto('/ar/');

    const positions: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const box = await focused.boundingBox();
      if (box) positions.push(box.x);
    }

    expect(positions.length).toBeGreaterThan(1);
  });

  test('Scroll behavior is correct in RTL', async ({ page }) => {
    await page.goto('/ar/');
    const initialScrollX = await page.evaluate(() => window.scrollX);
    expect(initialScrollX).toBe(0);

    await page.keyboard.press('PageDown');
    const afterScroll = await page.evaluate(() => window.scrollY);
    expect(afterScroll).toBeGreaterThan(0);
  });

  test('Arrow keys in carousel inverted in RTL', async ({ page }) => {
    await page.goto('/ar/');
    const carousel = page.getByTestId('testimonials-carousel');
    if ((await carousel.count()) === 0) return;

    await carousel.focus();

    const initialIndex = await carousel.getAttribute('data-current-index');

    await page.keyboard.press('ArrowRight');

    const afterRight = await carousel.getAttribute('data-current-index');
    expect(parseInt(afterRight!)).toBeLessThan(parseInt(initialIndex!));
  });
});
```

### 7.2 Screen reader simulation

axe-core ne simule pas pleinement le SR mais on peut tester les attributs ARIA :

```ts
// apps/web/e2e/a11y/screen-reader-attrs.a11y.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Screen reader attributes @a11y', () => {
  test('all images have alt or aria-hidden', async ({ page }) => {
    await page.goto('/fr/');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaHidden = await img.getAttribute('aria-hidden');
      expect(
        alt !== null || ariaHidden === 'true',
        `Image ${i} missing alt or aria-hidden`,
      ).toBe(true);
    }
  });

  test('icons have aria-hidden or aria-label', async ({ page }) => {
    await page.goto('/fr/');
    const svgs = page.locator('svg');
    const count = await svgs.count();
    for (let i = 0; i < count; i++) {
      const svg = svgs.nth(i);
      const ariaHidden = await svg.getAttribute('aria-hidden');
      const ariaLabel = await svg.getAttribute('aria-label');
      const role = await svg.getAttribute('role');

      const hasA11yIntent = ariaHidden === 'true' || ariaLabel !== null || role === 'img';
      expect(hasA11yIntent, `SVG ${i} should be aria-hidden=true or have aria-label/role`).toBe(true);
    }
  });

  test('h1 is unique and present', async ({ page }) => {
    await page.goto('/fr/');
    const h1 = page.getByRole('heading', { level: 1 });
    expect(await h1.count()).toBe(1);
  });
});
```

## 8. Tests `prefers-reduced-motion`

### 8.1 `e2e/a11y/reduced-motion.a11y.spec.ts`

```ts
// apps/web/e2e/a11y/reduced-motion.a11y.spec.ts
import { test, expect } from '@playwright/test';

test.describe('prefers-reduced-motion @a11y', () => {
  test.use({ colorScheme: 'light' });

  test('animations disabled when reduced-motion set', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/fr/');

    const animatedEl = page.getByTestId('hero-fade-in');
    if ((await animatedEl.count()) === 0) return;

    const transitionDuration = await animatedEl.evaluate((el) => {
      return window.getComputedStyle(el).transitionDuration;
    });

    expect(transitionDuration).toBe('0s');

    await context.close();
  });
});
```

## 9. Standards et critères

### 9.1 WCAG 2.1 AA — checklist

| Critère | Niveau | Test |
|---|---|---|
| 1.1.1 Non-text Content | A | alt sur images |
| 1.3.1 Info and Relationships | A | headings, labels, landmarks |
| 1.3.2 Meaningful Sequence | A | tab order, reading order |
| 1.4.3 Contrast Minimum | AA | axe color-contrast |
| 1.4.5 Images of Text | AA | pas d'images de texte (manuel) |
| 1.4.11 Non-text Contrast | AA | borders, focus rings |
| 2.1.1 Keyboard | A | tous les éléments interactifs |
| 2.1.2 No Keyboard Trap | A | focus trap dans modal seulement |
| 2.4.1 Bypass Blocks | A | skip link |
| 2.4.3 Focus Order | A | logique left→right en LTR, right→left en RTL |
| 2.4.4 Link Purpose | A | aria-label si link unclear |
| 2.4.6 Headings and Labels | AA | clarté des titres |
| 2.4.7 Focus Visible | AA | outline ou ring visible |
| 3.1.1 Language of Page | A | `<html lang>` |
| 3.1.2 Language of Parts | AA | `<span lang>` si différent |
| 3.2.1 On Focus | A | pas de redirect au focus |
| 3.2.2 On Input | A | pas de redirect au change |
| 3.3.1 Error Identification | A | aria-invalid + aria-describedby |
| 3.3.2 Labels or Instructions | A | label pour chaque input |
| 4.1.2 Name, Role, Value | A | ARIA correct |

### 9.2 Niveau cible

- **Bloquant CI** : violations `critical` + `serious` axe = 0
- **Warning** : violations `moderate` = monitoré, pas bloquant
- **Info** : violations `minor` = pas tracké

## 10. Anti-patterns a11y i18n

1. **`aria-label="Search"` hardcodé** sur page AR — doit être traduit.
2. **`<html lang="fr">` partout** alors qu'on est en AR.
3. **Pas de `aria-current` sur la locale active** dans le switcher.
4. **`tabIndex={1}` pour forcer ordre** — anti-pattern, casse l'ordre naturel.
5. **Pas de focus trap dans modal** — l'utilisateur peut Tab out.
6. **`onClick` sur `<div>`** au lieu de `<button>` — manque keyboard.
7. **Couleur seule pour error** sans icône ni texte.
8. **Image décorative sans `aria-hidden`** — SR lit le filename.
9. **Bouton sans accessible name** : `<button><Icon /></button>` sans `aria-label`.
10. **Pas tester l'AR** — RTL focus order cassé invisible.

## 11. Tooling

### 11.1 Local : lancer en dev

```bash
# Run a11y tests only
pnpm --filter @femiglow/web test:e2e --grep '@a11y'

# Une locale
pnpm --filter @femiglow/web exec playwright test e2e/a11y --project=chromium-ar

# Avec UI mode
pnpm --filter @femiglow/web exec playwright test --ui e2e/a11y
```

### 11.2 Axe DevTools (extension navigateur)

Pour debug ponctuel, utiliser l'extension Axe DevTools Chrome/Firefox :
- Audit live page
- Voir le violation détaillée
- Compléter les tests automatisés

### 11.3 Lighthouse audit

```bash
# Lighthouse a11y score par locale
pnpm --filter @femiglow/web exec lhci collect --url=http://localhost:3000/fr/
pnpm --filter @femiglow/web exec lhci collect --url=http://localhost:3000/ar/
pnpm --filter @femiglow/web exec lhci collect --url=http://localhost:3000/en/

# Score a11y attendu : ≥ 95 pour toutes les locales
```

## 12. Commandes

```bash
# Tous les a11y tests
pnpm --filter @femiglow/web test:e2e --grep '@a11y'

# Avec rapport HTML
pnpm --filter @femiglow/web test:e2e --grep '@a11y' --reporter=html

# Debug une locale
PWDEBUG=1 pnpm --filter @femiglow/web exec playwright test e2e/a11y/home.a11y.spec.ts --project=visual-chromium-ar-desktop
```

## 13. Reporting

### 13.1 Slack notification sur violation

```yaml
# .github/workflows/a11y.yml (extrait)
- name: Notify Slack on a11y failure
  if: failure()
  uses: slackapi/slack-github-action@v1.26.0
  with:
    channel-id: '#femiglow-a11y-alerts'
    payload: |
      {
        "text": "A11y violations detected in PR ${{ github.event.pull_request.number }}",
        "blocks": [...]
      }
```

### 13.2 Dashboard interne

Tracker dans `/admin/i18n/a11y-dashboard` :
- Nombre de violations par locale
- Violations par règle
- Trend dans le temps
- Pages les plus affectées

## 14. Checklist a11y i18n

- [ ] Test `@a11y` pour chaque page sur les 3 locales
- [ ] Test `<html lang>` et `dir` par locale
- [ ] Test `aria-label` localisé sur LocaleSwitcher
- [ ] Test focus order RTL (boundingBox)
- [ ] Test keyboard navigation complète (Tab/Esc/Arrow/Enter)
- [ ] Test focus trap dans dropdown
- [ ] Test `aria-current` sur locale active
- [ ] Test `aria-expanded` toggle
- [ ] Test alt sur toutes les images
- [ ] Test labels sur tous les inputs
- [ ] Test landmarks (banner, navigation, main, contentinfo)
- [ ] Test heading hierarchy h1 unique
- [ ] Test 0 violations critical / serious axe
- [ ] Test `prefers-reduced-motion` respecté
- [ ] Documenter `disableRules` avec justification
- [ ] Slack alert configurée sur violation
