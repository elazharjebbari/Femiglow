# 06 — Architecture technique Next.js

> *Stack, conventions, structure de code, patterns*

---

## 1. Stack technique retenue

| Couche | Outil | Version | Justification |
|---|---|---|---|
| **Framework** | Next.js | 14.2+ (App Router) | RSC, image opt, routing, ISR/SSG/SSR |
| **Runtime** | Node | 20 LTS | Stabilité, Edge runtime compatible |
| **Langage** | TypeScript | 5.4+ strict | Contrats explicites, refactor sûr |
| **Styling** | Tailwind CSS | 3.4+ | Productivité + tokens via CSS variables |
| **Tokens** | CSS custom properties | natif | Portable Tailwind ↔ CSS pur ↔ JS |
| **Validation** | Zod | 3.23+ | Types runtime, formulaires, contrats API/CMS |
| **Forms** | React Hook Form | 7.51+ | Perf, intégration Zod |
| **State client** | Zustand | 4.5+ | Léger, persist localStorage |
| **State URL** | `useSearchParams` natif | — | Filtres journal, étape checkout |
| **Animations** | Framer Motion | 11+ | API déclarative, respect prefers-reduced-motion |
| **Icônes** | Lucide React | latest | Cohérence, tree-shakeable |
| **Date** | date-fns | 3+ | Léger, tree-shakeable, locale FR |
| **Email transactionnel** | Resend (recommandé) | latest | Simplicité, API moderne, deliverability |
| **Paiement** | Stripe + CMI Maroc | latest | Standard mondial + gateway local |
| **Analytics** | Plausible + GA4 | latest | Vie privée + e-commerce funnel |
| **Test unitaire** | Vitest + Testing Library | latest | Vitesse, ESM-first |
| **Test e2e** | Playwright | 1.44+ | Multi-browser, vidéo, traces |
| **Lint** | ESLint + `eslint-config-next` | latest | + a11y rules |
| **Format** | Prettier | latest | Cohérence |
| **Storybook** | 8+ | latest | Documentation + a11y |
| **Hébergement** | Vercel | — | Edge, image opt, monitoring natif |

## 2. Structure de répertoires

```
template-femiglow/
├─ apps/
│  └─ web/                          ← application Next.js
│     ├─ src/
│     │  ├─ app/                    ← App Router (pages)
│     │  │  ├─ (marketing)/         ← group route — pages publiques
│     │  │  │  ├─ layout.tsx
│     │  │  │  ├─ page.tsx          ← /
│     │  │  │  ├─ rituel/page.tsx
│     │  │  │  ├─ kit/page.tsx
│     │  │  │  ├─ maison/page.tsx
│     │  │  │  ├─ journal/
│     │  │  │  │  ├─ page.tsx
│     │  │  │  │  └─ [slug]/page.tsx
│     │  │  │  └─ contact/page.tsx
│     │  │  ├─ (commerce)/          ← group route — pages tunnel
│     │  │  │  ├─ panier/page.tsx
│     │  │  │  ├─ commander/
│     │  │  │  │  ├─ layout.tsx     ← header/footer simplifiés
│     │  │  │  │  └─ page.tsx
│     │  │  │  └─ merci/page.tsx
│     │  │  ├─ api/                 ← API routes (handlers)
│     │  │  │  ├─ newsletter/route.ts
│     │  │  │  ├─ contact/route.ts
│     │  │  │  ├─ cart/route.ts
│     │  │  │  ├─ orders/route.ts
│     │  │  │  └─ orders/[id]/route.ts
│     │  │  ├─ layout.tsx           ← root layout (fonts, providers)
│     │  │  ├─ not-found.tsx
│     │  │  ├─ error.tsx
│     │  │  ├─ global-error.tsx
│     │  │  ├─ loading.tsx
│     │  │  ├─ globals.css
│     │  │  └─ tokens.css
│     │  ├─ components/             ← cf. doc 05 stratification
│     │  │  ├─ ui/
│     │  │  ├─ layout/
│     │  │  ├─ patterns/
│     │  │  ├─ forms/
│     │  │  ├─ commerce/
│     │  │  ├─ sections/
│     │  │  └─ overlays/
│     │  ├─ lib/
│     │  │  ├─ cms/                 ← adapter CMS (mock + futur Sanity/Contentful)
│     │  │  │  ├─ index.ts          ← API publique : getArticles(), getKit()...
│     │  │  │  ├─ mock.adapter.ts   ← Phase 1
│     │  │  │  └─ sanity.adapter.ts ← Phase 2 (stub)
│     │  │  ├─ cart/
│     │  │  │  ├─ store.ts          ← Zustand
│     │  │  │  └─ helpers.ts
│     │  │  ├─ payment/
│     │  │  │  ├─ stripe.ts
│     │  │  │  └─ mock.ts
│     │  │  ├─ analytics/
│     │  │  │  ├─ plausible.ts
│     │  │  │  └─ ga4.ts
│     │  │  ├─ email/
│     │  │  │  ├─ resend.ts
│     │  │  │  └─ templates/
│     │  │  ├─ utils/
│     │  │  │  ├─ format-price.ts
│     │  │  │  ├─ format-date.ts
│     │  │  │  └─ business-days.ts
│     │  │  └─ validation/          ← schémas Zod portables
│     │  │     ├─ article.ts
│     │  │     ├─ product.ts
│     │  │     ├─ cart.ts
│     │  │     ├─ order.ts
│     │  │     ├─ contact.ts
│     │  │     └─ index.ts
│     │  ├─ data/                   ← mock data Phase 1
│     │  │  ├─ articles.json
│     │  │  ├─ kit.json
│     │  │  ├─ testimonials.json
│     │  │  ├─ matieres.json
│     │  │  ├─ engagements.json
│     │  │  └─ faqs.json
│     │  ├─ hooks/
│     │  │  ├─ use-cart.ts
│     │  │  ├─ use-scroll-progress.ts
│     │  │  ├─ use-intersection-observer.ts
│     │  │  ├─ use-reduced-motion.ts
│     │  │  └─ use-media-query.ts
│     │  ├─ types/
│     │  │  └─ index.ts             ← types globaux dérivés de Zod
│     │  ├─ styles/
│     │  │  └─ tailwind.css
│     │  └─ middleware.ts           ← future i18n, redirects
│     ├─ public/
│     │  ├─ fonts/                  ← Pinyon, Cormorant, Inter (woff2 self-host)
│     │  ├─ images/
│     │  └─ videos/
│     ├─ tests/
│     │  ├─ unit/
│     │  └─ e2e/
│     ├─ .storybook/
│     ├─ next.config.mjs
│     ├─ tailwind.config.ts
│     ├─ tsconfig.json
│     ├─ package.json
│     └─ README.md
├─ docs/
│  ├─ pages/                        ← spécification éditoriale (existant)
│  └─ preparation/                  ← ce dossier
└─ README.md
```

