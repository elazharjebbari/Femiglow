# Locale switcher — composant complet

> Composant `<LocaleSwitcher />` : architecture, accessibilité, code TSX, tests. Le point de contact UX principal pour le changement de langue.

## 1. Cahier des charges

### 1.1 Exigences fonctionnelles

| ID | Exigence |
|---|---|
| F1 | Affiche les 3 locales actives (FR / AR / EN) avec nom natif et code |
| F2 | Indique la locale courante visuellement |
| F3 | Préserve le pathname courant lors du switch (`/fr/kit` → `/ar/kit`) |
| F4 | Persiste le choix dans cookie `NEXT_LOCALE` (1 an) |
| F5 | Pas de full page reload — navigation Next.js soft |
| F6 | Fonctionne en RSC + Client (Header est RSC, switcher est Client island) |
| F7 | Fallback robuste si JS désactivé (link tags simples) |

### 1.2 Exigences UX

| ID | Exigence |
|---|---|
| U1 | Placement primaire : header desktop, top-right (avant le panier) |
| U2 | Placement secondaire : footer mobile (la version desktop est trop discrète sur mobile) |
| U3 | Affordance claire — pas un dropdown caché derrière une seule icône globe sans label |
| U4 | Transitions douces (focus ring visible, hover state) |
| U5 | Respecte la voix FemiGlow : sobre, pas d'animation gimmicky |

### 1.3 Exigences accessibilité

| ID | Exigence |
|---|---|
| A1 | `aria-label` sur le bouton parent ("Choisir la langue") |
| A2 | Navigation clavier complète (Tab, Enter, Esc, flèches haut/bas) |
| A3 | `aria-current="page"` sur la locale active |
| A4 | `aria-expanded` mis à jour quand dropdown ouvre |
| A5 | Focus trap dans le dropdown ouvert (sinon Tab sort) |
| A6 | Respecte `prefers-reduced-motion` |
| A7 | Contraste minimum WCAG AA (4.5:1) sur tous les états |

## 2. Architectures candidates

### 2.1 Variante A — Dropdown bouton + menu

```
┌────────────────┐
│ 🇫🇷 FR  ▾       │  ← Bouton
└────────────────┘
       │ click
       ▼
┌────────────────┐
│ ● Français     │  ← Item actif (aria-current)
│ ○ العربية      │
│ ○ English      │
└────────────────┘
```

**Pros** : compact, scalable à 10+ langues, standard UX (Stripe, Vercel).
**Cons** : nécessite JS pour ouvrir, plus de markup.

### 2.2 Variante B — Pills inline (toujours visibles)

```
┌──────┬──────┬──────┐
│  FR  │  AR  │  EN  │
└──────┴──────┴──────┘
   ●
```

**Pros** : zéro click pour switcher, pas besoin de JS.
**Cons** : ne scale pas (4+ langues = wrap moche), prend de la place horizontale.

### 2.3 Variante C — Select natif HTML

```html
<select>
  <option>Français</option>
  <option>العربية</option>
  <option>English</option>
</select>
```

**Pros** : zéro JS, accessibilité native, ultra robuste.
**Cons** : style limité (impossible custom OS-wise), UX médiocre desktop.

### 2.4 Recommandation FemiGlow

**Desktop** : Variante A (dropdown) — pose tonale "élégante" et permet d'ajouter de nouvelles locales sans casser le layout.
**Mobile footer** : Variante B (pills) — affordance claire en bas de page, sert de secondary entry point.

V1 = 3 locales (FR/AR/EN), donc la Variante B reste OK sur mobile. Si V2 ajoute ES/IT, repasser en dropdown même sur mobile.

## 3. Code complet — desktop dropdown

### 3.1 Locale config

