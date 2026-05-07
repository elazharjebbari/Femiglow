# Baseline — Page d'accueil (`/`)

> Mesures avant exécution du [plan 01](./01-page-home.md). Chaque phase met à
> jour la colonne « Après ». La cible reste figée.

**Date de la mesure** : 2026-05-02
**Environnement** : Next.js 14.2.15 dev server (`pnpm dev`), Node 22.22.2,
pnpm 10.33.2, Chrome 147 headless, viewport mobile 375×812 et desktop 1440×900.
**Mode** : Lighthouse contre le **dev server** (les chiffres prod attendus
sont meilleurs ; la production sera mesurée en Phase 11).

---

## 1. Inventaire structurel observé

Récupéré via `preview_eval` sur la Home.

| Marqueur                                 | Constat                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `<html lang>`                            | `fr` ✓                                                   |
| `<h1>` unique                            | « Le rituel ongles, en cinq minutes. » ✓                 |
| Hiérarchie                               | 1 h1 / 2 h2 / 8 h3                                       |
| `<main>`                                 | présent ✓                                                |
| Skip-link `a[href="#main"]`              | présent ✓                                                |
| `<nav>` total                            | 4 (header desktop + mobile + footer + breadcrumb stub)   |
| Sections                                 | 5 (Hero, Gestes, Manifeste, Avis, CrossLinks)            |
| Images `<img>` rendues côté client       | 1 seule (thumbnail article 120×150)                      |
| `<meta name="description">`              | présent ✓                                                |
| `<link rel="canonical">`                 | `localhost:3000/` (ENV `NEXT_PUBLIC_SITE_URL`)           |
| OpenGraph                                | 5 propriétés (title, description, site_name, locale, type) |
| `<script type="application/ld+json">`    | **0** — manque JSON-LD `Organization` (Phase 6)          |
| Hauteur body desktop 1440 px             | 3 020 px (≈ 3.4 écrans)                                  |

**Constat visuel mobile (375 px)** : Hero correct, kicker + h1 + tagline +
dual CTA (« Découvrir le rituel » primaire / « Voir le kit » link), suivi
d'un visuel SVG sauge avec rond pétale. Pas de fleuron entre sections.

**Constat visuel desktop (1440 px)** : **le Hero reste mono-colonne** et le
titre déborde à droite — la mise en page « texte gauche / image droite » de
la spec § 4.1 n'est pas implémentée. **À corriger en Phase 4** (polissage
Hero).

---

## 2. Lighthouse mobile (Moto G Power simulé, throttling)

| Catégorie         | Score |
| ----------------- | ----: |
| Performance       |  41   |
| Accessibility     | 100   |
| Best Practices    |  96   |
| SEO               |  69   |

Métriques :

| Métrique                  | Valeur     | Cible        |
| ------------------------- | ---------- | ------------ |
| First Contentful Paint    | 0.9 s      | < 1.8 s      |
| Speed Index               | 5.5 s      | < 3.4 s      |
| Largest Contentful Paint  | **13.7 s** | < 2.0 s      |
| Total Blocking Time       | 3 580 ms   | < 200 ms     |
| Time to Interactive       | 13.7 s     | < 3.8 s      |
| Cumulative Layout Shift   | 0          | < 0.05       |
| Interaction to Next Paint | non mesuré | < 150 ms     |
| Total byte weight         | 1 846 KiB  | < 1 000 KiB  |
| Unused JavaScript         | 176 KiB    | minimiser    |

> ⚠️ **Le LCP de 13.7 s est artificiel** : Lighthouse mesure ici le dev
> server qui ne minifie ni ne compile à l'avance. Le bundle prod a un
> First Load JS de 99.2 kB sur `/`. La mesure prod arrivera en Phase 11.

SEO 69 : pénalité attendue car `robots.ts` renvoie `Disallow: /` quand
`NODE_ENV !== 'production'`. Sera corrigé automatiquement en build prod.

---

## 3. Lighthouse desktop (preset desktop, pas de throttling)

| Catégorie         | Score |
| ----------------- | ----: |
| Performance       |  62   |
| Accessibility     | 100   |
| Best Practices    |  96   |
| SEO               |  69   |

Métriques :

| Métrique                  | Valeur  | Cible      |
| ------------------------- | ------- | ---------- |
| First Contentful Paint    | 0.3 s   | < 1.0 s    |
| Speed Index               | 0.8 s   | < 1.5 s    |
| Largest Contentful Paint  | 2.6 s   | < 1.5 s    |
| Total Blocking Time       | 640 ms  | < 100 ms   |
| Time to Interactive       | 2.6 s   | < 2.0 s    |
| Cumulative Layout Shift   | 0       | < 0.05     |

---

## 4. Accessibilité — axe-core 4.11.4 (en page)

| Indicateur                  | Résultat |
| --------------------------- | -------: |
| Violations                  | **0**    |
| Incomplete                  | 0        |
| Règles passées              | 35       |

axe ne signale aucune violation. La cible WCAG 2.2 AA est déjà tenue côté
page d'accueil. À surveiller au fur et à mesure que de nouveaux composants
arrivent (NewsletterForm, Reveal, Fleuron…).

---

## 5. Bundle prod (`pnpm build`)

| Route                      | Page size | First Load JS |
| -------------------------- | --------: | ------------: |
| `/`                        |    193 B  |     99.2 kB   |
| `/_not-found`              |    138 B  |     87.3 kB   |
| `/journal`                 |    193 B  |     99.2 kB   |
| `/journal/[slug]`          |    295 B  |     92.5 kB   |
| `/kit`                     |    295 B  |     92.5 kB   |
| `/maison`                  |    193 B  |     99.2 kB   |
| `/rituel`                  |    193 B  |     99.2 kB   |
| `/contact`                 |  3.95 kB  |    114   kB   |
| `/panier`                  |  2.86 kB  |     98.2 kB   |
| `/commander`               |  5.85 kB  |    117   kB   |
| `/merci`                   |    178 B  |     94.1 kB   |
| Shared chunks total        |       —   |     87.1 kB   |