> Le répertoire `apps/web` permet une future cohabitation `apps/cms` (interface admin) ou `apps/storybook` sans mélanger.

## 3. Conventions Next.js

### 3.1 App Router

- **Server Components par défaut** — ne marquer `'use client'` qu'au strict nécessaire (interactivité, hooks state)
- **Data fetching** dans les Server Components (pas de SWR/React Query côté client sauf besoin spécifique)
- **Streaming** via `loading.tsx` pour pages éditoriales
- **Métadonnées** via `generateMetadata` (cf. doc 11 SEO)
- **Route groups** `(marketing)` et `(commerce)` permettent layouts différents sans changer URL

### 3.2 Conventions de fichiers

| Fichier | Rôle |
|---|---|
| `page.tsx` | Page route |
| `layout.tsx` | Layout englobant (composé) |
| `loading.tsx` | Skeleton pendant Suspense |
| `error.tsx` | Boundary error (client) |
| `not-found.tsx` | 404 |
| `route.ts` | API endpoint (méthodes GET/POST/...) |
| `template.tsx` | Layout *non* persistant (re-mount) — éviter sauf besoin |

### 3.3 Génération statique vs dynamique

| Page | Stratégie | Justification |
|---|---|---|
| `/` | SSG + revalidate 1h | Contenu stable, régénération pour mise à jour articles featured |
| `/rituel`, `/maison` | SSG | Contenu très stable |
| `/kit` | ISR revalidate 5min | Stock, prix peuvent évoluer |
| `/journal` | ISR revalidate 1h | Liste articles évolue |
| `/journal/[slug]` | SSG + `generateStaticParams` + ISR | Articles connus à build, ouvrir on-demand |
| `/panier` | Dynamique (client) | État panier propre à session |
| `/commander` | Dynamique (no-cache) | Données saisies utilisateur |
| `/merci` | Dynamique (no-cache, no-store) | Sécurité données commande |
| `/contact` | SSG | Statique, formulaire client-side |

## 4. Pattern « adapter CMS »

Cœur du découplage data — un seul module expose toutes les méthodes data, plusieurs implémentations possibles.