```ts
// src/lib/i18n/config.ts
export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export interface LocaleConfig {
  code: Locale;
  displayName: string;       // Nom dans la locale UI courante
  displayNameNative: string; // Nom dans la locale elle-même
  direction: 'ltr' | 'rtl';
  flagEmoji: string;
}

export const LOCALES_CONFIG: Record<Locale, LocaleConfig> = {
  fr: {
    code: 'fr',
    displayName: 'Français',
    displayNameNative: 'Français',
    direction: 'ltr',
    flagEmoji: '🇫🇷',
  },
  ar: {
    code: 'ar',
    displayName: 'Arabe',
    displayNameNative: 'العربية',
    direction: 'rtl',
    flagEmoji: '🇲🇦',
  },
  en: {
    code: 'en',
    displayName: 'Anglais',
    displayNameNative: 'English',
    direction: 'ltr',
    flagEmoji: '🇬🇧',
  },
};

export function getLocaleConfig(locale: string): LocaleConfig {
  return LOCALES_CONFIG[locale as Locale] ?? LOCALES_CONFIG[DEFAULT_LOCALE];
}
```

### 3.2 Composant dropdown desktop

```tsx
// src/components/layout/LocaleSwitcher.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next-intl/client';
import { LOCALES, LOCALES_CONFIG, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  /** Style variant: header (compact) or footer (expanded). */
  variant?: 'header' | 'footer';
  className?: string;
}

export function LocaleSwitcher({ variant = 'header', className }: LocaleSwitcherProps) {
  const t = useTranslations('common.locale_switcher');
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentConfig = LOCALES_CONFIG[currentLocale];

  function handleSelect(locale: Locale) {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }
    // Naviguer en preservant le pathname courant
    router.replace(pathname, { locale });
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Ferme sur Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Ferme sur click hors composant
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return;
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Navigation clavier dans la liste
  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const currentIndex = items.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('button_label')}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 ps-3 pe-2 py-1.5 rounded-md border border-border',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'header' && 'text-sm',
          variant === 'footer' && 'text-base',
        )}
      >
        <span aria-hidden="true">{currentConfig.flagEmoji}</span>
        <span>{currentConfig.code.toUpperCase()}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="menu"
          aria-label={t('menu_label')}
          onKeyDown={handleListKeyDown}
          className={cn(
            'absolute end-0 top-full mt-1 min-w-[160px] rounded-md border border-border',
            'bg-popover shadow-md p-1 z-50',
          )}
        >
          {LOCALES.map((locale) => {
            const config = LOCALES_CONFIG[locale];
            const isActive = locale === currentLocale;
            return (
              <li key={locale} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelect(locale)}
                  className={cn(
                    'w-full text-start ps-3 pe-3 py-2 rounded-sm text-sm',
                    'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                    'flex items-center gap-2',
                    isActive && 'font-semibold',
                  )}
                  lang={locale}
                  dir={config.direction}
                >
                  <span aria-hidden="true">{config.flagEmoji}</span>
                  <span>{config.displayNameNative}</span>
                  {isActive && <span aria-hidden="true" className="ms-auto">●</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
```

### 3.3 Clés messages associées

```json
{
  "common": {
    "locale_switcher": {
      "button_label": "Choisir la langue, langue courante : {locale}",
      "menu_label": "Sélectionner une langue"
    }
  }
}
```

Note : `button_label` utilise un placeholder `{locale}` qu'on peut interpoler dynamiquement :

```tsx
aria-label={t('button_label', { locale: currentConfig.displayNameNative })}
```

## 4. Code complet — footer mobile pills

```tsx
// src/components/layout/LocaleSwitcherPills.tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next-intl/client';
import { LOCALES, LOCALES_CONFIG, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

export function LocaleSwitcherPills({ className }: { className?: string }) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sélecteur de langue"
      className={cn('inline-flex items-center gap-1 p-1 rounded-md bg-muted', className)}
    >
      {LOCALES.map((locale) => {
        const config = LOCALES_CONFIG[locale];
        const isActive = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-pressed={isActive}
            onClick={() => router.replace(pathname, { locale })}
            className={cn(
              'ps-3 pe-3 py-1.5 rounded text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            lang={locale}
            dir={config.direction}
          >
            {config.code.toUpperCase()}
          </button>
        );
      })}
    </nav>
  );
}
```

## 5. Placement dans le Header

