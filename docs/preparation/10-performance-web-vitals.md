# 10 — Performance & Web Vitals

> *La fluidité est une promesse de marque. Chaque kilo-octet pèse sur l'expérience.*

---

## 1. Engagements de performance

| Métrique | Cible Phase 1 | Seuil critique | Mesure |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.0 s | 2.5 s | 75ᵉ percentile, terrain |
| **CLS** (Cumulative Layout Shift) | ≤ 0.05 | 0.1 | 75ᵉ percentile |
| **INP** (Interaction to Next Paint) | ≤ 150 ms | 200 ms | 75ᵉ percentile |
| **TTFB** (Time to First Byte) | ≤ 400 ms | 800 ms | Edge function |
| **FCP** (First Contentful Paint) | ≤ 1.5 s | 1.8 s | Lab + terrain |
| **TBT** (Total Blocking Time) | ≤ 150 ms | 200 ms | Lab Lighthouse |
| **Lighthouse Performance** | ≥ 95 | 90 | Mobile, Slow 4G |
| **Lighthouse Best Practices** | ≥ 95 | 90 | — |
| **Bundle JS first-load** | ≤ 90 kB gzipped | 110 kB | App Router shared |

**Contexte mobile Maroc** — connectivité variable, terminaux Android milieu de gamme. Les budgets ci-dessus sont calibrés pour un Moto G4 sur 4G dégradée.

## 2. Budgets par page

| Page | HTML transit | CSS | JS hydratation | Images above-fold | Total transit |
|---|---|---|---|---|---|
| `/` Accueil | ≤ 35 kB | ≤ 20 kB | ≤ 90 kB | ≤ 180 kB | ≤ 380 kB |
| `/rituel` | ≤ 30 kB | ≤ 18 kB | ≤ 90 kB | ≤ 220 kB | ≤ 400 kB |
| `/kit` | ≤ 30 kB | ≤ 18 kB | ≤ 110 kB | ≤ 250 kB | ≤ 450 kB |
| `/journal` | ≤ 25 kB | ≤ 16 kB | ≤ 80 kB | ≤ 200 kB | ≤ 360 kB |
| `/journal/[slug]` | ≤ 30 kB | ≤ 16 kB | ≤ 80 kB | ≤ 250 kB | ≤ 400 kB |
| `/maison` | ≤ 35 kB | ≤ 18 kB | ≤ 80 kB | ≤ 250 kB | ≤ 410 kB |
| `/panier` | ≤ 20 kB | ≤ 16 kB | ≤ 100 kB | ≤ 80 kB | ≤ 240 kB |
| `/commander` | ≤ 30 kB | ≤ 18 kB | ≤ 130 kB | ≤ 40 kB | ≤ 240 kB |
| `/merci` | ≤ 25 kB | ≤ 16 kB | ≤ 80 kB | ≤ 100 kB | ≤ 240 kB |
| `/contact` | ≤ 20 kB | ≤ 14 kB | ≤ 70 kB | ≤ 60 kB | ≤ 180 kB |

Toutes les valeurs sont **gzipped**. Vérifiées en CI via `bundlesize` ou `next-bundle-analyzer` + assertion script.

## 3. Stratégie de rendu (RSC + ISR + SSG)

| Page | Mode rendu | Cache | Revalidation |
|---|---|---|---|
| `/` | SSG + ISR | Vercel Edge | 60 min |
| `/rituel` | SSG + ISR | Edge | 60 min |
| `/kit` | SSG + ISR | Edge | 30 min (stock) |
| `/journal` | SSG + ISR | Edge | 30 min |
| `/journal/[slug]` | SSG + dynamic params | Edge | 60 min, on-demand revalidate webhook CMS |
| `/maison` | SSG | Edge | 24 h |
| `/panier` | RSC dynamic + Client island Zustand | None | none |
| `/commander` | RSC dynamic + Client island form | None | none |
| `/merci` | RSC dynamic (params session) | None | none |
| `/contact` | SSG | Edge | 24 h |

**Statistique attendue** : 90 % des hits pages publiques servies depuis Edge Cache (TTFB < 100 ms en Europe / Maghreb).

## 4. Images : pipeline complet

### 4.1 Sources et formats

