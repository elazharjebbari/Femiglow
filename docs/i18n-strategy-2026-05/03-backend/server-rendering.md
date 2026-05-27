# Server rendering — Patterns RSC i18n

> Tout ce qu'il faut savoir pour faire fonctionner i18n côté **React Server Components**, **Server Actions**, **streaming**, et **hydration** avec next-intl 3.x sur Next 14 App Router.

## 1. Vue d'ensemble

Next.js App Router introduit la séparation Server / Client Components. next-intl 3 gère cette dualité via deux APIs distinctes :

```
┌────────────────────────────────────────────────────────────────┐
│                  Composant React Server (RSC)                  │
│  - async / await possible                                      │
│  - Accès direct DB / fs                                        │
│  - Pas de hook (useState, useEffect, useTranslations)          │
│  → Utiliser :                                                  │
│    • getTranslations({ locale, namespace })                    │
│    • getMessages()                                             │
│    • getLocale()                                               │
│    • getFormatter()                                            │
│    • getTimeZone()                                             │
└────────────────────────────────────────────────────────────────┘

                              ↕  (via NextIntlClientProvider)

┌────────────────────────────────────────────────────────────────┐
│                Composant Client ('use client')                 │
│  - Hooks React possibles                                       │
│  - Sync (pas async/await pendant render)                       │
│  → Utiliser :                                                  │
│    • useTranslations(namespace)                                │
│    • useLocale()                                               │
│    • useFormatter()                                            │
│    • useTimeZone()                                             │
└────────────────────────────────────────────────────────────────┘
```

**Règle d'or** : préférer RSC partout où possible. Ne basculer en Client que pour interactivité (formulaires, animations, sélecteurs). Le bundle reste minimal et le SEO maximal.

## 2. Setup de base

### 2.1 Layout racine `[locale]/layout.tsx`

```tsx
// apps/web/src/app/[locale]/layout.tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/i18n.config';
import { getLocaleConfig } from '@/lib/i18n/locales';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function LocaleLayout({ children, params: { locale } }: LocaleLayoutProps) {
  // 1. Validate locale strictly
  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }

  // 2. Set the locale for the rest of the request (REQUIRED for static rendering)
  unstable_setRequestLocale(locale);

  // 3. Fetch messages on the server
  const messages = await getMessages();

  // 4. Resolve direction + display info from DB
  const config = await getLocaleConfig(locale);

  return (
    <html lang={locale} dir={config.direction}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
```

**Points clés** :
- `hasLocale` (next-intl 3.x) : type-guard pour `Locale` literal type
- `unstable_setRequestLocale` : oblige la locale à se propager dans le rendu RSC (sans ça, next-intl 3 force le rendu dynamique)
- `getMessages()` : retourne le dictionnaire complet de la locale active (chargé via `getRequestConfig`)
- `generateStaticParams` : génère 3 versions statiques au build (`/fr/`, `/ar/`, `/en/`)

### 2.2 `i18n/request.ts` (référence)

```ts
// apps/web/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES } from '../i18n.config';

export default getRequestConfig(async ({ locale }) => {
  if (!LOCALES.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      },
      number: {
        currency: { style: 'currency', currency: 'MAD' },
        percent: { style: 'percent' },
      },
    },
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        console.warn('[i18n]', error.message);
      } else {
        throw error;
      }
    },
    getMessageFallback({ namespace, key }) {
      return `[${[namespace, key].filter(Boolean).join('.')}]`;
    },
  };
});
```

### 2.3 `next.config.mjs`

```js
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(nextConfig);
```

## 3. Pattern Server Component (RSC)

### 3.1 Page statique localisée

```tsx
// apps/web/src/app/[locale]/(marketing)/kit/page.tsx
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n.config';
import { KitHeroSection } from '@/components/marketing/kit-hero-section';

interface PageProps {
  params: { locale: Locale };
}

export default async function KitPage({ params: { locale } }: PageProps) {
  // CRITICAL : indispensable pour autoriser le rendu statique
  unstable_setRequestLocale(locale);

  const t = await getTranslations('marketing.kit');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <KitHeroSection
        title={t('hero.title')}
        cta={t('hero.cta')}
      />
    </main>
  );
}

// Active la SSG : génère /fr/kit, /ar/kit, /en/kit au build
export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'ar' }, { locale: 'en' }];
}
```