```tsx
// src/components/layout/Header.tsx
// RSC par défaut, mais imports les Client islands
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { LocaleSwitcher } from './LocaleSwitcher';
import { CartButton } from './CartButton';

export async function Header() {
  const t = await getTranslations('navigation');
  const locale = await getLocale();

  return (
    <header className="border-b">
      <div className="container mx-auto ps-4 pe-4 py-3 flex items-center gap-6">
        <Link href={`/${locale}/`} className="font-semibold text-lg">
          FemiGlow
        </Link>

        <nav className="hidden md:flex items-center gap-4 grow">
          <Link href={`/${locale}/kit`}>{t('kit')}</Link>
          <Link href={`/${locale}/rituel`}>{t('rituel')}</Link>
          <Link href={`/${locale}/journal`}>{t('journal')}</Link>
          <Link href={`/${locale}/contact`}>{t('contact')}</Link>
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <LocaleSwitcher variant="header" />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
```

## 6. Placement dans le Footer (mobile)

```tsx
// src/components/layout/Footer.tsx
import { LocaleSwitcherPills } from './LocaleSwitcherPills';

export function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto ps-4 pe-4 py-8">
        {/* ... liens footer ... */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2026 FemiGlow</p>
          <LocaleSwitcherPills className="md:hidden" />
        </div>
      </div>
    </footer>
  );
}
```

Note : `md:hidden` cache le switcher pill desktop (où le dropdown header suffit).

## 7. Persistence côté serveur

`next-intl` met automatiquement le cookie `NEXT_LOCALE` lors de la navigation via `router.replace(..., { locale })`. Mais on peut aussi le forcer via une Server Action si nécessaire :

```ts
// src/lib/i18n/actions.ts
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Locale } from './config';

export async function switchLocaleAction(locale: Locale, pathname: string) {
  cookies().set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect(`/${locale}${pathname}`);
}
```

Utile pour un fallback `<form action={switchLocaleAction}>` (no-JS).

## 8. Accessibilité — détails

### 8.1 Schéma ARIA recommandé

```
<button aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choisir la langue, langue courante : Français">
  🇫🇷 FR ▾
</button>

<ul role="menu" aria-label="Sélectionner une langue">
  <li role="none">
    <button role="menuitemradio"
            aria-checked={true}
            aria-current="page"
            lang="fr"
            dir="ltr">
      🇫🇷 Français ●
    </button>
  </li>
  <li role="none">
    <button role="menuitemradio"
            aria-checked={false}
            lang="ar"
            dir="rtl">
      🇲🇦 العربية
    </button>
  </li>
</ul>
```

### 8.2 Pourquoi `lang` et `dir` sur chaque item ?

Pour que le screen reader prononce "العربية" en arabe (pas en français) et que la direction du texte soit correcte même dans un dropdown global LTR.

### 8.3 Focus management

| Action | Comportement |
|---|---|
| Tab sur button | Focus visible (ring) |
| Enter / Space | Ouvre dropdown, focus 1er item |
| Tab dans dropdown | Navigue items (par défaut tab cycle) |
| ArrowDown / Up | Item suivant / précédent |
| Home / End | Premier / dernier item |
| Enter sur item | Sélectionne + ferme + focus button |
| Escape | Ferme dropdown + focus button |
| Click hors | Ferme dropdown (pas de refocus) |

### 8.4 Reduced motion

```tsx
const prefersReduced = useReducedMotion(); // hook custom ou framer-motion
const transition = prefersReduced ? 'transition-none' : 'transition-transform';

<ChevronDown className={cn('h-4 w-4', transition, open && 'rotate-180')} />
```

## 9. Édge cases

### 9.1 Path avec query params

```
/fr/kit?source=email → switch AR → /ar/kit?source=email
```

`useRouter().replace(pathname, { locale })` ne préserve pas les query params par défaut. Solution :

```ts
const searchParams = useSearchParams();
const queryString = searchParams.toString();
const href = queryString ? `${pathname}?${queryString}` : pathname;
router.replace(href, { locale });
```

### 9.2 Path avec hash anchor

```
/fr/kit#benefits → switch AR → /ar/kit#benefits
```

`useRouter` ne gère pas le hash. À ajouter manuellement :

```ts
const hash = typeof window !== 'undefined' ? window.location.hash : '';
router.replace(`${pathname}${hash}`, { locale });
```

### 9.3 Page dynamique avec slug

```
/fr/journal/mon-premier-article → switch AR
```

Cas 1 : si slugs sont identiques entre locales (article unique), navigation OK.

