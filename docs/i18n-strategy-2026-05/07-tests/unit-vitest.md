# Unit tests — Vitest pour helpers, formatters, composants i18n

> Tests unitaires Vitest 2.1.2 pour la couche i18n FemiGlow.
> Code TS complet, prêt à copier-coller. Cibles : helpers (`lib/i18n/`), composants pure, hooks, type-safety.

## 1. Setup Vitest pour i18n

### 1.1 Config référence `vitest.config.ts`

Le projet a déjà un `vitest.config.ts` à `apps/web/vitest.config.ts`. On ajoute juste les alias et globals nécessaires pour i18n :

```ts
// apps/web/vitest.config.ts (extrait pertinent)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/i18n/**/*.{ts,tsx}',
        'src/components/i18n/**/*.{ts,tsx}',
        'src/app/api/i18n/**/*.ts',
        'src/app/api/admin/i18n/**/*.ts',
        'middleware.ts',
        'src/lib/checkout/i18n/**/*.ts',
      ],
      thresholds: {
        'src/lib/i18n/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/components/i18n/**': { lines: 80, functions: 80, branches: 75, statements: 80 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/messages': path.resolve(__dirname, './messages'),
    },
  },
});
```

### 1.2 Setup global `src/test/setup.ts`

```ts
// src/test/setup.ts (extrait pour i18n)
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { server } from './msw/server';

// Mock next/navigation globalement (les helpers usent useRouter/usePathname)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/fr/kit',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());
```

### 1.3 Helper `render-with-i18n`

```tsx
// src/test/helpers/i18n/render-with-i18n.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';
import enMessages from '@/messages/en.json';

const MESSAGES = { fr: frMessages, ar: arMessages, en: enMessages };

export interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: 'fr' | 'ar' | 'en';
  timeZone?: string;
  now?: Date;
  messages?: Record<string, unknown>;
}

export function renderWithI18n(ui: ReactElement, options: RenderWithI18nOptions = {}) {
  const { locale = 'fr', timeZone = 'Africa/Casablanca', now, messages, ...rest } = options;
  const baseMessages = messages ?? MESSAGES[locale];

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={baseMessages}
      timeZone={timeZone}
      now={now ?? new Date('2026-05-27T10:00:00Z')}
    >
      {ui}
    </NextIntlClientProvider>,
    rest,
  );
}

export { screen, fireEvent, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

### 1.4 Constantes de test

```ts
// src/test/helpers/i18n/locales-matrix.ts
export const LOCALES_TEST_MATRIX = ['fr', 'ar', 'en'] as const;
export type TestLocale = (typeof LOCALES_TEST_MATRIX)[number];

export const DEFAULT_LOCALE: TestLocale = 'fr';
export const RTL_LOCALES = ['ar'] as const satisfies readonly TestLocale[];