```ts
// src/lib/cms/index.ts
import { mockAdapter } from './mock.adapter';
import { sanityAdapter } from './sanity.adapter'; // Phase 2

const adapter = process.env.CMS_PROVIDER === 'sanity'
  ? sanityAdapter
  : mockAdapter;

export const cms = {
  // Articles
  getArticles: adapter.getArticles,
  getArticleBySlug: adapter.getArticleBySlug,
  getFeaturedArticle: adapter.getFeaturedArticle,
  // Produits
  getKit: adapter.getKit,
  getKitComposition: adapter.getKitComposition,
  // Page Maison
  getMaisonPage: adapter.getMaisonPage,
  // Page Accueil
  getHomepageData: adapter.getHomepageData,
  // FAQ
  getFAQ: adapter.getFAQ,
};
```

Le CMS peut changer (Sanity → Contentful → Strapi) sans qu'aucun composant ni page n'ait besoin d'être modifié.

## 5. Pattern « état panier »

```ts
// src/lib/cart/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => ({ /* ... */ })),
      // ...
    }),
    { name: 'femiglow-cart-v1' }
  )
);
```

Sync optionnelle vers API serveur (recovery 24h) via Server Action ou route `/api/cart`.

## 6. Pattern « formulaire »

```tsx
// Exemple : NewsletterForm
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newsletterSchema, type NewsletterFormData } from '@/lib/validation/newsletter';

export function NewsletterForm({ source }: { source: string }) {
  const { register, handleSubmit, formState } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
  });

  async function onSubmit(data: NewsletterFormData) {
    const res = await fetch('/api/newsletter', { method: 'POST', body: JSON.stringify(data) });
    // gestion succès / erreur
  }

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

Le **même schéma Zod** est utilisé côté client (form) ET côté serveur (route handler validation) — cohérence garantie par construction.

## 7. Server Actions vs Route handlers

| Cas | Choix | Pourquoi |
|---|---|---|
| Mutation simple, source page Next | **Server Action** | Pas de fetch boilerplate, types partagés |
| API publique consommable hors Next | **Route handler** | Standard REST, headers explicites |
| Webhooks (Stripe, CMS) | **Route handler** | Vérification signature, no-op pages |
| Stripe payment intent | **Server Action** | Sécurité clé secrète |
| Newsletter / contact | **Route handler** + rate limit | Anti-spam, rate limit par IP |

## 8. Middleware

`src/middleware.ts` :

```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|images).*)',
  ],
};

export default function middleware(req: NextRequest) {
  // Phase 1 : minimal — security headers
  const res = NextResponse.next();
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Phase 2 : i18n routing fr/ar
  return res;
}
```

## 9. Variables d'environnement

```
# .env.local (jamais commité)
NEXT_PUBLIC_SITE_URL=https://femiglow.ma
CMS_PROVIDER=mock                  # mock | sanity | contentful

# Stripe (Phase 1 = mock)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM=contact@femiglow.ma

# Analytics
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=femiglow.ma
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# Sanity (Phase 2)
SANITY_PROJECT_ID=
SANITY_DATASET=
SANITY_API_TOKEN=
```

`.env.example` versionné, `.env.local` ignoré.

## 10. Conventions Git

| Branche | Usage |
|---|---|
| `main` | production, protégée, deploy auto Vercel |
| `develop` | intégration sprint, deploy preview |
| `feat/*` | feature branches |
| `fix/*` | bugfix |
| `chore/*` | maintenance, doc, deps |

**Commit Conventional Commits** : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`.

PR template avec checklist :
- [ ] Tokens utilisés exclusivement (pas de hex hardcodé)
- [ ] Tests unitaires ajoutés/maintenus
- [ ] Storybook story ajoutée si nouveau composant
- [ ] axe-core a11y vert
- [ ] Lighthouse pages impactées ≥ seuils

## 11. Performance — règles d'architecture

(détail dans doc 10)

- Polices auto-hébergées WOFF2 préchargées
- Images via `next/image` toujours, jamais `<img>`
- Code splitting par route Next.js natif
- Animations CSS ≥ Framer Motion quand possible (économie JS)
- Vidéos lazy + `preload="metadata"`
- Pas de bibliothèque > 30 KB sans justification

## 12. Sécurité — règles d'architecture

(détail dans doc 12)

- Pas de secret côté client
- Stripe en Server Action / route handler uniquement
- CSP stricte (à définir Phase 2 avec mesure réelle)
- Rate limiting newsletter et contact (Upstash Redis recommandé)
- reCAPTCHA v3 invisible sur `/contact`
- Sanitization Markdown articles (DOMPurify côté SSR)
- Validation Zod systématique aux frontières (input user, response API externe)

> *Document suivant : [07 — Modèles de données & contrats API](./07-modeles-donnees-api.md)*