```ts
// next.config.mjs
const config = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 720, 960, 1280, 1600, 1920],
    imageSizes: [80, 160, 240, 320],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.femiglow.ma' },
    ],
  },
};
```

**Format priorité** : AVIF → WebP → JPEG (fallback). PNG seulement pour transparence (ex. signatures, motifs).

### 4.2 Composant `<OptimizedImage />`

Wrapper local autour de `next/image` qui force le pattern :

```tsx
import Image, { ImageProps } from 'next/image';

interface Props extends Omit<ImageProps, 'placeholder'> {
  ratio: '16:9' | '4:5' | '1:1' | '3:4' | '21:9';
  blurDataURL?: string;
}

export function OptimizedImage({ ratio, blurDataURL, ...rest }: Props) {
  const [w, h] = ratio.split(':').map(Number);
  return (
    <div style={{ aspectRatio: `${w}/${h}` }} className="relative">
      <Image
        {...rest}
        fill
        sizes="(min-width: 1280px) 1200px, (min-width: 720px) 90vw, 100vw"
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL}
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}
```

### 4.3 Règles d'utilisation

| Position | `priority` | `loading` | `fetchPriority` |
|---|---|---|---|
| Hero above-fold | `priority` | n/a | `high` |
| Premier témoignage above-fold (rare) | `priority` | n/a | `auto` |
| Toute image below-fold | absent | `lazy` | `auto` |
| Image hors viewport mobile (desktop only) | absent | `lazy` | `low` |

**Jamais plus d'une `priority` image par page** (risque de saturer la fenêtre de transfert critique).

### 4.4 Blur placeholder

Génération automatique au build (si Sanity) ou statique (mock data) :

```ts
// scripts/generate-blur.ts
import { getPlaiceholder } from 'plaiceholder';
const { base64 } = await getPlaiceholder(buffer);
```

Stocker dans `imageSchema.placeholder` (cf. doc 07).

## 5. Polices : self-hosted, optimisées

```tsx
// app/layout.tsx
import { Cormorant_Garamond, Inter } from 'next/font/google';
import localFont from 'next/font/local';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-cormorant',
  preload: true,
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

const pinyon = localFont({
  src: './fonts/PinyonScript-Regular.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-pinyon',
  preload: false, // utilisé seulement wordmark
});
```

| Police | Poids embarqués | Subset | Total kB |
|---|---|---|---|
| Cormorant | 400, 500, 600 | latin | ~35 kB |
| Inter | 400, 500 | latin | ~22 kB |
| Pinyon Script | 400 | latin | ~14 kB |
| **Total** | | | **~71 kB woff2** |

`font-display: swap` partout. Préchargement uniquement sur les polices utilisées above-fold.

## 6. JavaScript : minimiser, scinder, retarder

### 6.1 RSC en priorité

Toute page est par défaut Server Component. Conversion en Client Component **seulement si** :

- état local (form, cart drawer, accordéon)
- listener d'événement (click, scroll)
- API navigateur (localStorage, IntersectionObserver)
- librairie incompatible RSC

### 6.2 Code splitting

| Pattern | Application |
|---|---|
| `dynamic(() => import())` | Composants lourds visibles au scroll (carrousel témoignages, lightbox image) |
| `dynamic` avec `{ ssr: false }` | Composants client uniquement (Stripe Elements, lightbox vidéo) |
| Route splitting | Géré nativement par App Router |
| Vendor chunk | Auto via Next.js webpack config |

### 6.3 Bundle audit

CI script :

```bash
ANALYZE=true pnpm build
node scripts/check-bundle-budget.mjs
```

Le script lit `.next/build-manifest.json`, calcule la taille gzippée par route, et **fail le build** si dépassement du budget de 10 %.

### 6.4 Librairies — choix calibrés

| Librairie | Usage | Coût gzipped | Justification |
|---|---|---|---|
| Framer Motion | Animations | ~30 kB (lazyMotion + features) | Tree-shake via `LazyMotion` + `domAnimation` |
| Zustand | Cart state | 1.2 kB | Léger, simple |
| React Hook Form | Forms | 9 kB | Performant, peu de re-renders |
| Zod | Validation | 13 kB | Source de vérité unique |
| Stripe.js | Checkout | ~30 kB | Chargé uniquement sur `/commander` étape 3 |