### 3.2 Page avec fetch DB

```tsx
// apps/web/src/app/[locale]/(marketing)/maison/page.tsx
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { getCmsBindings } from '@/lib/cms/repos/component-binding.repo';

export default async function MaisonPage({ params: { locale } }: { params: { locale: Locale } }) {
  unstable_setRequestLocale(locale);

  // 1. Strings UI depuis JSON
  const t = await getTranslations({ locale, namespace: 'marketing.maison' });

  // 2. Content CMS depuis DB (avec fallback locale)
  const bindings = await getCmsBindings('maison-page', locale);

  return (
    <main>
      <h1>{t('title')}</h1>
      {/* Content dynamique (édité par fondatrice) */}
      <section>
        <h2>{bindings.section1_title ?? t('default_section_title')}</h2>
        <p>{bindings.section1_body ?? t('default_section_body')}</p>
      </section>
    </main>
  );
}
```

### 3.3 Nested layouts

```tsx
// apps/web/src/app/[locale]/legal/layout.tsx
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';

export default async function LegalLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div className="legal-shell">
      <nav>
        <a href={`/${locale}/legal/mentions-legales`}>{t('nav.mentions')}</a>
        <a href={`/${locale}/legal/cgv`}>{t('nav.cgv')}</a>
        <a href={`/${locale}/legal/confidentialite`}>{t('nav.confidentialite')}</a>
      </nav>
      <article>{children}</article>
    </div>
  );
}
```

### 3.4 Component RSC sans accès direct à locale param

```tsx
// apps/web/src/components/footer.tsx (Server Component)
import { getTranslations, getLocale } from 'next-intl/server';

export async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations('common.footer');

  return (
    <footer>
      <p>{t('copyright', { year: new Date().getFullYear() })}</p>
      <p>{t('made_in', { country: locale === 'ar' ? 'المغرب' : 'Maroc' })}</p>
    </footer>
  );
}
```

`getLocale()` lit la locale depuis le contexte de la requête (résolu par le middleware).

## 4. Pattern Client Component

### 4.1 Component interactif

```tsx
// apps/web/src/components/locale-switcher.tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next-intl/client';
import { useTransition } from 'react';
import { LOCALES, type Locale } from '@/i18n.config';

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function switchTo(newLocale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <div role="radiogroup" aria-label="Sélecteur de langue" data-pending={pending}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          onClick={() => switchTo(l)}
          disabled={pending}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

### 4.2 Formulaire avec translations + validation

```tsx
// apps/web/src/components/contact-form.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';
import { useState } from 'react';

export function ContactForm() {
  const t = useTranslations('marketing.contact');
  const tErrors = useTranslations('errors.validation');
  const format = useFormatter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const email = formData.get('email') as string;
    if (!email || !/.+@.+/.test(email)) {
      setError(tErrors('email_invalid'));
      return;
    }
    // ... submit
  }

  return (
    <form action={handleSubmit}>
      <label>
        {t('form.email_label')}
        <input name="email" type="email" required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">{t('form.submit')}</button>
      <small>{format.dateTime(new Date(), 'short')}</small>
    </form>
  );
}
```

### 4.3 Component RSC qui inclut un sous-Client

```tsx
// apps/web/src/app/[locale]/page.tsx (RSC)
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/contact-form'; // Client

export default async function HomePage({ params: { locale } }: { params: { locale: Locale } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('marketing.home');

  return (
    <main>
      <h1>{t('title')}</h1>
      {/* Le Client component hérite des messages via NextIntlClientProvider du layout */}
      <ContactForm />
    </main>
  );
}
```

## 5. Server Actions

### 5.1 Server Action localisée

```ts
// apps/web/src/lib/actions/checkout.actions.ts
'use server';

import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const checkoutSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  address: z.string().min(5),
  city: z.string().min(2),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/),
});