Cas 2 : si slugs diffèrent (`/fr/journal/mon-article` vs `/ar/journal/maqala-1`), le router doit savoir comment mapper. Solution : table `article_translations(article_id, locale, slug)` côté DB, et un helper `getLocalizedSlug(currentSlug, fromLocale, toLocale)`.

Pour V1, on garde les mêmes slugs (= simplicité). V2 verra des slugs traduits via `next-intl` pathnames feature.

### 9.4 Page 404

Si la page n'existe pas dans la locale cible :

```
/fr/page-existante → switch AR → /ar/page-existante → 404 si pas traduite
```

Solution : page 404 localisée avec lien vers home. Acceptable en V1.

V2 : `notFound()` peut rediriger vers la page la plus proche (home `/[locale]/`).

### 9.5 No-JS fallback

```tsx
// src/components/layout/LocaleSwitcherFallback.tsx (RSC, no-JS)
import { getLocale } from 'next-intl/server';
import { LOCALES, LOCALES_CONFIG } from '@/lib/i18n/config';
import Link from 'next-intl/link';

export async function LocaleSwitcherFallback({ pathname }: { pathname: string }) {
  const currentLocale = await getLocale();
  return (
    <noscript>
      <ul className="inline-flex gap-2">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              aria-current={locale === currentLocale ? 'page' : undefined}
            >
              {LOCALES_CONFIG[locale].displayNameNative}
            </Link>
          </li>
        ))}
      </ul>
    </noscript>
  );
}
```

À utiliser en complément du dropdown JS dans le header.

## 10. Tests

### 10.1 Vitest — comportement de base

```ts
// LocaleSwitcher.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import { LocaleSwitcher } from '../LocaleSwitcher';

const mockReplace = vi.fn();
vi.mock('next-intl/client', async (orig) => ({
  ...(await orig<typeof import('next-intl/client')>()),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/kit',
}));

function setup() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messagesFr}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

describe('LocaleSwitcher', () => {
  beforeEach(() => mockReplace.mockClear());

  it('displays current locale flag and code', () => {
    setup();
    expect(screen.getByRole('button', { name: /langue/i })).toHaveTextContent('FR');
  });

  it('opens menu on click', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /langue/i }));
    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });

  it('marks current locale as checked', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));
    const frItem = screen.getByRole('menuitemradio', { name: /français/i });
    expect(frItem).toHaveAttribute('aria-checked', 'true');
    expect(frItem).toHaveAttribute('aria-current', 'page');
  });

  it('calls router.replace with target locale and preserves pathname', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /العربية/ }));
    expect(mockReplace).toHaveBeenCalledWith('/kit', { locale: 'ar' });
  });

  it('closes menu on Escape', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders Arabic option with dir=rtl', () => {
    setup();
    fireEvent.click(screen.getByRole('button'));
    const arItem = screen.getByRole('menuitemradio', { name: /العربية/ });
    expect(arItem).toHaveAttribute('dir', 'rtl');
    expect(arItem).toHaveAttribute('lang', 'ar');
  });
});
```

### 10.2 Playwright — E2E

```ts
// e2e/locale-switcher.spec.ts
import { test, expect } from '@playwright/test';

test.describe('LocaleSwitcher E2E', () => {
  test('switches from FR to AR preserving path', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.getByRole('button', { name: /langue/i }).click();
    await page.getByRole('menuitemradio', { name: 'العربية' }).click();
    await expect(page).toHaveURL(/\/ar\/kit$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('persists locale via cookie', async ({ page, context }) => {
    await page.goto('/fr/kit');
    await page.getByRole('button', { name: /langue/i }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/kit$/);
    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('en');
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/fr/kit');
    await page.keyboard.press('Tab'); // logo
    // ... navigate to switcher
    const switcher = page.getByRole('button', { name: /langue/i });
    await switcher.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    // First item after current = AR
    await expect(page).toHaveURL(/\/ar\/kit$/);
  });

  test('Escape closes menu', async ({ page }) => {
    await page.goto('/fr/');
    await page.getByRole('button', { name: /langue/i }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
  });

  test('preserves query params on switch', async ({ page }) => {
    await page.goto('/fr/kit?source=email&utm_campaign=spring');
    await page.getByRole('button', { name: /langue/i }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/kit\?source=email&utm_campaign=spring/);
  });
});
```