**Refus** :
- ❌ Lodash (utiliser `Array.prototype` + petites helpers)
- ❌ Moment.js / date-fns full (utiliser `Intl.DateTimeFormat` natif)
- ❌ jQuery, lodash, underscore
- ❌ Slick / Swiper (carrousel custom léger)

### 6.5 Tree-shaking Framer Motion

```tsx
// app/providers.tsx
'use client';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
```

Utiliser `m.div` plutôt que `motion.div` partout :

```tsx
import { m } from 'framer-motion';
<m.div animate={{ opacity: 1 }} />
```

Économie ~25 kB.

## 7. CSS : production-grade

| Pratique | Détail |
|---|---|
| Tailwind JIT | Purge automatique via `content` paths |
| CSS variables tokens | Single source `tokens.css` chargé global |
| Critical CSS | Inliné par Next.js automatiquement |
| Aucun CSS-in-JS runtime | Pas de styled-components ni Emotion |
| Aucun preprocesseur | Tailwind + CSS variables suffisent |
| `font-display: swap` | Sur toutes les polices |

Total CSS first-load cible : ≤ 18 kB gzipped après purge.

## 8. Tiers (third-party scripts)

| Script | Stratégie |
|---|---|
| Plausible Analytics | `<Script strategy="afterInteractive">`, ~1 kB |
| GA4 (Phase 2 si requis) | `strategy="lazyOnload"`, après idle |
| Stripe.js | Chargé uniquement sur `/commander` step 3 |
| hCaptcha | Chargé uniquement à mount du form contact / newsletter |
| Aucun tag manager Phase 1 | Évite injection de scripts |
| Aucun Hotjar / FullStory | Privacy-first |

**Règle** : tout script tiers > 10 kB doit être justifié dans une RFC. Aucun script tiers ne bloque LCP.

## 9. Connexion CMS (Phase 2 — anticipation)

Quand connecté à Sanity / Contentful :

| Pratique | Détail |
|---|---|
| ISR avec `revalidate` | 30-60 min selon page |
| On-demand revalidation | Webhook CMS appelle `/api/revalidate` |
| Tag-based invalidation | `revalidateTag('article')` quand article publié |
| Image CDN | `cdn.sanity.io` avec params `w`, `q`, `auto=format` |
| GROQ projection | Sélectionne uniquement champs nécessaires (pas `*`) |
| Réquetes parallèles | `Promise.all` côté RSC |

## 10. Caching strategy

| Niveau | Stratégie |
|---|---|
| **Edge cache (Vercel)** | Pages statiques + ISR |
| **HTTP cache headers** | `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` |
| **`fetch()` cache** | `next: { revalidate: 3600 }` |
| **Browser cache** | Static assets `Cache-Control: public, max-age=31536000, immutable` |
| **Service Worker** | Aucun en Phase 1 (pas de PWA) |

## 11. CLS prevention (zéro layout shift)

| Source potentielle | Mitigation |
|---|---|
| Images sans dimensions | `aspect-ratio` toujours défini sur conteneur |
| Polices web | `size-adjust` + `font-display: swap` + métriques fallback |
| Pubs / iframes | Aucune en Phase 1 |
| Bannière cookie | Réservé en bas, pas push-down (overlay sticky) |
| Skeleton → contenu | Mêmes dimensions exactes |
| Header sticky | `position: fixed` avec `padding-top` sur main |
| Vidéos | `aspect-ratio` toujours défini |

**Test CI** : Lighthouse mobile en CI, fail si CLS > 0.1.

## 12. INP (Interaction to Next Paint)

| Pratique | Détail |
|---|---|
| **Pas de gros work synchrone sur click** | `useTransition` pour mises à jour state |
| **Debounce input** | 300 ms sur recherche, 500 ms sur autocomplete |
| **Throttle scroll** | rAF natif via Framer Motion |
| **Web Worker** | Pour calculs > 50 ms (pas en Phase 1) |
| **`startTransition`** | Pour mises à jour non urgentes (filtrage journal) |
| **Memoization** | `useMemo` sur transformations coûteuses |
| **Avoid heavy event handlers** | Délégation où possible |