export async function submitCheckout(formData: FormData) {
  const t = await getTranslations('wizard');
  const tErrors = await getTranslations('errors.validation');

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Retourne les messages d'erreur localisés
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as string;
      errors[field] = tErrors(`${field}_invalid`, { defaultValue: tErrors('required') });
    }
    return { ok: false, errors };
  }

  // Process...
  const orderId = await createOrder(parsed.data);

  redirect(`/${parsed.data.locale ?? 'fr'}/checkout/confirmation/${orderId}`);
}
```

### 5.2 Action avec revalidation

```ts
'use server';

import { revalidateTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';

export async function publishComponentTranslation(
  componentId: string,
  fieldKey: string,
  locale: Locale,
  value: unknown,
) {
  const t = await getTranslations('admin.cms');

  // ... DB update ...

  revalidateTag(`cms-component-${componentId}`);
  revalidateTag(`i18n-${locale}`);

  return {
    ok: true,
    message: t('publish_success', { locale: locale.toUpperCase() }),
  };
}
```

## 6. `generateMetadata` et SEO

Couvert en détail dans [`./seo-canonicals.md`](./seo-canonicals.md). Pattern de base :

```tsx
// apps/web/src/app/[locale]/(marketing)/kit/page.tsx
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `https://femiglow.ma/${locale}/kit`,
      languages: {
        fr: 'https://femiglow.ma/fr/kit',
        ar: 'https://femiglow.ma/ar/kit',
        en: 'https://femiglow.ma/en/kit',
        'x-default': 'https://femiglow.ma/fr/kit',
      },
    },
    openGraph: {
      title: t('og_title'),
      description: t('og_description'),
      locale: locale === 'ar' ? 'ar_MA' : locale === 'en' ? 'en_US' : 'fr_FR',
    },
  };
}
```

## 7. `generateStaticParams`

### 7.1 Pour layouts et pages

```tsx
// apps/web/src/app/[locale]/layout.tsx
export function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'ar' }, { locale: 'en' }];
}
```

→ Au build, Next.js génère :
- `/fr/`
- `/ar/`
- `/en/`

### 7.2 Pour pages dynamiques (slugs CMS)

```tsx
// apps/web/src/app/[locale]/legal/[slug]/page.tsx
import { db } from '@/lib/db';
import { legalPages } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: legalPages.slug, locale: legalPages.locale })
    .from(legalPages)
    .where(eq(legalPages.status, 'published'));

  return rows.map(r => ({ locale: r.locale, slug: r.slug }));
}
```

→ Génère `/fr/legal/cgv`, `/ar/legal/cgv`, `/en/legal/cgv`, `/fr/legal/mentions-legales`, etc.

### 7.3 Hybride avec ISR

Si le contenu CMS change fréquemment, utiliser `revalidate` :

```tsx
export const revalidate = 300; // 5 min

export default async function LegalPage({ params: { locale, slug } }) {
  // ...
}
```

→ Pages générées à la demande, cachées 5 min, régénérées en background.

## 8. Hydration et streaming

### 8.1 Streaming RSC

next-intl est compatible avec le streaming React Server. Le `NextIntlClientProvider` ne bloque pas le render :

```tsx
// apps/web/src/app/[locale]/layout.tsx (extrait)
<NextIntlClientProvider locale={locale} messages={messages}>
  <Suspense fallback={<HeroSkeleton />}>
    <SlowHero />  {/* RSC async qui fetch DB */}
  </Suspense>
  <Suspense fallback={<FooterSkeleton />}>
    <Footer />
  </Suspense>
</NextIntlClientProvider>
```

### 8.2 Optimisation hydration payload

Par défaut, `<NextIntlClientProvider>` sérialise **tous** les messages dans le HTML. Pour des sites lourds, filtrer :

```tsx
import { pick } from 'next-intl';

const messages = await getMessages();
const clientMessages = pick(messages, [
  'common',
  'navigation',
  'marketing', // seulement ce qui est utilisé client
]);

