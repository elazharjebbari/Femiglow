# Component strategy — RSC vs Client + refactor pas-à-pas

> Comment écrire et refactorer des composants React qui consomment `next-intl` en respectant l'architecture RSC-first de Next.js 14.

## 1. Vue d'ensemble — quel hook pour quel composant

```
┌─────────────────────────────────────────────────────────────────┐
│ Composant Next.js 14                                            │
│                                                                 │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│  │ Server Component (RSC)       │  │ Client Component         │ │
│  │ (par défaut, sans 'use')    │  │ ('use client' en tête)   │ │
│  │                              │  │                          │ │
│  │ Hooks i18n disponibles :     │  │ Hooks i18n disponibles : │ │
│  │  - getTranslations (async)   │  │  - useTranslations       │ │
│  │  - getFormatter (async)      │  │  - useFormatter          │ │
│  │  - getLocale (async)         │  │  - useLocale             │ │
│  │  - getMessages (async)       │  │  - useMessages           │ │
│  │                              │  │  - useNow                │ │
│  │ Cas d'usage :                │  │ Cas d'usage :            │ │
│  │  - Pages, layouts            │  │  - Switcher locale       │ │
│  │  - Metadata HEAD             │  │  - Formulaires           │ │
│  │  - Sections statiques        │  │  - Animations            │ │
│  │  - Composants imbriqués      │  │  - State local           │ │
│  │    sans interactivité        │  │  - Hooks navigateur      │ │
│  └─────────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Règle d'or

> **Pose le `'use client'` le plus bas possible dans l'arbre.** Si un composant feuille a besoin de state, l'isoler ; ne pas marquer le parent client juste pour propager.

Exemple FemiGlow type : la page `/kit` est RSC, mais le bouton "Acheter maintenant" peut être un Client Component si on veut tracker `onClick`.

## 2. Server Components (RSC) — pattern par défaut

### 2.1 Page complète (RSC)

```tsx
// src/app/[locale]/kit/page.tsx
import { getTranslations } from 'next-intl/server';
import { KitHero } from '@/components/marketing/kit-layout/KitHero';
import { KitCta } from '@/components/marketing/kit-layout/KitCta';

export default async function KitPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'marketing.kit' });

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <KitHero />
      <KitCta />
    </main>
  );
}
```

### 2.2 Sous-composant RSC réutilisable

```tsx
// src/components/marketing/kit-layout/KitHero.tsx
// Pas de 'use client' → RSC par défaut
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

export async function KitHero() {
  const t = await getTranslations('marketing.kit.hero');

  return (
    <section className="ps-6 pe-6 py-12">
      <h2>{t('headline')}</h2>
      <p>{t('subline')}</p>
      <Image
        src="/images/kit-hero.webp"
        alt={t('image_alt')}
        width={1200}
        height={800}
      />
    </section>
  );
}
```

Points clés :
- `await getTranslations(...)` : c'est un Server Component async, autorisé en App Router.
- Pas d'import `useTranslations` — sinon erreur de build.
- Padding logique : `ps-6 pe-6` (start/end) au lieu de `pl-6 pr-6` → fonctionne en RTL automatiquement.

### 2.3 `generateMetadata` — RSC obligatoire

```tsx
// src/app/[locale]/kit/page.tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('og_title'),
      description: t('og_description'),
      images: [
        {
          url: '/og/kit.png',
          alt: t('og_image_alt'),
        },
      ],
    },
    alternates: {
      canonical: `/${locale}/kit`,
      languages: {
        fr: '/fr/kit',
        ar: '/ar/kit',
        en: '/en/kit',
        'x-default': '/fr/kit',
      },
    },
  };
}
```

## 3. Client Components — quand et comment

### 3.1 Cas légitimes

| Cas | Exemple FemiGlow |
|---|---|
| Interactivité utilisateur | Bouton CTA avec tracking, accordéon FAQ |
| State local | Toggle FAQ, dropdown menu |
| Hooks navigateur | `localStorage`, `IntersectionObserver` |
| Animations contrôlées | Carousel, scroll-reveal |
| Form input | LeadForm wizard, NewsletterForm |
| Router events | `LocaleSwitcher` avec `useRouter` |

### 3.2 Pattern de base

```tsx
// src/components/marketing/sections/FaqAccordion.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface FaqAccordionProps {
  itemIds: ReadonlyArray<string>; // ['shipping', 'returns', 'payment']
}