export function isRtl(locale: TestLocale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export const LOCALE_FIXTURES = {
  fr: {
    code: 'fr',
    direction: 'ltr',
    displayName: 'French',
    displayNameNative: 'Français',
    currencyCode: 'MAD',
  },
  ar: {
    code: 'ar',
    direction: 'rtl',
    displayName: 'Arabic',
    displayNameNative: 'العربية',
    currencyCode: 'MAD',
  },
  en: {
    code: 'en',
    direction: 'ltr',
    displayName: 'English',
    displayNameNative: 'English',
    currencyCode: 'MAD',
  },
} as const;
```

## 2. Tests des helpers purs

### 2.1 `resolveLocale.test.ts`

```ts
// src/lib/i18n/resolveLocale.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLocale } from './resolveLocale';
import { LOCALES_TEST_MATRIX, DEFAULT_LOCALE } from '@/test/helpers/i18n/locales-matrix';

describe('resolveLocale', () => {
  describe('from path', () => {
    it('extracts fr from /fr/kit', () => {
      expect(resolveLocale({ path: '/fr/kit', cookie: null, acceptLanguage: null })).toBe('fr');
    });

    it('extracts ar from /ar/kit', () => {
      expect(resolveLocale({ path: '/ar/kit', cookie: null, acceptLanguage: null })).toBe('ar');
    });

    it('extracts en from /en/maison/produit-x', () => {
      expect(resolveLocale({ path: '/en/maison/produit-x', cookie: null, acceptLanguage: null })).toBe('en');
    });

    it('returns default for /', () => {
      expect(resolveLocale({ path: '/', cookie: null, acceptLanguage: null })).toBe(DEFAULT_LOCALE);
    });

    it('returns default for path with unknown locale', () => {
      expect(resolveLocale({ path: '/de/kit', cookie: null, acceptLanguage: null })).toBe(DEFAULT_LOCALE);
    });

    it('ignores casing in path', () => {
      expect(resolveLocale({ path: '/FR/kit', cookie: null, acceptLanguage: null })).toBe('fr');
    });
  });

  describe('from cookie (path has no locale)', () => {
    it('prefers cookie over default', () => {
      expect(resolveLocale({ path: '/kit', cookie: 'ar', acceptLanguage: null })).toBe('ar');
    });

    it('ignores invalid cookie value', () => {
      expect(resolveLocale({ path: '/kit', cookie: 'pirate', acceptLanguage: null })).toBe(DEFAULT_LOCALE);
    });
  });

  describe('from Accept-Language header (no path, no cookie)', () => {
    it('matches q-weight ordering', () => {
      const header = 'en-US,en;q=0.9,fr;q=0.8,ar;q=0.7';
      expect(resolveLocale({ path: '/kit', cookie: null, acceptLanguage: header })).toBe('en');
    });

    it('prefers FR over EN when q higher', () => {
      const header = 'en;q=0.5,fr;q=0.9';
      expect(resolveLocale({ path: '/kit', cookie: null, acceptLanguage: header })).toBe('fr');
    });

    it('falls back to default if no header match', () => {
      const header = 'de-DE,de;q=0.9,it;q=0.8';
      expect(resolveLocale({ path: '/kit', cookie: null, acceptLanguage: header })).toBe(DEFAULT_LOCALE);
    });

    it('handles empty Accept-Language', () => {
      expect(resolveLocale({ path: '/kit', cookie: null, acceptLanguage: '' })).toBe(DEFAULT_LOCALE);
    });
  });

  describe('priority order', () => {
    it('path > cookie > header > default', () => {
      expect(resolveLocale({ path: '/fr/kit', cookie: 'ar', acceptLanguage: 'en' })).toBe('fr');
    });

    it('cookie > header when no path', () => {
      expect(resolveLocale({ path: '/kit', cookie: 'ar', acceptLanguage: 'en' })).toBe('ar');
    });

    it('header > default when no path and no cookie', () => {
      expect(resolveLocale({ path: '/kit', cookie: null, acceptLanguage: 'en' })).toBe('en');
    });
  });

  describe('matrix coverage', () => {
    it.each(LOCALES_TEST_MATRIX)('resolves %s from path /%s/kit', (locale) => {
      expect(resolveLocale({ path: `/${locale}/kit`, cookie: null, acceptLanguage: null })).toBe(locale);
    });
  });
});
```

### 2.2 `matchLocale.test.ts`

```ts
// src/lib/i18n/matchLocale.test.ts
import { describe, it, expect } from 'vitest';
import { matchLocale } from './matchLocale';

describe('matchLocale', () => {
  const SUPPORTED = ['fr', 'ar', 'en'] as const;

  it('matches exact locale', () => {
    expect(matchLocale('fr', SUPPORTED)).toBe('fr');
    expect(matchLocale('ar', SUPPORTED)).toBe('ar');
    expect(matchLocale('en', SUPPORTED)).toBe('en');
  });

  it('matches base locale from region tag (fr-FR → fr)', () => {
    expect(matchLocale('fr-FR', SUPPORTED)).toBe('fr');
    expect(matchLocale('ar-MA', SUPPORTED)).toBe('ar');
    expect(matchLocale('en-US', SUPPORTED)).toBe('en');
    expect(matchLocale('en-GB', SUPPORTED)).toBe('en');
  });

  it('case-insensitive matching', () => {
    expect(matchLocale('FR', SUPPORTED)).toBe('fr');
    expect(matchLocale('Ar', SUPPORTED)).toBe('ar');
    expect(matchLocale('eN-uS', SUPPORTED)).toBe('en');
  });

  it('returns null for unsupported locales', () => {
    expect(matchLocale('de', SUPPORTED)).toBeNull();
    expect(matchLocale('it-IT', SUPPORTED)).toBeNull();
    expect(matchLocale('', SUPPORTED)).toBeNull();
  });

  it('handles invalid input gracefully', () => {
    expect(matchLocale('abc-def-ghi-jkl', SUPPORTED)).toBeNull();
    expect(matchLocale('!@#$', SUPPORTED)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(matchLocale(null as unknown as string, SUPPORTED)).toBeNull();
    expect(matchLocale(undefined as unknown as string, SUPPORTED)).toBeNull();
  });
});
```

### 2.3 `formatters.test.ts` — Date, Currency, Number

```ts
// src/lib/i18n/formatters.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatDate, formatCurrency, formatNumber, formatRelativeTime } from './formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-27T10:00:00Z'));
    });

    it('formats date in French (jj mois aaaa)', () => {
      const date = new Date('2026-05-27T10:00:00Z');
      expect(formatDate(date, 'fr', { dateStyle: 'long' })).toMatch(/27 mai 2026/);
    });

    it('formats date in Arabic (calendrier grégorien forcé)', () => {
      const date = new Date('2026-05-27T10:00:00Z');
      const result = formatDate(date, 'ar', { dateStyle: 'long' });
      expect(result).toMatch(/2026/);
      expect(result).toMatch(/مايو/);
    });

    it('formats date in English (Month dd, yyyy)', () => {
      const date = new Date('2026-05-27T10:00:00Z');
      expect(formatDate(date, 'en', { dateStyle: 'long' })).toMatch(/May 27, 2026/);
    });

    it('forces gregorian calendar even in AR', () => {
      const date = new Date('2026-05-27T10:00:00Z');
      const result = formatDate(date, 'ar', { dateStyle: 'long', calendar: 'gregory' });
      expect(result).toContain('2026');
    });

    it('respects timeZone', () => {
      const date = new Date('2026-05-27T23:30:00Z');
      const result = formatDate(date, 'fr', {
        dateStyle: 'short',
        timeZone: 'Africa/Casablanca',
      });
      // Casablanca UTC+0/+1 selon DST. En mai = UTC+1.
      expect(result).toMatch(/28\/05\/2026/);
    });

    it('throws on invalid Date', () => {
      const invalid = new Date('not-a-date');
      expect(() => formatDate(invalid, 'fr', { dateStyle: 'long' })).toThrow(/Invalid date/);
    });
  });

  describe('formatCurrency', () => {
    it('formats MAD in French', () => {
      expect(formatCurrency(1234.56, 'fr', { currency: 'MAD' })).toMatch(/1\s?234,56\s?MAD/);
    });

    it('formats MAD in Arabic (chiffres latins)', () => {
      const result = formatCurrency(1234.56, 'ar', { currency: 'MAD', useArabicNumerals: false });
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('formats MAD in Arabic with native numerals', () => {
      const result = formatCurrency(1234.56, 'ar', { currency: 'MAD', useArabicNumerals: true });
      expect(result).toMatch(/[٠-٩]/);
    });

    it('formats MAD in English', () => {
      expect(formatCurrency(1234.56, 'en', { currency: 'MAD' })).toMatch(/MAD\s?1,234\.56/);
    });

    it('handles zero correctly', () => {
      expect(formatCurrency(0, 'fr', { currency: 'MAD' })).toMatch(/0,00\s?MAD/);
    });

    it('handles negative amounts', () => {
      expect(formatCurrency(-499, 'fr', { currency: 'MAD' })).toMatch(/-\s?499,00\s?MAD/);
    });

    it('rounds to 2 decimals by default', () => {
      expect(formatCurrency(199.999, 'fr', { currency: 'MAD' })).toMatch(/200,00/);
    });

    it('throws on invalid currency code', () => {
      expect(() => formatCurrency(100, 'fr', { currency: 'XYZ' as any })).toThrow();
    });
  });

  describe('formatNumber', () => {
    it.each([
      ['fr', 1234567.89, /1\s?234\s?567,89/],
      ['en', 1234567.89, /1,234,567\.89/],
      ['ar', 1234567.89, /1[٬,]234[٬,]567[\.٫]89|١[٬]٢٣٤[٬]٥٦٧[٫]٨٩/],
    ])('formats %s number correctly', (locale, value, pattern) => {
      expect(formatNumber(value, locale as 'fr' | 'ar' | 'en')).toMatch(pattern);
    });

    it('handles percentages', () => {
      expect(formatNumber(0.789, 'fr', { style: 'percent' })).toMatch(/79\s?%/);
      expect(formatNumber(0.789, 'en', { style: 'percent' })).toMatch(/79%/);
    });

    it('handles compact notation', () => {
      expect(formatNumber(1500000, 'en', { notation: 'compact' })).toBe('1.5M');
      expect(formatNumber(1500, 'fr', { notation: 'compact' })).toMatch(/1,5\s?k/);
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-27T12:00:00Z'));
    });

    it('formats "il y a 2 jours" in French', () => {
      const past = new Date('2026-05-25T12:00:00Z');
      expect(formatRelativeTime(past, 'fr')).toMatch(/il y a 2 jours/);
    });

    it('formats "2 days ago" in English', () => {
      const past = new Date('2026-05-25T12:00:00Z');
      expect(formatRelativeTime(past, 'en')).toMatch(/2 days ago/);
    });

    it('formats Arabic relative time', () => {
      const past = new Date('2026-05-25T12:00:00Z');
      const result = formatRelativeTime(past, 'ar');
      expect(result).toMatch(/يوم|أيام/);
    });

    it('handles future dates', () => {
      const future = new Date('2026-05-30T12:00:00Z');
      expect(formatRelativeTime(future, 'fr')).toMatch(/dans 3 jours/);
    });

    it('handles "à l\'instant" (< 1 minute)', () => {
      const justNow = new Date('2026-05-27T11:59:30Z');
      expect(formatRelativeTime(justNow, 'fr')).toMatch(/à l'instant|maintenant|secondes/);
    });
  });
});
```

### 2.4 `pluralRules.test.ts`

```ts
// src/lib/i18n/pluralRules.test.ts
import { describe, it, expect } from 'vitest';
import { selectPluralKey } from './pluralRules';

describe('selectPluralKey', () => {
  describe('English plural rules', () => {
    it.each([
      [0, 'other'],
      [1, 'one'],
      [2, 'other'],
      [5, 'other'],
      [100, 'other'],
    ])('count=%d → %s', (count, expected) => {
      expect(selectPluralKey(count, 'en')).toBe(expected);
    });
  });

  describe('French plural rules', () => {
    it.each([
      [0, 'one'],   // français : 0 = singulier
      [1, 'one'],
      [2, 'other'],
      [5, 'other'],
    ])('count=%d → %s', (count, expected) => {
      expect(selectPluralKey(count, 'fr')).toBe(expected);
    });
  });

  describe('Arabic plural rules (6 catégories)', () => {
    it.each([
      [0, 'zero'],
      [1, 'one'],
      [2, 'two'],
      [3, 'few'],
      [11, 'many'],
      [100, 'other'],
    ])('count=%d → %s', (count, expected) => {
      expect(selectPluralKey(count, 'ar')).toBe(expected);
    });
  });

  it('handles negative numbers (rare mais possible)', () => {
    expect(selectPluralKey(-1, 'en')).toBe('one');
    expect(selectPluralKey(-2, 'fr')).toBe('other');
  });

  it('throws for unsupported locale', () => {
    expect(() => selectPluralKey(1, 'xx' as 'fr')).toThrow();
  });
});
```

### 2.5 `config.test.ts`

```ts
// src/lib/i18n/config.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, type Locale, LOCALE_LABELS, isRtlLocale } from './config';

describe('i18n config', () => {
  it('LOCALES contains exactly fr, ar, en in V1', () => {
    expect(LOCALES).toEqual(['fr', 'ar', 'en']);
  });

  it('DEFAULT_LOCALE is fr', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('DEFAULT_LOCALE is in LOCALES', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('LOCALE_LABELS has entry for each locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeDefined();
      expect(LOCALE_LABELS[locale].native).toBeTruthy();
      expect(LOCALE_LABELS[locale].english).toBeTruthy();
    }
  });

  it('isRtlLocale returns true only for ar', () => {
    expect(isRtlLocale('fr')).toBe(false);
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
  });

  describe('type-safety (compile-time checks)', () => {
    it('Locale type infers correctly', () => {
      const fr: Locale = 'fr';
      const ar: Locale = 'ar';
      const en: Locale = 'en';
      expect([fr, ar, en]).toHaveLength(3);

      // @ts-expect-error — 'de' n'est pas dans LOCALES
      const de: Locale = 'de';
      expect(de).toBe('de'); // runtime OK mais compile-time error attendu
    });

    it('LOCALES is readonly tuple', () => {
      expectTypeOf(LOCALES).toEqualTypeOf<readonly ['fr', 'ar', 'en']>();
    });
  });
});
```

### 2.6 Test type-safety des clés i18n

```ts
// src/lib/i18n/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import { useTranslations } from 'next-intl';

describe('Type safety des clés i18n', () => {
  it('clé valide compile', () => {
    const t = useTranslations('marketing.hero');
    const title = t('title');
    expectTypeOf(title).toBeString();
  });

  it('clé inexistante fail TS', () => {
    const t = useTranslations('marketing.hero');
    // @ts-expect-error — 'inexistant' n'est pas une clé valide
    t('inexistant');
  });

  it('namespace inexistant fail TS', () => {
    // @ts-expect-error — 'foo.bar' n'est pas un namespace valide
    useTranslations('foo.bar');
  });

  it('translation parameter strict', () => {
    const t = useTranslations('marketing');
    // Si la clé attend {name}, TypeScript le sait
    // @ts-expect-error — manque le paramètre 'name'
    t('greeting', {});
  });
});
```

### 2.7 Wizard dictionary integrity (CHA-231 régression)

```ts
// src/lib/checkout/i18n/dictionary.test.ts
import { describe, it, expect } from 'vitest';
import { WIZARD_DICTIONARIES, getWizardTranslation, type WizardDictionary } from './dictionary';

describe('WizardDictionary (CHA-231)', () => {
  it('has FR + AR dictionaries', () => {
    expect(WIZARD_DICTIONARIES.fr).toBeDefined();
    expect(WIZARD_DICTIONARIES.ar).toBeDefined();
  });

  it('FR and AR have exact same keys (no drift)', () => {
    const frKeys = collectKeys(WIZARD_DICTIONARIES.fr);
    const arKeys = collectKeys(WIZARD_DICTIONARIES.ar);
    expect(frKeys).toEqual(arKeys);
  });

  it('no key has empty value', () => {
    for (const locale of ['fr', 'ar'] as const) {
      const dict = WIZARD_DICTIONARIES[locale];
      const flat = flattenDictionary(dict);
      for (const [key, value] of Object.entries(flat)) {
        expect(value, `Empty value for ${locale}.${key}`).toBeTruthy();
        expect(value.length, `Too short: ${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('AR values contain Arabic characters', () => {
    const dict = WIZARD_DICTIONARIES.ar;
    const flat = flattenDictionary(dict);
    const arabicRegex = /[؀-ۿ]/;
    let foundArabic = 0;
    for (const value of Object.values(flat)) {
      if (arabicRegex.test(value)) foundArabic++;
    }
    expect(foundArabic).toBeGreaterThan(Object.keys(flat).length * 0.8);
  });

  describe('getWizardTranslation', () => {
    it('returns FR value for FR locale', () => {
      expect(getWizardTranslation('fr', 'shipping.title')).toBe(WIZARD_DICTIONARIES.fr.shipping.title);
    });

    it('returns AR value for AR locale', () => {
      expect(getWizardTranslation('ar', 'shipping.title')).toBe(WIZARD_DICTIONARIES.ar.shipping.title);
    });

    it('falls back to FR if AR key missing', () => {
      // Simuler une clé manquante volontairement (pas réaliste, défensif)
      const result = getWizardTranslation('ar', 'foo.bar' as never);
      expect(result).toBeDefined();
    });

    it('throws if both FR and target locale missing', () => {
      expect(() => getWizardTranslation('en' as never, 'invalid.key' as never)).toThrow();
    });
  });
});

function collectKeys(obj: WizardDictionary, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...collectKeys(v as WizardDictionary, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

function flattenDictionary(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(flat, flattenDictionary(v as Record<string, unknown>, path));
    } else if (typeof v === 'string') {
      flat[path] = v;
    }
  }
  return flat;
}
```

## 3. Tests de composants

### 3.1 `<LocaleSwitcher />` — variantes par locale

```tsx
// src/components/i18n/LocaleSwitcher.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/helpers/i18n/render-with-i18n';
import { LOCALES_TEST_MATRIX } from '@/test/helpers/i18n/locales-matrix';
import { LocaleSwitcher } from './LocaleSwitcher';

const mockPush = vi.fn();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({ push: mockPush, replace: vi.fn() }),
    usePathname: () => '/fr/kit',
  };
});

describe('<LocaleSwitcher />', () => {
  beforeEach(() => mockPush.mockReset());

  it.each(LOCALES_TEST_MATRIX)('renders trigger with current locale label (%s)', (locale) => {
    renderWithI18n(<LocaleSwitcher />, { locale });
    const button = screen.getByRole('button', { name: /choisir la langue|change language|اختر اللغة/i });
    expect(button).toBeInTheDocument();
  });

  it('shows all locales in dropdown when opened', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('menuitem', { name: /Français/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /العربية/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /English/i })).toBeInTheDocument();
  });

  it('marks active locale with aria-current', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocaleSwitcher />, { locale: 'ar' });
    await user.click(screen.getByRole('button'));

    const arItem = screen.getByRole('menuitem', { name: /العربية/i });
    expect(arItem).toHaveAttribute('aria-current', 'page');

    const frItem = screen.getByRole('menuitem', { name: /Français/i });
    expect(frItem).not.toHaveAttribute('aria-current', 'page');
  });

  it('navigates to same path on different locale click', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: /العربية/i }));

    expect(mockPush).toHaveBeenCalledWith('/ar/kit');
  });

  it('closes dropdown after click', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: /English/i }));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  describe('keyboard navigation', () => {
    it('opens on Enter', async () => {
      const user = userEvent.setup();
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('menu')).toBeVisible();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      await user.click(screen.getByRole('button'));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('navigates with ArrowDown / ArrowUp', async () => {
      const user = userEvent.setup();
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: /العربية/i })).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: /English/i })).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('menuitem', { name: /العربية/i })).toHaveFocus();
    });

    it('selects on Enter focused item', async () => {
      const user = userEvent.setup();
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      await user.click(screen.getByRole('button'));
      await user.keyboard('{ArrowDown}{Enter}');
      expect(mockPush).toHaveBeenCalledWith('/ar/kit');
    });
  });

  describe('aria attributes', () => {
    it('aria-expanded toggles on open/close', async () => {
      const user = userEvent.setup();
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('aria-haspopup is set', () => {
      renderWithI18n(<LocaleSwitcher />, { locale: 'fr' });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  describe('snapshots par locale', () => {
    it.each(LOCALES_TEST_MATRIX)('snapshot %s', (locale) => {
      const { container } = renderWithI18n(<LocaleSwitcher />, { locale });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
```

### 3.2 `<Header />` — vérifications légères (i18n parts seulement)

```tsx
// src/components/layout/Header.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithI18n, screen } from '@/test/helpers/i18n/render-with-i18n';
import { LOCALES_TEST_MATRIX } from '@/test/helpers/i18n/locales-matrix';
import { Header } from './Header';

describe('<Header /> i18n parts', () => {
  it.each(LOCALES_TEST_MATRIX)('renders navigation in %s', (locale) => {
    renderWithI18n(<Header />, { locale });
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('includes LocaleSwitcher', () => {
    renderWithI18n(<Header />, { locale: 'fr' });
    expect(screen.getByRole('button', { name: /langue|language|اللغة/i })).toBeInTheDocument();
  });

  it('navigation links have locale-aware hrefs', () => {
    renderWithI18n(<Header />, { locale: 'ar' });
    const kitLink = screen.getByRole('link', { name: /kit|الطقم/i });
    expect(kitLink).toHaveAttribute('href', expect.stringMatching(/^\/ar\//));
  });

  it('navigation links in FR start with /fr/', () => {
    renderWithI18n(<Header />, { locale: 'fr' });
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href?.startsWith('/')) {
        expect(href).toMatch(/^\/fr\//);
      }
    }
  });
});
```

### 3.3 Composant section avec contenu localisé

```tsx
// src/components/sections/Hero.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithI18n, screen } from '@/test/helpers/i18n/render-with-i18n';
import { LOCALES_TEST_MATRIX, isRtl } from '@/test/helpers/i18n/locales-matrix';
import { Hero } from './Hero';

describe('<Hero />', () => {
  it.each(LOCALES_TEST_MATRIX)('renders title in %s', (locale) => {
    renderWithI18n(<Hero />, { locale });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBeTruthy();
    expect(heading.textContent!.length).toBeGreaterThan(5);
  });

  it.each(LOCALES_TEST_MATRIX)('renders CTA in %s', (locale) => {
    renderWithI18n(<Hero />, { locale });
    expect(screen.getByRole('link', { name: /\w+/ })).toBeInTheDocument();
  });

  it('AR title contains Arabic characters', () => {
    renderWithI18n(<Hero />, { locale: 'ar' });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/[؀-ۿ]/);
  });

  it('FR title contains no Arabic characters', () => {
    renderWithI18n(<Hero />, { locale: 'fr' });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).not.toMatch(/[؀-ۿ]/);
  });

  describe('snapshots par locale', () => {
    it.each(LOCALES_TEST_MATRIX)('matches snapshot for %s', (locale) => {
      const { container } = renderWithI18n(<Hero />, { locale });
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
```

## 4. Tests de hooks i18n

### 4.1 `useTranslations` mock

```ts
// src/lib/i18n/useTranslations.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { renderWithI18n } from '@/test/helpers/i18n/render-with-i18n';
import { NextIntlClientProvider, useTranslations } from 'next-intl';

describe('useTranslations', () => {
  it('returns t function bound to namespace', () => {
    const { result } = renderHook(() => useTranslations('navigation'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="fr"
          messages={{ navigation: { home: 'Accueil', kit: 'Le kit' } }}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('home')).toBe('Accueil');
    expect(result.current('kit')).toBe('Le kit');
  });

  it('handles missing key gracefully (renders key in dev)', () => {
    const { result } = renderHook(() => useTranslations('navigation'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="fr"
          messages={{ navigation: { home: 'Accueil' } }}
          onError={() => {}}
          getMessageFallback={({ key }) => `[${key}]`}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('missing-key' as 'home')).toBe('[missing-key]');
  });

  it('interpolates parameters', () => {
    const { result } = renderHook(() => useTranslations('greeting'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="fr"
          messages={{ greeting: { hello: 'Bonjour {name}' } }}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('hello', { name: 'Sara' })).toBe('Bonjour Sara');
  });

  it('handles ICU plural', () => {
    const { result } = renderHook(() => useTranslations('cart'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="fr"
          messages={{
            cart: {
              items: '{count, plural, =0 {Aucun article} one {1 article} other {# articles}}',
            },
          }}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('items', { count: 0 })).toBe('Aucun article');
    expect(result.current('items', { count: 1 })).toBe('1 article');
    expect(result.current('items', { count: 5 })).toBe('5 articles');
  });
});
```

## 5. Tests de messages JSON (structure)

### 5.1 Validation Zod de la shape

```ts
// messages/messages.shape.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import frMessages from './fr.json';
import arMessages from './ar.json';
import enMessages from './en.json';

const messagesShape = z.object({
  common: z.object({
    back: z.string(),
    continue: z.string(),
    loading: z.string(),
    error: z.string(),
  }),
  navigation: z.object({
    home: z.string(),
    kit: z.string(),
    maison: z.string(),
    rituel: z.string(),
    journal: z.string(),
    contact: z.string(),
  }),
  marketing: z.object({
    hero: z.object({
      title: z.string().min(5).max(120),
      subtitle: z.string().min(5).max(200),
      cta_primary: z.string().min(2).max(60),
    }),
  }),
  errors: z.object({
    not_found: z.object({
      title: z.string(),
      description: z.string(),
      cta: z.string(),
    }),
  }),
  seo: z.object({
    default_title: z.string(),
    default_description: z.string(),
  }),
}).passthrough();

describe('Messages JSON shape', () => {
  it('fr.json conforms to shape', () => {
    const result = messagesShape.safeParse(frMessages);
    if (!result.success) console.error(result.error.flatten());
    expect(result.success).toBe(true);
  });

  it('ar.json conforms to shape', () => {
    const result = messagesShape.safeParse(arMessages);
    if (!result.success) console.error(result.error.flatten());
    expect(result.success).toBe(true);
  });

  it('en.json conforms to shape', () => {
    const result = messagesShape.safeParse(enMessages);
    if (!result.success) console.error(result.error.flatten());
    expect(result.success).toBe(true);
  });

  it('all locales have same set of keys (no drift)', () => {
    const frKeys = collectKeys(frMessages).sort();
    const arKeys = collectKeys(arMessages).sort();
    const enKeys = collectKeys(enMessages).sort();

    expect(arKeys, 'AR drift vs FR').toEqual(frKeys);
    expect(enKeys, 'EN drift vs FR').toEqual(frKeys);
  });

  it('FR is the source of truth (no empty values)', () => {
    const flat = flattenMessages(frMessages);
    for (const [key, value] of Object.entries(flat)) {
      expect(value, `Empty FR value for: ${key}`).toBeTruthy();
    }
  });

  it('AR values contain Arabic characters', () => {
    const arRegex = /[؀-ۿ]/;
    const flat = flattenMessages(arMessages);
    const valuesWithoutArabic: string[] = [];
    for (const [key, value] of Object.entries(flat)) {
      if (!arRegex.test(value) && value.length > 3) {
        valuesWithoutArabic.push(key);
      }
    }
    expect(valuesWithoutArabic.length, `Keys without Arabic chars in ar.json: ${valuesWithoutArabic.slice(0, 10).join(', ')}`).toBeLessThan(20);
  });
});

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function flattenMessages(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj !== 'object' || obj === null) return {};
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      flat[path] = v;
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(flat, flattenMessages(v, path));
    }
  }
  return flat;
}
```

## 6. Tests de fallback i18n

### 6.1 Test que la valeur FR est rendue si AR manque

```tsx
// src/lib/i18n/fallback.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';

describe('i18n fallback behavior', () => {
  it('renders fallback message for missing key in AR (with explicit fallback)', () => {
    const { result } = renderHook(() => useTranslations('common'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="ar"
          messages={{ common: { /* clé 'back' manquante */ } }}
          getMessageFallback={({ key, namespace }) => {
            const FR_FALLBACK: Record<string, string> = {
              'common.back': 'Retour',
            };
            return FR_FALLBACK[`${namespace}.${key}`] ?? `[${namespace}.${key}]`;
          }}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('back' as 'back')).toBe('Retour');
  });

  it('never renders raw [namespace.key] in prod', () => {
    const { result } = renderHook(() => useTranslations('common'), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider
          locale="ar"
          messages={{ common: { back: 'رجوع' } }}
        >
          {children}
        </NextIntlClientProvider>
      ),
    });
    expect(result.current('back')).toBe('رجوع');
    expect(result.current('back')).not.toMatch(/^\[/);
  });
});
```

## 7. Anti-patterns

### 7.1 Anti-patterns spécifiques unit i18n

1. **`expect(t('hero.title')).toBe('Découvrir')`** — couplé au texte, fragile.
2. **Charger directement `fr.json`** dans un test composant — bypass le provider.
3. **Pas tester AR** — RTL bug invisible.
4. **`render(<C />)` sans provider** — t() jette ou renvoie clé brute.
5. **Mock `vi.mock('next-intl')` global** — perd la vraie logique d'interpolation.
6. **Tests qui mutent `LOCALES`** — il faut faire `Object.freeze(LOCALES)`.
7. **Pas vérifier la shape JSON** — drift entre fr.json et ar.json silencieux.

### 7.2 Bon pattern : utiliser `.each(LOCALES_TEST_MATRIX)`

```ts
// ❌ Mauvais
it('renders in FR', () => {
  renderWithI18n(<Hero />, { locale: 'fr' });
  expect(screen.getByRole('heading')).toBeInTheDocument();
});
it('renders in AR', () => {
  renderWithI18n(<Hero />, { locale: 'ar' });
  expect(screen.getByRole('heading')).toBeInTheDocument();
});
// EN oublié → bug en EN

// ✅ Bon
it.each(LOCALES_TEST_MATRIX)('renders in %s', (locale) => {
  renderWithI18n(<Hero />, { locale });
  expect(screen.getByRole('heading')).toBeInTheDocument();
});
// Ajout d'une locale → automatiquement testé
```

## 8. Conventions de naming

```ts
describe('<ComponentName>', () => {
  describe('rendering', () => {
    it.each(LOCALES_TEST_MATRIX)('renders in %s', () => {});
  });
  describe('interactions', () => {
    it('opens dropdown on click', () => {});
    it('closes dropdown on Escape', () => {});
  });
  describe('a11y', () => {
    it('has correct aria-label', () => {});
    it('focus trap works', () => {});
  });
  describe('snapshots', () => {
    it.each(LOCALES_TEST_MATRIX)('snapshot %s', () => {});
  });
});
```

## 9. Commandes de test

```bash
# Tous les unit tests i18n
pnpm --filter @femiglow/web test -- src/lib/i18n

# Watch mode
pnpm --filter @femiglow/web test:watch -- src/lib/i18n

# Coverage uniquement i18n
pnpm --filter @femiglow/web test:coverage -- src/lib/i18n

# Un seul fichier
pnpm --filter @femiglow/web test -- src/lib/i18n/formatters.test.ts

# Update snapshots
pnpm --filter @femiglow/web test -- src/lib/i18n -u

# Filtrer par describe
pnpm --filter @femiglow/web test -- -t 'formatCurrency'
```

## 10. Checklist d'écriture d'un test unit i18n

- [ ] Fichier `.test.ts` (ou `.test.tsx` si JSX) à côté du fichier testé
- [ ] `import { describe, it, expect } from 'vitest'` explicite
- [ ] Pas de `import 'next-intl'` direct dans le test : utiliser `renderWithI18n`
- [ ] Si dépend de l'horloge : `vi.useFakeTimers()` + cleanup
- [ ] Boucler sur `LOCALES_TEST_MATRIX` quand pertinent
- [ ] Tester au moins 1 cas d'erreur (clé manquante, value invalide)
- [ ] Tester type-safety avec `// @ts-expect-error`
- [ ] Snapshot par locale si UI
- [ ] `it.each(...)` plutôt que copier 3 fois
- [ ] Pas de `console.log` qui reste
- [ ] Pas de `vi.spyOn(...)` qui fuit (cleanup dans `afterEach`)