return (
  <NextIntlClientProvider locale={locale} messages={clientMessages}>
    {children}
  </NextIntlClientProvider>
);
```

→ Réduit le `__NEXT_DATA__` HTML.

### 8.3 No-hydration mismatch

**Piège classique** : utiliser `formatRelative` ou `now` côté serveur avec un timezone différent du client.

```tsx
// MAUVAIS : peut produire un mismatch hydration
const format = useFormatter();
<span>{format.relativeTime(date)}</span>  // → "il y a 1 minute" sur server, "il y a 2 minutes" sur client si latence
```

**SOLUTION** : passer `now` explicitement depuis `getRequestConfig` :

```ts
// i18n/request.ts
return { /* ... */, now: new Date() };
```

→ Le serveur et le client utilisent le même `now`, pas de mismatch.

## 9. RSC vs Client component — Tableau décisionnel

| Critère | RSC | Client |
|---|---|---|
| Hooks React (useState, useEffect) | ❌ | ✅ |
| Async/await | ✅ | ⚠️ (mais sync pendant render) |
| Accès DB / fs | ✅ | ❌ |
| Bundle size impact | 0 kB JS client | + KB sur bundle |
| Hot reload state | N/A (re-render) | Préserve l'état |
| SEO | ✅ Top | ⚠️ Dépend du contenu rendu |
| Interactivité (onClick, onChange) | ❌ | ✅ |
| `useTranslations` | ❌ (utiliser `getTranslations`) | ✅ |
| `useLocale` | ❌ (utiliser `getLocale`) | ✅ |
| `unstable_setRequestLocale` | ✅ (à appeler dans layout / page) | ❌ |

### 9.1 Règles d'arbitrage FemiGlow

- **Pages publiques marketing** : RSC par défaut (SEO + perf)
- **Hero, kit, maison, rituel** : RSC, sous-composants animations peuvent être Client
- **Wizard checkout** : Client (état formulaire complexe)
- **Locale switcher** : Client (interactivité)
- **Footer, header, navigation** : RSC sauf si menu déroulant interactif (alors Client minimal)
- **Admin pages** : RSC pour data fetching, Client pour formulaires
- **Pages légales** : 100% RSC (statiques)

## 10. Cas spécifiques FemiGlow

### 10.1 Wizard checkout (CHA-231)

Le wizard utilise `WizardDictionary` existant. Pour l'intégrer avec next-intl :

```tsx
// apps/web/src/app/[locale]/wizard/layout.tsx
import { getTranslations } from 'next-intl/server';
import { WizardProvider } from '@/components/wizard/wizard-provider';
import { getWizardDictionary } from '@/lib/wizard/dictionary'; // CHA-231

export default async function WizardLayout({ children, params: { locale } }) {
  unstable_setRequestLocale(locale);

  // Dictionary existant (pas régresser CHA-231)
  const wizardDict = await getWizardDictionary(locale);

  // Messages next-intl globaux (common, errors, ...)
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={pick(messages, ['common', 'errors'])}>
      <WizardProvider dictionary={wizardDict}>
        {children}
      </WizardProvider>
    </NextIntlClientProvider>
  );
}
```

→ Le wizard garde son contrat type-safe (CHA-231) ; les messages globaux (boutons "Retour", erreurs) viennent de next-intl.

### 10.2 Admin panel (FR seulement V1)

```tsx
// apps/web/src/app/admin/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import frMessages from '../../messages/fr.json';