## 13. Mesure et monitoring

### 13.1 RUM (Real User Monitoring)

Vercel Speed Insights collecte LCP / CLS / INP / TTFB / FCP en production.

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: Props) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 13.2 Web Vitals custom reporting

```tsx
// lib/web-vitals.ts
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS(metric => sendToPlausible('CLS', metric));
  onINP(metric => sendToPlausible('INP', metric));
  onLCP(metric => sendToPlausible('LCP', metric));
  onFCP(metric => sendToPlausible('FCP', metric));
  onTTFB(metric => sendToPlausible('TTFB', metric));
}
```

### 13.3 Synthetic monitoring

| Outil | Fréquence | Pages |
|---|---|---|
| Lighthouse CI | Chaque PR | `/`, `/kit`, `/journal/[slug]` |
| Vercel Analytics | Continu | toutes |
| Treo (Lighthouse SaaS) | Quotidien | top 5 pages |
| WebPageTest | Hebdomadaire | manuel sur changements majeurs |

### 13.4 Alerting

| Seuil dépassé | Action |
|---|---|
| LCP > 2.5 s | Slack #perf alerte |
| CLS > 0.1 | Slack #perf alerte |
| INP > 200 ms | Slack #perf alerte |
| Bundle build > +15 % | PR check fail |
| 5xx rate > 0.5 % | PagerDuty |

## 14. Performance par page (cibles spécifiques)

| Page | LCP target | Element LCP probable |
|---|---|---|
| `/` | 1.8 s | Hero image |
| `/rituel` | 1.8 s | Hero photo contextuelle |
| `/kit` | 2.0 s | Photo produit principale |
| `/journal` | 1.6 s | Carte article featured |
| `/journal/[slug]` | 1.8 s | Image hero article |
| `/maison` | 1.9 s | Photo fondatrice |
| `/panier` | 1.4 s | Liste articles (LCP texte) |
| `/commander` | 1.5 s | Form étape 1 (LCP texte) |
| `/merci` | 1.6 s | Lettre éditoriale (LCP texte) |
| `/contact` | 1.4 s | Form (LCP texte) |

## 15. Cas mobile : test continu

| Device cible | Profil réseau |
|---|---|
| Moto G4 (lower-mid) | 4G dégradée 1.6 Mbps / 750ms RTT |
| iPhone 12 mini | 4G stable 4 Mbps |
| Samsung A52 | 4G urbaine 5 Mbps |

Tests Lighthouse en CI configurés sur preset Moto G4 4G.

## 16. SLA performance

| Engagement | Mesure |
|---|---|
| 90 % des sessions LCP < 2.5 s | mensuel |
| 90 % des sessions CLS < 0.1 | mensuel |
| Disponibilité 99.9 % | mensuel |
| TTFB Edge < 200 ms (Europe/Maghreb) | mensuel |

Manqué deux mois consécutifs → revue d'architecture obligatoire.

## 17. Anti-patterns performance

- ❌ `priority` sur plus d'une image par page
- ❌ Polices non self-hosted (Google Fonts blocking)
- ❌ JS bloquant en `<head>` sans `defer` ou `async`
- ❌ `useEffect` qui fetch sans `Suspense` boundary
- ❌ Images sans dimensions (CLS garanti)
- ❌ `dangerouslySetInnerHTML` sur contenu lourd au lieu de RSC
- ❌ Polyfills servis aux navigateurs modernes (utiliser `browserslist`)
- ❌ `next/script` sans `strategy`

## 18. Checklist performance avant release

- [ ] Lighthouse mobile ≥ 95 sur les 9 pages principales
- [ ] Bundle JS first-load ≤ 90 kB gzipped
- [ ] Toutes les images en AVIF / WebP
- [ ] Toutes les polices self-hosted
- [ ] CLS < 0.05 sur toutes les pages
- [ ] LCP < 2.0 s sur toutes les pages (Slow 4G)
- [ ] Aucun script tiers bloquant
- [ ] CI pass : `bundle-budget`, `lighthouse-ci`
- [ ] Speed Insights actif en production
- [ ] Cache headers vérifiés via `curl -I`

> *Document suivant : [11 — SEO & métadonnées](./11-seo-metadata.md)*