export function FaqAccordion({ itemIds }: FaqAccordionProps) {
  const t = useTranslations('marketing.faq');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {itemIds.map((id) => (
        <li key={id} className="border-b">
          <button
            type="button"
            onClick={() => setOpenId(openId === id ? null : id)}
            aria-expanded={openId === id}
            className="w-full text-start py-3"
          >
            {t(`items.${id}.question`)}
          </button>
          {openId === id && (
            <p className="pb-3 ps-4">{t(`items.${id}.answer`)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
```

Points clés :
- `'use client'` en tête.
- `useTranslations` (pas `getTranslations`).
- L'accès dynamique `t(\`items.${id}.question\`)` reste type-safe **si** les clés `items.shipping.question` etc. existent dans le messages.json (cf. `translation-keys.md` §3 module augmentation).
- `text-start` au lieu de `text-left` → s'inverse en RTL.

### 3.3 Pourquoi `useTranslations` marche côté client

Le `<NextIntlClientProvider>` posé dans `app/[locale]/layout.tsx` fournit les messages au sous-arbre. C'est un `React.Context` standard sous le capot.

```tsx
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

## 4. Passer les traductions d'un RSC vers un Client Component

Trois patterns selon le besoin.

### 4.1 Pattern A — Laisser le Client Component appeler `useTranslations`

C'est **le pattern par défaut**. Le Provider couvre tout le sous-arbre, donc un Client Component peut accéder à n'importe quelle clé sans recevoir de prop.

```tsx
// Server Component parent
// src/app/[locale]/kit/page.tsx
import { KitCta } from '@/components/marketing/kit-layout/KitCta';

export default async function KitPage() {
  return (
    <main>
      <KitCta />
    </main>
  );
}

// Client Component enfant
// src/components/marketing/kit-layout/KitCta.tsx
'use client';
import { useTranslations } from 'next-intl';

export function KitCta() {
  const t = useTranslations('marketing.kit.cta');
  return <button>{t('label')}</button>;
}
```

Avantages : zero boilerplate, Provider gère le bundling.
Inconvénient : le Client Component devient dépendant du namespace (pas testable en isolation sans setup MSW i18n).

### 4.2 Pattern B — Passer les strings déjà traduites en props

Utile pour composants génériques réutilisables sans namespace fixé.

```tsx
// Server Component parent
import { getTranslations } from 'next-intl/server';
import { CountdownBanner } from '@/components/marketing/CountdownBanner';

export default async function HomePage() {
  const t = await getTranslations('marketing.banner');
  return (
    <CountdownBanner
      headline={t('headline')}
      cta={t('cta')}
      deadline={new Date('2026-06-30')}
    />
  );
}

// Client Component enfant (générique)
'use client';
interface CountdownBannerProps {
  headline: string;
  cta: string;
  deadline: Date;
}

export function CountdownBanner({ headline, cta, deadline }: CountdownBannerProps) {
  // Logique de countdown ici (state, useEffect)
  return (
    <div>
      <p>{headline}</p>
      <button>{cta}</button>
    </div>
  );
}
```

Avantages :
- Composant client testable en isolation (props injectées).
- Réutilisable hors contexte i18n (storybook).

Inconvénient : verbeux si beaucoup de strings. À réserver aux composants vraiment génériques.

### 4.3 Pattern C — Passer le `messages` subset via `NextIntlClientProvider`

Quand on veut une **island** Client avec son propre namespace isolé.

```tsx
// Server Component parent
import { NextIntlClientProvider, useMessages } from 'next-intl';
import pick from 'lodash/pick';
import { WizardClient } from './WizardClient';

export default function Page() {
  const messages = useMessages();
  return (
    <NextIntlClientProvider messages={pick(messages, 'wizard')}>
      <WizardClient />
    </NextIntlClientProvider>
  );
}
```

Avantages : réduit le payload côté client (n'envoie que `wizard.*` au lieu de tout `messages`).

Inconvénient : duplique le Provider (verbose). À réserver aux sous-arbres lourds isolés (ex: wizard checkout, qui d'ailleurs reste sur `WizardDictionary` séparé).

### 4.4 Recommandation FemiGlow

| Cas | Pattern |
|---|---|
| Composant marketing standard | A (provider global suffit) |
| Composant UI générique (carousel, accordion sans i18n par défaut) | B (props) |
| Sous-arbre lourd avec son propre cycle de vie | C (pick + Provider local) — rare en V1 |

## 5. Quand splitter un composant

Symptômes qui justifient un split :

| Symptôme | Solution |
|---|---|
| Tu marques un gros composant `'use client'` juste pour un `onClick` enfant | Split : isoler le bouton en Client, garder le wrapper RSC |
| `useEffect` dans un composant qui contient aussi du contenu statique | Split : extraire l'effet dans un composant `'use client'` minuscule |
| Form interactif dans une page marketing | Split : `<HeroSection />` RSC + `<HeroForm />` Client |

### 5.1 Exemple — split d'un Hero

**Avant** (tout client à cause d'un bouton tracké) :

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

export function HeroSection() {
  const t = useTranslations('marketing.hero');
  return (
    <section>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <button onClick={() => trackEvent('hero_cta_click')}>
        {t('cta')}
      </button>
    </section>
  );
}
```

**Après** (RSC + island client) :

```tsx
// src/components/marketing/sections/HeroSection.tsx
// RSC (pas de 'use client')
import { getTranslations } from 'next-intl/server';
import { HeroCtaButton } from './HeroCtaButton';

export async function HeroSection() {
  const t = await getTranslations('marketing.hero');
  return (
    <section>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <HeroCtaButton />
    </section>
  );
}

// src/components/marketing/sections/HeroCtaButton.tsx
'use client';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

export function HeroCtaButton() {
  const t = useTranslations('marketing.hero');
  return (
    <button onClick={() => trackEvent('hero_cta_click')}>
      {t('cta')}
    </button>
  );
}
```

Bénéfice : la partie statique (`<h1>`, `<p>`) reste serverside-only (pas de JS hydratation), bundle réduit.

## 6. Refactor pas-à-pas — exemple FemiGlow réel

Cible : `apps/web/src/components/marketing/kit-layout/KitPageLayoutV2.tsx` (existant, 100% FR hardcoded).

### 6.1 État de départ (avant i18n)

```tsx
// Hypothèse de structure actuelle
export function KitPageLayoutV2() {
  return (
    <main>
      <header className="px-6 py-12 text-left">
        <h1>Le rituel ongles, en cinq minutes.</h1>
        <p>Trois gestes, un kit, une saison entière.</p>
        <button className="ml-4">Commander le kit</button>
      </header>
      <section>
        <h2>Pourquoi le kit FemiGlow</h2>
        <ul>
          <li>Sobre, posé, sans urgence factice</li>
          <li>Conçu au Maroc, pour le rituel</li>
          <li>Recharges disponibles à la saison</li>
        </ul>
      </section>
    </main>
  );
}
```

### 6.2 Étape 1 — identifier les strings à extraire

Inventaire :

| Endroit | String |
|---|---|
| `<h1>` | "Le rituel ongles, en cinq minutes." |
| `<p>` sous le h1 | "Trois gestes, un kit, une saison entière." |
| `<button>` | "Commander le kit" |
| `<h2>` section | "Pourquoi le kit FemiGlow" |
| `<li>` × 3 | "Sobre, posé...", "Conçu au Maroc...", "Recharges..." |

Soit 7 strings. Convention de nommage (cf. `02-design-conception/naming-conventions.md`) :

```
marketing.kit.hero.title
marketing.kit.hero.subtitle
marketing.kit.hero.cta
marketing.kit.benefits.heading
marketing.kit.benefits.items.0
marketing.kit.benefits.items.1
marketing.kit.benefits.items.2
```

### 6.3 Étape 2 — ajouter au `messages/fr.json`

```json
{
  "marketing": {
    "kit": {
      "hero": {
        "title": "Le rituel ongles, en cinq minutes.",
        "subtitle": "Trois gestes, un kit, une saison entière.",
        "cta": "Commander le kit"
      },
      "benefits": {
        "heading": "Pourquoi le kit FemiGlow",
        "items": [
          "Sobre, posé, sans urgence factice",
          "Conçu au Maroc, pour le rituel",
          "Recharges disponibles à la saison"
        ]
      }
    }
  }
}
```

### 6.4 Étape 3 — remplacer dans le composant (version RSC)

```tsx
// src/components/marketing/kit-layout/KitPageLayoutV2.tsx
import { getTranslations } from 'next-intl/server';

export async function KitPageLayoutV2() {
  const t = await getTranslations('marketing.kit');
  const benefitsItems = ['0', '1', '2'] as const;

  return (
    <main>
      <header className="ps-6 pe-6 py-12 text-start">
        <h1>{t('hero.title')}</h1>
        <p>{t('hero.subtitle')}</p>
        <button className="ms-4">{t('hero.cta')}</button>
      </header>
      <section>
        <h2>{t('benefits.heading')}</h2>
        <ul>
          {benefitsItems.map((idx) => (
            <li key={idx}>{t(`benefits.items.${idx}`)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

Changements :
- `getTranslations` async + composant async
- `ml-4` → `ms-4` (logique RTL)
- `px-6` → `ps-6 pe-6` (logique RTL)
- `text-left` → `text-start` (logique RTL)
- Strings remplacés par `t('key')`

### 6.5 Étape 4 — si bouton devient interactif → split

```tsx
// Découpe : le bouton CTA tracké devient Client
// src/components/marketing/kit-layout/KitOrderButton.tsx
'use client';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

export function KitOrderButton() {
  const t = useTranslations('marketing.kit.hero');
  return (
    <button
      type="button"
      className="ms-4"
      onClick={() => trackEvent('kit_order_click')}
    >
      {t('cta')}
    </button>
  );
}
```

Et dans le parent RSC :

```tsx
import { KitOrderButton } from './KitOrderButton';
// ...
<header>
  <h1>{t('hero.title')}</h1>
  <p>{t('hero.subtitle')}</p>
  <KitOrderButton />
</header>
```

### 6.6 Étape 5 — vérifications

Checklist post-refactor (cf. §10) :

- [ ] TypeScript compile sans warning
- [ ] `pnpm test` passe (snapshots à updater si besoin)
- [ ] `pnpm i18n:check-coverage` montre 100% FR (et coverage AR/EN à 0% pour ces clés — normal en attendant traduction)
- [ ] `pnpm lint` passe (ESLint `i18n/no-hardcoded-strings` ne bloque pas)
- [ ] Visuel identique en FR (screenshot diff Playwright)
- [ ] AR : `dir="rtl"` appliqué, paddings et marges miroirs (test manuel ou Playwright)

## 7. Anti-patterns à éviter

### 7.1 Anti-pattern : `'use client'` global au layout

```tsx
// MAUVAIS
// src/app/[locale]/layout.tsx
'use client';
// ...

export default function LocaleLayout(...) { ... }
```

Conséquence : tout l'arbre devient Client → on perd le RSC, le SSR streaming, et `getMessages()` ne marche plus côté server.

**Bon** : layout reste RSC, on injecte `<NextIntlClientProvider>` (lui-même Client component) à l'intérieur du JSX serveur.

### 7.2 Anti-pattern : concat de strings traduites

```tsx
// MAUVAIS
<p>{t('greeting')} {user.name} !</p>
// FR : "Bonjour {user.name} !"
// AR : ordre inversé ? mauvais alignement RTL
```

**Bon** : interpolation ICU.

```tsx
<p>{t('greeting', { name: user.name })}</p>
// messages/fr.json : "Bonjour {name} !"
// messages/ar.json : "مرحبا {name} !"
```

### 7.3 Anti-pattern : `useTranslations` dans un RSC

```tsx
// MAUVAIS — provoque une erreur runtime
export default function KitPage() {
  const t = useTranslations('marketing.kit'); // Erreur : RSC doit utiliser getTranslations
  return <h1>{t('title')}</h1>;
}
```

**Bon** : utiliser `getTranslations` (async).

```tsx
export default async function KitPage() {
  const t = await getTranslations('marketing.kit');
  return <h1>{t('title')}</h1>;
}
```

### 7.4 Anti-pattern : Tailwind directionnel

```tsx
// MAUVAIS
<div className="ml-4 mr-2 pl-6 text-left">
```

En RTL, le visuel sera cassé (la marge gauche restera à gauche au lieu de devenir droite).

**Bon** : logical properties Tailwind.

```tsx
<div className="ms-4 me-2 ps-6 text-start">
// ms = margin-start, me = margin-end, ps = padding-start, text-start = text-align: start
```

### 7.5 Anti-pattern : key calculée hors `t()`

```tsx
// MAUVAIS
const key = `marketing.kit.items.${id}`;
return <p>{t(key)}</p>;
// ESLint i18n peut ne pas détecter cette clé → orpheline ou manquante
```

**Bon** : construire la clé directement dans `t()` pour que la rule ESLint et le type checker la voient.

```tsx
return <p>{t(`marketing.kit.items.${id}`)}</p>;
```

## 8. Migration progressive — coexistence avec WizardDictionary

Le wizard checkout utilise `WizardDictionary` (CHA-231). On ne le remplace pas. Il coexiste avec `next-intl` :

| Composant | Source de traductions |
|---|---|
| Pages marketing (`/[locale]/...`) | `next-intl` + `messages/[locale].json` |
| Wizard checkout (`/commander/...`) | `WizardDictionary` (typed dict) |
| CMS components | `component_field_bindings.locale` (DB) |
| Pages légales | `next-intl` (titre/structure) + `legal_pages.body_md` (DB par locale) |

Les trois cohabitent sans conflit. Documentation des frontières dans `06-data-strategy/`.

## 9. Tests recommandés (par composant refactoré)

### 9.1 Vitest — RSC

```ts
// __tests__/KitPageLayoutV2.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import { KitPageLayoutV2 } from '../KitPageLayoutV2';

// Note : pour tester un RSC async on l'unwrappe
async function renderAsync() {
  const Tree = await KitPageLayoutV2();
  return render(
    <NextIntlClientProvider locale="fr" messages={messagesFr}>
      {Tree}
    </NextIntlClientProvider>,
  );
}

describe('KitPageLayoutV2', () => {
  it('renders FR title', async () => {
    await renderAsync();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Le rituel ongles, en cinq minutes.',
    );
  });

  it('renders 3 benefits items', async () => {
    await renderAsync();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});
```

### 9.2 Vitest — Client Component

```ts
// FaqAccordion.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import { FaqAccordion } from '../FaqAccordion';

function wrap(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messagesFr}>
      {node}
    </NextIntlClientProvider>
  );
}

describe('FaqAccordion', () => {
  it('opens an item on click', () => {
    render(wrap(<FaqAccordion itemIds={['shipping']} />));
    const button = screen.getByRole('button', { name: /livraison/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders translated question and answer', () => {
    render(wrap(<FaqAccordion itemIds={['shipping']} />));
    expect(screen.getByText(messagesFr.marketing.faq.items.shipping.question)).toBeVisible();
  });
});
```

### 9.3 Playwright — page entière

```ts
// e2e/kit-locale.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Kit page i18n', () => {
  test('FR shows French title', async ({ page }) => {
    await page.goto('/fr/kit');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Le rituel ongles',
    );
  });

  test('AR shows Arabic title with RTL', async ({ page }) => {
    await page.goto('/ar/kit');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');
  });
});
```

## 10. Checklist refactor composant FR → i18n

À copier dans chaque PR de migration.

- [ ] Toutes les strings utilisateur > 2 mots passées par `t('namespace.key')`
- [ ] Clés respectent `naming-conventions.md` (lowercase, hiérarchique, point séparateur)
- [ ] `messages/fr.json` mis à jour (FR canonical)
- [ ] Si modifs CTA / heading critique, prévenir traducteur AR/EN (créer ticket Crowdin)
- [ ] Composant marqué `async` si utilise `getTranslations`
- [ ] Composant marqué `'use client'` **seulement** si interactivité requise
- [ ] Classes Tailwind directionnelles remplacées par logical (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`)
- [ ] Aucune concat de strings traduites avec variables → utiliser interpolation `{var}`
- [ ] Aucun if/else sur count → utiliser ICU plural
- [ ] Tests vitest snapshot updated
- [ ] Tests vitest unit FR (au moins 1 par composant migré)
- [ ] Test Playwright FR + AR (smoke test affichage + dir RTL)
- [ ] `pnpm i18n:check-coverage` : coverage FR = 100% sur les nouvelles clés
- [ ] Code review : un autre dev a vérifié le pattern RSC vs Client
- [ ] PR description : screenshot avant/après FR + screenshot AR avec RTL