export default function AdminLayout({ children }) {
  // Force FR en admin V1
  return (
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

L'admin n'a pas de `[locale]` dans son path (cf. URL strategy § 2.4).

### 10.3 Pages d'erreur localisées

```tsx
// apps/web/src/app/[locale]/not-found.tsx
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors.404');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <a href="/">{t('cta_home')}</a>
    </main>
  );
}
```

Pour error pages, `error.tsx` doit être **Client** (Next.js requirement) :

```tsx
// apps/web/src/app/[locale]/error.tsx
'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors.500');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button onClick={reset}>{t('retry')}</button>
    </main>
  );
}
```

## 11. Performance benchmarks

| Métrique | Cible | Mesure attendue |
|---|---|---|
| TTFB (page marketing RSC + SSG) | < 200ms | ~ 100-150ms (edge cache) |
| TTFB (page CMS avec DB) | < 500ms | ~ 200-300ms |
| LCP (page kit) | < 2.5s | ~ 1.8s |
| Bundle JS client (locale active) | < 80kB gzipped | ~ 60-70kB |
| Bundle messages JSON (par locale) | < 8kB gzipped | ~ 4-6kB |

### 11.1 Optimisations

1. **Statique > dynamique** : `generateStaticParams` + ISR plutôt que SSR pure
2. **Lazy load images** : `next/image` avec `loading="lazy"` sur tout sauf le hero
3. **Splitting des messages** : `pick(messages, ['namespaces'])` côté Client provider
4. **Edge runtime** sur le middleware pour résolution locale
5. **Cache CDN** : Cache-Control immutable sur les bundles, max-age=300 sur les pages

## 12. Anti-patterns

1. **Oublier `unstable_setRequestLocale`** : next-intl 3 force le rendu dynamique sans, perd la SSG
   ```tsx
   // MAUVAIS
   export default async function Page({ params: { locale } }) {
     const t = await getTranslations(); // ❌ erreur en SSG
   }

   // BON
   export default async function Page({ params: { locale } }) {
     unstable_setRequestLocale(locale);
     const t = await getTranslations();
   }
   ```

2. **Mélanger getTranslations/useTranslations dans un composant** : un Server peut appeler `getTranslations`, jamais `useTranslations`. Inversement pour un Client.

3. **Charger toute la messages map dans un Client provider** : avec 20+ locales et 1000+ keys, le payload HTML explose. Utiliser `pick`.

4. **Async dans un Client component pendant render** : impossible. Utiliser `useEffect` + `useState` (mais préférer RSC).

5. **`generateStaticParams` qui retourne un tableau vide** : Next.js génère seulement les pages listées. Si vide, pas de pages → 404.

6. **Faire un fetch DB dans `generateMetadata` ET la page** : doubler le call. Utiliser `cache()` de React :
   ```ts
   import { cache } from 'react';

   const getKit = cache(async (locale: Locale) => {
     return db.select().from(kits).where(eq(kits.locale, locale));
   });

   // Appelé dans generateMetadata ET dans la page → 1 seule query
   ```

7. **Locale dans le path mais pas dans `<html lang>`** : casse l'accessibilité et le SEO. Toujours `<html lang={locale} dir={direction}>`.

## 13. Checklist à tester / à vérifier

### Layout
- [ ] `[locale]/layout.tsx` appelle `unstable_setRequestLocale(locale)`
- [ ] `[locale]/layout.tsx` retourne `<html lang={locale} dir={config.direction}>`
- [ ] `generateStaticParams` retourne `[{locale:'fr'},{locale:'ar'},{locale:'en'}]`
- [ ] `NextIntlClientProvider` reçoit `messages` et `locale`

### Pages
- [ ] `/fr/kit`, `/ar/kit`, `/en/kit` rendent en statique (vérifier `.next/server/app/[locale]/kit.html`)
- [ ] `getTranslations('marketing.kit')` fonctionne sans erreur
- [ ] Une page avec fetch DB utilise le pattern fallback locale
- [ ] `generateMetadata` retourne `alternates.canonical` localisé

### Client components
- [ ] `LocaleSwitcher` change la locale et redirige
- [ ] `useTranslations` dans un Client retourne les bonnes strings
- [ ] Pas de mismatch hydration (logs warning React absents)

### Server Actions
- [ ] Action `submitCheckout` retourne errors localisés
- [ ] Action invalide bien `revalidateTag` après update

### Performance
- [ ] TTFB < 200ms sur pages marketing
- [ ] Bundle messages locale active < 8 kB gzipped
- [ ] Bundle messages des autres locales non chargé

### Edge cases
- [ ] `/xx/kit` (locale invalide) → 404
- [ ] `/fr/non-existent` → page not-found localisée
- [ ] Erreur serveur → page error localisée

## 14. Références croisées

- API helpers : [`02-design-conception/api-contracts.md`](../02-design-conception/api-contracts.md)
- URL strategy : [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md)
- SEO et metadata : [`./seo-canonicals.md`](./seo-canonicals.md)
- Resolver middleware : [`./locale-resolver.md`](./locale-resolver.md)
- Components frontend : [`04-frontend/components-strategy.md`](../04-frontend/components-strategy.md)
- Wizard intégration : [`04-frontend/wizard-integration.md`](../04-frontend/wizard-integration.md)