### 10.3 Tests axe / a11y

```ts
// e2e/a11y/locale-switcher.a11y.spec.ts
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('LocaleSwitcher has no a11y violations', async ({ page }) => {
  await page.goto('/fr/');
  await page.getByRole('button', { name: /langue/i }).click();
  const results = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
  expect(results.violations).toEqual([]);
});
```

## 11. Anti-patterns à éviter

### 11.1 Reload complet sur switch

```tsx
// MAUVAIS
<button onClick={() => { window.location.href = `/ar${pathname}`; }}>AR</button>
```

→ Perd le state, full reload, mauvais Lighthouse.

**Bon** : `router.replace(pathname, { locale: 'ar' })`.

### 11.2 Switcher uniquement avec flag emoji (sans label)

```tsx
// MAUVAIS — accessibility fail
<button>🇫🇷</button>
```

→ Screen reader lit "Drapeau France" ; pas explicite.

**Bon** : label texte + flag décoratif (`aria-hidden`).

```tsx
<button aria-label="Choisir la langue">
  <span aria-hidden="true">🇫🇷</span>
  <span>FR</span>
</button>
```

### 11.3 Pas de preserve pathname

```tsx
// MAUVAIS
<button onClick={() => router.push('/ar')}>AR</button>
```

→ User en `/fr/kit` clique AR → atterrit sur `/ar/` (home), perd le contexte.

**Bon** : `router.replace(pathname, { locale: 'ar' })`.

### 11.4 Dropdown qui force focus body

```tsx
// MAUVAIS
function handleSelect() {
  router.replace(...);
  document.body.focus(); // perd le contexte
}
```

**Bon** : refocus button parent ou laisser Next.js gérer le focus (focus on `<main>` après navigation).

### 11.5 Cookie sans path

```ts
// MAUVAIS
cookies().set('NEXT_LOCALE', 'ar'); // path default = page courante
```

→ Cookie pas envoyé sur d'autres routes.

**Bon** : `cookies().set('NEXT_LOCALE', 'ar', { path: '/' })`.

## 12. Variantes futures (V2+)

### 12.1 Autocomplete pour 10+ langues

Si on ajoute ES, IT, DE, etc., le dropdown devient long. Switcher en input avec autocomplete (Combobox WAI-ARIA pattern).

### 12.2 Sub-locales (ar-MA vs ar-SA)

Si on distingue darija marocain et arabe standard, le switcher devient à 2 niveaux : langue → région. UX similaire au sélecteur de langue iOS.

### 12.3 Persistence sans cookie (V2 RGPD strict)

Si banner cookie bloque `NEXT_LOCALE` par accident, fallback : query param `?lang=ar` + recompute à chaque request. Moins UX, mais robuste.

## 13. Checklist composant LocaleSwitcher

À copier dans la PR :

- [ ] Composant marqué `'use client'`
- [ ] Utilise `useLocale`, `usePathname`, `useRouter` de `next-intl/client`
- [ ] `LOCALES` source unique (`@/lib/i18n/config`)
- [ ] Bouton parent a `aria-label`, `aria-haspopup`, `aria-expanded`
- [ ] Items ont `role="menuitemradio"` + `aria-checked` + `aria-current`
- [ ] Items ont `lang` et `dir` corrects
- [ ] Navigation clavier : Tab, Enter, Esc, ArrowUp/Down, Home/End
- [ ] Focus revient sur button après select / close
- [ ] Click hors composant ferme dropdown
- [ ] Pathname courant préservé sur switch
- [ ] Query params préservés (`useSearchParams`)
- [ ] Cookie `NEXT_LOCALE` set automatiquement par `router.replace`
- [ ] Pas de full reload (`window.location` interdit)
- [ ] Variant `header` et `footer` testées
- [ ] Tests Vitest : ouverture, sélection, escape, mark current
- [ ] Tests Playwright : E2E switch + cookie + RTL apply
- [ ] Tests axe : 0 violation
- [ ] Reduced motion respecté
- [ ] Visuel sobre, cohérent avec voix FemiGlow