Cible Home : First Load JS ≤ 90 kB. **Écart de 9.2 kB à résorber en Phase 7**
(tree-shaking framer-motion, polices locales).

---

## 6. Tableau de suivi

À mettre à jour à chaque phase (au minimum après les Phases 7, 8 et 11).

| Métrique                       |    Baseline | Cible         | Après P11 (dev) |
| ------------------------------ | ----------: | ------------- | --------------: |
| LCP mobile (dev)               |     13.7 s  | n/a           |        17.7 s   |
| LCP desktop (dev)              |      2.6 s  | n/a           |         0.72 s  |
| LCP mobile (prod)              |       —     | < 2.0 s       |       à mesurer |
| LCP desktop (prod)             |       —     | < 1.5 s       |       à mesurer |
| CLS                            |          0  | < 0.05        |              0  |
| TBT mobile (dev)               |   3 580 ms  | < 200 ms      |        5 558 ms |
| First-load JS gzip Home        |    99.2 kB  | ≤ 90 kB       |          152 kB |
| Violations axe critique        |          0  | 0             |              0  |
| Score Lighthouse Perf mobile   |         41  | ≥ 95          |             42  |
| Score Lighthouse Perf desktop  |         62  | ≥ 95          |             71  |
| Score Lighthouse a11y          |        100  | 100           |            100  |
| Score Lighthouse SEO mobile    |         69  | 100           |             92  |
| Score Lighthouse Best Pr.      |         96  | ≥ 95          |             96  |

---

## 7. Décisions prises pour la Phase 1

1. **Hero non-responsive en desktop** confirmé : layout 2 colonnes à
   construire en Phase 4.
2. **JSON-LD absent** : à ajouter en Phase 6.
3. **3 erreurs TypeScript dans `mockArticles`** corrigées avant la mesure
   (champ `noIndex` manquant, `isFeatured` manquant). Commit séparé.
4. **2 erreurs ESLint `no-console`** corrigées (`console.info` → `console.warn`
   dans les routes API contact et newsletter). Commit séparé.

Ces corrections font partie de la **mise en condition** de la baseline et
n'ont pas modifié la copy ni la structure.

---

## 8. Artefacts persistés

- [`baselines/01-home-mobile.json`](./baselines/01-home-mobile.json) — rapport Lighthouse mobile baseline.
- [`baselines/01-home-desktop.json`](./baselines/01-home-desktop.json) — rapport Lighthouse desktop baseline.
- [`baselines/01-home-mobile-after.json`](./baselines/01-home-mobile-after.json) — rapport Lighthouse mobile après Phase 11 (dev).
- [`baselines/01-home-desktop-after.json`](./baselines/01-home-desktop-after.json) — rapport Lighthouse desktop après Phase 11 (dev).

Les screenshots ne sont pas archivés sur disque (capturés via le preview
intégré et conservés dans le journal de session).

---

## 9. Lecture rapide

- **Bonne nouvelle** : a11y 100 et CLS 0 dès la baseline.
- **Mauvaise nouvelle** : LCP catastrophique en dev — sans valeur jusqu'à
  mesure prod, mais **révèle un TBT élevé (3.6 s mobile)** qu'il faudra
  surveiller à la Phase 7.
- **À corriger structurellement** : Hero desktop mono-colonne, JSON-LD
  absent, bundle 9 kB au-dessus de la cible.

> *La baseline n'est pas un constat d'échec. C'est la photographie nette
> de l'instant zéro. Tout ce qui sera ajouté l'améliorera ou ne sera pas
> ajouté.*

---

## 10. Bilan post Phase 11

Ce qui a été livré en 11 phases sur la Home :

- **Hero 2 colonnes desktop** + min-h 92vh + décor SVG vagues sauge / pétale champagne.
- **5 composants nouveaux** (Fleuron, Reveal avec LazyMotion, NewsletterForm,
  TestimonialCard, JournalExtraits, NewsletterBlock).
- **4 sections refondues** (Hero, GestesGrid avec animations Reveal stagger,
  Manifeste avec Fleuron, AvisStrip avec photos mains).
- **SEO complet** : metadata Open Graph + Twitter, OG image SVG, JSON-LD
  `Organization` + `WebSite`.
- **Tokens couleurs corrigés** pour atteindre WCAG AA (champagne-dark,
  sauge-dark, ciel-dark, petale-dark assombris).
- **Tests Vitest + jest-axe** : 18/18 passants couvrant Hero, GestesGrid,
  Manifeste, AvisStrip, JournalExtraits, NewsletterForm.
- **0 violation axe** sur la Home en navigateur.

Trade-offs :

- **Bundle Home = 152 kB** (cible 90 kB). Coût de framer-motion + zod +
  react-hook-form sur la même page. Acceptable pour une itération éditoriale ;
  les optimisations futures passent par : (a) suppression de Reveal au profit
  d'animations CSS pures, (b) déplacement de NewsletterBlock en route séparée,
  ou (c) lazy-load de framer-motion via dynamic.
- **Polices toujours via `next/font/google`** (pas migrées vers
  `next/font/local`). Auto-hébergement déjà actif au build.
- **LCP mobile mesuré sur dev server** uniquement. La mesure prod arrivera
  une fois `pnpm build` puis Lighthouse contre `pnpm start`.

Vérifications terminales :

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm test` → 18/18 ✓
- axe en page → 0 violation ✓
