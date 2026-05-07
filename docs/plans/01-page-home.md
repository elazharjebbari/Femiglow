# Plan 01 — Page d'accueil (`/`)

> Plan d'exécution détaillé pour porter la page d'accueil au niveau « cabinet
> international ». Croise tous les documents du dossier de préparation et la
> stratégie d'itération. À lire de bout en bout avant de toucher au code.

**Page cible** : `apps/web/src/app/(marketing)/page.tsx`
**Spec source** : [§ 4.1 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 18 à 26 heures de travail concentré (2 à 4 jours).

---

## 1. Objectif

La page d'accueil est le **point d'entrée TOFU**. Elle doit, dans l'ordre :

1. Établir la posture éditoriale en moins de deux secondes : maison de
   Casablanca, beauté lente, rituel saisonnier.
2. Offrir un **dual path funnel** clair : CTA primaire `/rituel` (lecture
   éditoriale) et CTA secondaire scroll vers `#manifeste` ou `/kit`.
3. Donner trois preuves discrètes (gestes, manifeste, avis) sans rien vendre.
4. Inviter à revenir : journal et newsletter en clôture.

KPIs cibles ([§ 4.1](../preparation/04-specifications-pages.md)) :

| KPI                        | Cible    |
| -------------------------- | -------- |
| Bounce rate                | < 55 %   |
| Scroll ≥ 50 %              | > 60 %   |
| CTR CTA primaire           | > 12 %   |
| Taux d'inscription newsletter | > 3 % |
| LCP                        | < 2.0 s  |
| CLS                        | < 0.05   |
| INP                        | < 150 ms |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                                | Pourquoi                                                          |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [00 — Résumé exécutif](../preparation/00-executive-summary.md)                                           | Recadrer l'intention                                              |
| 2   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                                     | Vérifier que chaque mot de la page tient la voix                  |
| 3   | [02 — Design system](../preparation/02-design-system.md)                                                 | Tokens couleurs, typographies, espacements                        |
| 4   | [04 — Spécifications de pages, § 4.1](../preparation/04-specifications-pages.md)                         | Source canonique de la page Home                                  |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                          | Inventaire des composants à utiliser ou créer                     |
| 6   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md)               | Reveal au scroll, micro-rebonds CTA, séquence hero                |
| 7   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                           | Hiérarchie h1, contraste, skip-link, focus visible                |
| 8   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                             | Image LCP, polices, tree-shaking framer-motion                    |
| 9   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                              | JSON-LD Organization, OpenGraph                                   |
| 10  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                              | Vocabulaire autorisé, mots interdits, microcopy                   |
| 11  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5                       | Cycle, DoD composant, DoD page                                    |

**Temps de relecture** : 90 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (sont-ils tous dans `tokens.css` ?)

À vérifier dans [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css)
contre [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge`, `--sauge-soft`, `--sauge-dark`, `--creme`, `--encre`,
  `--petale`, `--ciel`, `--champagne`.
- Typographies : `--font-display` (Cormorant Garamond), `--font-body` (Inter),
  `--font-script` (Pinyon Script).
- Tailles : `display-xl` (96 pt pour le hero), `display-lg`, `display-md`,
  `lead`, `body`, `caption`.
- Espacements : `--space-1` à `--space-20`.
- Motion : `--duration-fast` (120 ms), `--duration-base` (240 ms),
  `--duration-slow` (480 ms), `--ease-out-soft`, `--ease-in-out-slow`.
- Z-index : `--z-sticky`, `--z-overlay`, `--z-modal`.
- Media queries : `prefers-reduced-motion`, `prefers-contrast: more`.

### 3.2 Primitifs UI (à polir avant la page)

Dans `apps/web/src/components/ui/` :

| Composant   | État actuel | À polir avant Home                                    |
| ----------- | ----------- | ----------------------------------------------------- |
| `Button`    | Scaffold    | Variants primary/secondary/ghost/link, focus, loading |
| `Container` | Scaffold    | 4 widths : prose, content, wide, page                 |
| `Heading`   | Scaffold    | Tailles display-xl à sm, tone default/soft/on-dark    |
| `Text`      | Scaffold    | lead, body, small, caption ; tone ; `prose` toggle    |
| `Kicker`    | Scaffold    | Uppercase, tracking 0.18em, taille caption            |
| `Logo`      | Scaffold    | Wordmark Pinyon Script, `asLink`, `aria-label` propre |
| `Image`     | Patché      | Vérifier `priority`, `sizes`, `placeholder=blur`      |
| `Stack`     | Scaffold    | Gap 1-20, align start/center/end/stretch              |

### 3.3 Layout (à polir avant la page)

Dans `apps/web/src/components/layout/` :

| Composant     | À polir avant Home                                                           |
| ------------- | ---------------------------------------------------------------------------- |
| `Header`      | Sticky avec blur, état scrollé (ombre subtile), menu mobile (à créer)        |
| `Footer`      | 4 colonnes desktop, 1 colonne mobile, NewsletterForm inline (à créer)        |
| `SkipLink`    | Cible `#main`, focus-visible encre sur crème, position top-4 left-4          |

### 3.4 Sections de la page (à créer ou polir)

| #   | Section                | Fichier                          | État        |
| --- | ---------------------- | -------------------------------- | ----------- |
| 1   | Hero éditorial         | `sections/Hero.tsx`              | Scaffold    |
| 2   | Les gestes             | `sections/GestesGrid.tsx`        | Scaffold    |
| 3   | Manifeste              | `sections/Manifeste.tsx`         | Scaffold    |
| 4   | Avis d'initiées        | `sections/AvisStrip.tsx`         | Scaffold    |
| 5   | Journal · extraits     | **`sections/JournalExtraits.tsx`** | **À créer** |
| 6   | Newsletter             | **`sections/NewsletterBlock.tsx`** | **À créer** |

### 3.5 Composants spécifiques à créer

| Composant            | Pourquoi                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| `Fleuron`            | Ornement SVG inter-section ([§ 4.1](../preparation/04-specifications-pages.md)) |
| `Reveal`             | Animation d'apparition au scroll ([§ 8](../preparation/08-ux-animations-interactions.md)) |
| `NewsletterForm`     | Formulaire email + consent, POST `/api/newsletter`                      |
| `TestimonialCard`    | Photo mains + citation + signature « initiée depuis [date] »            |

### 3.6 Données

Récupérées via `cms.getHomepageContent()` qui retourne `HomepageContent`
([`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)).
Mock dans [`data/mock/homepage.ts`](../../apps/web/src/data/mock/homepage.ts).

---

## 4. Écarts entre la spec (§ 4.1) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec (§ 4.1)                                  | Scaffold actuel                              | Décision proposée                                                   |
| --- | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| E1  | 4 gestes                                      | 5 gestes (`length(5)` dans le schéma Zod)    | Garder **5** : c'est ce qui circule depuis le scaffold ; mettre à jour la spec § 4.1 |
| E2  | « Le journal · extraits » avec grille asymétrique 1 hero + 2 secondaires | `CrossLinks` 3 cartes égales                 | **Remplacer** `CrossLinks` sur Home par un nouveau `JournalExtraits` (asymétrique) |
| E3  | Newsletter en bandeau sauge pâle              | Absente de Home                              | **Créer** `NewsletterBlock` + `NewsletterForm`                      |
| E4  | Fleuron entre sections                        | Absent                                       | **Créer** `Fleuron` (SVG inline)                                    |
| E5  | Hero 92vh, Cormorant 96pt                     | Hero générique, taille à vérifier            | **Aligner** : taille `display-xl` (96pt), hauteur min 92vh desktop  |
| E6  | TestimonialCard avec photos mains             | `AvisStrip` sans photos                      | **Enrichir** : ajouter `handImage` optionnelle (déjà dans schéma)   |
| E7  | « Initiée depuis [date] » sur testimonial     | Pas dans le schéma                           | **Ajouter** champ `initieeDepuis` au `testimonialSchema`            |

Ces sept écarts représentent ~3 h de travail préparatoire. **À traiter avant
toute autre chose** (Phase 1 ci-dessous).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**. On ne saute pas, on ne
parallélise pas.

### Phase 0 — Baseline (30 min)

Avant de toucher à quoi que ce soit :

```bash
cd apps/web
pnpm dev
```

- [ ] Capture d'écran de la Home actuelle (mobile 375px et desktop 1440px).
- [ ] Lighthouse mobile : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : noter le nombre de violations critiques.
- [ ] `pnpm build` puis lire le bundle size de la route `/`.
- [ ] Sauvegarder les chiffres dans un commentaire de PR ou dans
      `docs/plans/01-page-home-baseline.md` (créé en cours de route).

### Phase 1 — Résolution des écarts spec / scaffold (2 h)

#### 1.1 Mettre à jour le schéma `testimonialSchema`
Fichier : [`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)

```ts
export const testimonialSchema = z.object({
  id: z.string(),
  authorFirstName: z.string(),
  authorContext: z.string().optional(),
  quote: z.string(),
  handImage: imageSchema.optional(),
  initieeDepuis: z.string().optional(), // ex: "Janvier 2025"
  rating: z.number().int().min(1).max(5).optional(),
});
```

#### 1.2 Mettre à jour `mockHomepage`
Fichier : [`data/mock/homepage.ts`](../../apps/web/src/data/mock/homepage.ts)

- Ajouter `initieeDepuis` à chaque testimonial (« Janvier 2025 »,
  « Mars 2024 », « Octobre 2023 »).
- Ajouter `handImage` pointant vers de futurs SVG (à créer Phase 7).

#### 1.3 Mettre à jour la spec § 4.1
Fichier : [`04-specifications-pages.md`](../preparation/04-specifications-pages.md)

- Remplacer « 4 cards » par « 5 cards » dans la section Hero.
- Aligner la liste des composants avec ce plan.

#### 1.4 Commit
```
git add -A
git commit -m "Aligne le sch\u00e9ma Home : 5 gestes, testimonial enrichi, spec mise \u00e0 jour"
```

> **Sortie de phase** : schéma + mocks + spec cohérents. Rien ne doit
> compiler à moitié.

### Phase 2 — Polissage des primitifs UI (4 h)

Suivre le cycle du § 3 de la stratégie d'itération pour chaque composant.

| Ordre | Composant   | Points d'attention spécifiques Home                              |
| ----- | ----------- | ---------------------------------------------------------------- |
| 1     | `Button`    | Variant primary (encre/crème) et link pour CTA secondaire scroll |
| 2     | `Container` | Variant `page` (max-width 1280, padding responsive)              |
| 3     | `Heading`   | Variant `display-xl` (Cormorant 96pt) pour le hero               |
| 4     | `Text`      | Variant `lead` (24pt) pour le tagline hero                       |
| 5     | `Kicker`    | Pour « Maison de Casablanca » au-dessus du h1                    |
| 6     | `Image`     | `priority` + `fetchPriority="high"` + `sizes` pour LCP hero      |

**DoD par composant** : cocher les 8 catégories de
[§ 4 stratégie](../preparation/15-strategie-iteration.md).

**Commits** : un par composant. Six commits, six unités.

### Phase 3 — Création des composants manquants (3 h)

#### 3.1 `Fleuron`
- Fichier : `apps/web/src/components/ui/Fleuron.tsx`
- SVG inline 24×24 ou 32×32, encre 40 % d'opacité.
- Prop `size?: 'sm' | 'md' | 'lg'`, `tone?: 'encre' | 'champagne'`.
- Aucun import externe. Pas de state, pas de client.

#### 3.2 `Reveal`
- Fichier : `apps/web/src/components/patterns/Reveal.tsx`
- Client Component avec `framer-motion` `LazyMotion` + `domAnimation`.
- Props : `children`, `delay?` (ms), `direction?: 'up' | 'right'`.
- `useReducedMotion()` → si motion réduit, render immédiat sans animation.
- IntersectionObserver via `whileInView`, `viewport={{ once: true, margin: '-10% 0px' }}`.
- Référence : [§ 8 — UX animations](../preparation/08-ux-animations-interactions.md).

#### 3.3 `NewsletterForm`
- Fichier : `apps/web/src/components/forms/NewsletterForm.tsx`
- Client Component, react-hook-form + zod.
- Schéma : `email` + `consent` (already défini dans [`schemas/contact.ts`](../../apps/web/src/lib/schemas/contact.ts) côté newsletter ; sinon créer `schemas/newsletter.ts`).
- POST `/api/newsletter` (route déjà créée).
- Props : `variant?: 'inline' | 'block'`, `source?: string` (ex: `home-bottom`).
- États : idle / submitting / success (« Bienvenue. Vous recevrez une lettre par saison. ») / error.
- Honneypot (champ `<input name="website" tabIndex={-1} aria-hidden="true">`).

#### 3.4 `TestimonialCard`
- Fichier : `apps/web/src/components/sections/TestimonialCard.tsx` (interne à AvisStrip).
- Props : `testimonial: Testimonial`.
- Layout : photo mains 1:1 (4:5 mobile) en haut, citation Cormorant Italic, signature « *Initiée depuis Janvier 2025* » en caption tertiary.

#### 3.5 `JournalExtraits` (section)
- Fichier : `apps/web/src/components/sections/JournalExtraits.tsx`
- Layout asymétrique 1 hero + 2 secondaires :
  - Mobile : pile verticale.
  - Tablet (≥ 720px) : 1 colonne hero + 2 colonnes mini.
  - Desktop (≥ 1024px) : 2 colonnes hero (60 %) + 1 colonne 2 mini empilées (40 %).
- Props : `articles: Article[]` (au moins 3).
- Récupération côté page via `cms.getArticles({ limit: 3, featured: true })`
  ou via les `journalExtraitsSlugs` de `HomepageContent`.

#### 3.6 `NewsletterBlock` (section)
- Fichier : `apps/web/src/components/sections/NewsletterBlock.tsx`
- Bandeau sauge soft pleine largeur, padding vertical large.
- Contient : Kicker « Lettre de la maison », Heading lg « Une lettre par saison. »,
  Text lead court, `NewsletterForm variant="inline"`.

**Commits** : un par composant. Six commits.

### Phase 4 — Polissage des sections existantes (3 h)

| Section          | Travail à faire                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Hero`           | Hauteur min 92vh desktop / 80vh mobile, vagues sauge + pétale en arrière-plan (SVG décoratif), Cormorant `display-xl` 96pt sur titre, Inter `lead` sur tagline, dual CTA primary + link, Image avec `priority` |
| `GestesGrid`     | Numérotation 01..05 padded, animation `Reveal` au scroll avec stagger 60 ms, hover discret (couleur kicker → encre) |
| `Manifeste`      | Bandeau `bg-sauge-soft`, Fleuron en tête, Cormorant Italic 28pt sur les paragraphes, max-width prose centrée    |
| `AvisStrip`      | 3 `TestimonialCard`, espacement large, séparation par Fleuron entre cartes desktop                                |

**Commits** : un par section. Quatre commits.

### Phase 5 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/page.tsx`](../../apps/web/src/app/(marketing)/page.tsx)

Ordre exact des sections :

```tsx
<Hero data={content.hero} priority />
<Fleuron />
<GestesGrid etapes={content.gestes} />
<Fleuron />
<Manifeste data={content.manifeste} />
<Fleuron />
<AvisStrip testimonials={content.avis} />
<Fleuron />
<JournalExtraits articles={journalArticles} />
<NewsletterBlock />
```

Récupération en parallèle dans le RSC :

```tsx
const [content, journalArticles] = await Promise.all([
  cms.getHomepageContent(),
  cms.getArticles({ limit: 3, featured: true }),
]);
```

**Commit** : « Assemble la page d'accueil ».

### Phase 6 — SEO, métadonnées, JSON-LD (1 h)

Référence : [§ 11 — SEO](../preparation/11-seo-metadata.md).

Dans `page.tsx` :

```tsx
export const metadata: Metadata = {
  title: 'Maison de soin pour les ongles — \u00e0 Casablanca',
  description: 'Trois gestes, cinq minutes, un rituel saisonnier. La maison FemiGlow, \u00e9dit\u00e9e \u00e0 Casablanca.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: 'FemiGlow — Maison de soin pour les ongles',
    description: 'Trois gestes, cinq minutes, un rituel saisonnier.',
    images: [{ url: '/og/home.svg', width: 1200, height: 630, alt: 'FemiGlow' }],
  },
};
```

JSON-LD `Organization` injecté via `<script type="application/ld+json">` dans
le composant `<JsonLd type="Organization" />` (à créer dans `lib/seo/json-ld.tsx`
si pas encore fait).

**Commit** : « SEO et JSON-LD pour la Home ».

### Phase 7 — Performance (2 h)

Référence : [§ 10 — Performance](../preparation/10-performance-web-vitals.md).

#### 7.1 Polices auto-hébergées
Migrer `next/font/google` → `next/font/local` pour Cormorant, Inter, Pinyon Script.
Télécharger les WOFF2, les déposer dans `apps/web/public/fonts/`.

#### 7.2 Image LCP
- `<Image priority fetchPriority="high" sizes="100vw" />` sur l'image du Hero.
- `placeholder="blur"` avec `blurDataURL` (générer via `plaiceholder` ou inline base64 16 px).
- Vérifier que l'image est servie en AVIF (DevTools → Network → Type).

#### 7.3 Tree-shaking framer-motion
S'assurer que tous les `motion.*` passent par `<LazyMotion features={domAnimation}>`
dans le composant `Reveal` (ou un provider racine si plus large).
Ne **pas** importer depuis `framer-motion` directement dans des RSC.

#### 7.4 Mesure
- `pnpm build` → lire le first-load JS.
- Cible : ≤ 90 kB gzip pour `/`. Si dépassé, lancer
  `pnpm build && ANALYZE=true pnpm build` (à configurer si pas déjà).
- Lighthouse mobile : LCP < 2.0 s, CLS < 0.05, INP < 150 ms.

**Commit** : « Optimise la Home : polices locales, image LCP, lazy framer-motion ».

### Phase 8 — Accessibilité (2 h)

Référence : [§ 9 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>`, dans le Hero.
- [ ] Hiérarchie h1 → h2 → h3 sans saut.
- [ ] Skip-link visible au focus.
- [ ] Tab order logique : Logo → Nav → CTA Hero primaire → CTA Hero secondaire →
      Gestes (5) → Avis → Articles → Newsletter → Footer.
- [ ] Focus visible sur tous les éléments interactifs (outline encre 2 px,
      offset 3 px).
- [ ] Tap targets ≥ 44 × 44 px.
- [ ] Contraste : encre/crème ≥ 13:1, micro-texte tertiary ≥ 7:1.
- [ ] Test axe-core : zéro violation critique.
- [ ] Test VoiceOver Mac : lecture cohérente (rôles, labels, état).
- [ ] Test clavier complet : Tab, Shift+Tab, Enter sur CTAs, ESC nulle part nécessaire.
- [ ] `prefers-reduced-motion: reduce` activé → animations Reveal désactivées,
      pas de transition opacity/transform.

**Commit** : « Audit accessibilit\u00e9 Home : 0 violation, navigation clavier propre ».

### Phase 9 — Tests (2 h)

Référence : [§ 12 — QA](../preparation/12-qa-debugging-observabilite.md).

#### 9.1 Vitest unitaires
Pour chaque composant créé/modifié, un test :

```ts
// Hero.test.tsx
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';
import { mockHomepage } from '@/data/mock/homepage';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend({ toHaveNoViolations });

describe('Hero', () => {
  it('rend le titre en h1', () => {
    render(<Hero data={mockHomepage.hero} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<Hero data={mockHomepage.hero} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

#### 9.2 Storybook stories
Une story par section + une story `Page > Home` qui assemble tout.

#### 9.3 Playwright golden path
```ts
// e2e/home.spec.ts
test('Home : golden path', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /d\u00e9couvrir le rituel/i }).click();
  await expect(page).toHaveURL('/rituel');
});
```

**Commit** : « Tests Home : unitaires, stories, E2E golden path ».

### Phase 10 — Copy et finitions (1 h)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets français.
- [ ] CTA primaire : « Découvrir le rituel ».
- [ ] CTA secondaire : « Voir le kit » (link variant).
- [ ] Microcopy newsletter : « Une lettre par saison. Aucun envoi commercial. »
- [ ] Tagline hero : pas plus de 14 mots, pas plus de 80 caractères.
- [ ] Test à voix haute : lit-on cela à un ami ? Sinon, simplifier.

**Commit** : « Polit la copy de la Home contre le glossaire \u00e9ditorial ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile ET desktop.
- [ ] Comparaison baseline vs après dans
      `docs/plans/01-page-home-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → tout vert.
- [ ] Capture vidéo du golden path (mobile 375 px puis desktop 1440 px) → archivée.
- [ ] PR vers `main` avec description référencée à ce plan et à la spec § 4.1.
- [ ] Merge.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` avec une ligne
      « Home : LCP 1.4 s, CLS 0.02, INP 90 ms, axe 0, copy validée ».

---

## 6. Definition of Done — spécifique Home

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] Hero LCP < 1.8 s sur 4G simulée (cible plus stricte que la moyenne).
- [ ] Le titre Cormorant 96pt s'affiche **sans CLS** au chargement (police
      pré-chargée via `<link rel="preload">` ou `next/font` correctement
      configuré).
- [ ] Le dual CTA est visible **above the fold** sur 375 × 667 (iPhone SE).
- [ ] Les 5 gestes sont compréhensibles sans avoir lu Rituel.
- [ ] Le manifeste passe le test du prononcé : lu à voix haute, il sonne juste.
- [ ] `JournalExtraits` reste élégant si seuls 3 articles existent (pas de cas
      « moins de 3 ») et n'explose pas si 4+ (slice côté composant).
- [ ] La newsletter envoie un succès idempotent (re-soumission → toujours OK,
      pas d'erreur 409).
- [ ] Aucun warning console en dev, en build, en prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/01-page-home-baseline.md` (créé en Phase 0) :

| Métrique                  | Baseline | Cible    | Après  |
| ------------------------- | -------- | -------- | ------ |
| LCP mobile                | _        | < 2.0 s  | _      |
| LCP desktop               | _        | < 1.5 s  | _      |
| CLS                       | _        | < 0.05   | _      |
| INP                       | _        | < 150 ms | _      |
| TBT                       | _        | < 200 ms | _      |
| First-load JS gzip        | _        | ≤ 90 kB  | _      |
| Violations axe critique   | _        | 0        | _      |
| Score Lighthouse Perf     | _        | ≥ 95     | _      |
| Score Lighthouse a11y     | _        | 100      | _      |
| Score Lighthouse Best Pr. | _        | ≥ 95     | _      |
| Score Lighthouse SEO      | _        | 100      | _      |

---

## 8. Risques et points d'attention

| Risque                                                          | Mitigation                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Cormorant 96pt provoque CLS si police chargée en retard         | `next/font/local` avec `display: 'swap'` + métriques fallback             |
| Vagues sauge/pétale en SVG inline alourdissent le HTML          | Externaliser en `.svg` dans `public/`, importer via `<Image>`             |
| Reveal au scroll cassée sur Safari iOS < 16                     | Test sur device réel ; fallback : pas d'animation si `IntersectionObserver` absent |
| 5 gestes sur mobile : scroll trop long                          | Layout 1 colonne avec gap réduit, ou 2 colonnes 320 px+                   |
| Newsletter inscription = consentement RGPD : checkbox obligatoire | Schéma Zod `z.literal(true)` côté front et serveur                      |
| Image hero pas encore définitive (SVG placeholder)              | Garder le placeholder ; la vraie image arrivera sans changement de code   |
| Sanity (Phase 2) renverra des données plus riches               | Pages restent stables : adapter via `cms`, pas via composants             |

---

## 9. Estimation horaire récapitulative

| Phase                          | Estimation |
| ------------------------------ | ---------- |
| 0 — Baseline                   | 0 h 30     |
| 1 — Résolution écarts          | 2 h        |
| 2 — Polissage primitifs        | 4 h        |
| 3 — Composants manquants       | 3 h        |
| 4 — Polissage sections         | 3 h        |
| 5 — Assemblage page            | 1 h        |
| 6 — SEO + JSON-LD              | 1 h        |
| 7 — Performance                | 2 h        |
| 8 — Accessibilité              | 2 h        |
| 9 — Tests                      | 2 h        |
| 10 — Copy & finitions          | 1 h        |
| 11 — Mesure & merge            | 0 h 30     |
| **Total**                      | **22 h**   |

Avec interruptions et apprentissage outils (Storybook, Playwright si pas
encore familier) : **26 h ou 4 jours pleins**.

---

## 10. Annexes — commandes utiles

### Lancer le dev
```bash
cd apps/web
pnpm dev
```

### Lighthouse en CLI (à installer une fois : `npm i -g @lhci/cli`)
```bash
npx lighthouse http://localhost:3000 --view --preset=desktop --output=html --output-path=./lighthouse-home-desktop.html
npx lighthouse http://localhost:3000 --view --output=html --output-path=./lighthouse-home-mobile.html
```

### Bundle analyzer
```bash
ANALYZE=true pnpm --filter @femiglow/web build
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000
```

### Tests
```bash
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web test:e2e
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *La Home tient debout si, en l'envoyant à un journaliste de la presse
> beauté ou à un partenaire CMI, vous n'avez **rien à excuser**. Pas de
> « c'est une démo », pas de « les images ne sont pas finales », pas de
> « la newsletter sera branchée plus tard ». Si vous devez excuser, la
> page n'est pas finie.*

À cocher **avant** d'attaquer la page suivante.

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Page** : [`apps/web/src/app/(marketing)/page.tsx`](../../apps/web/src/app/(marketing)/page.tsx) (Server Component, 63 lignes).
- **Sections rendues** (verticales) : `Hero` (image priority, candidate LCP) →
  `Fleuron` → `GestesGrid` → `Fleuron` → `Manifeste` → `Fleuron` →
  `AvisStrip` → `Fleuron` → `JournalExtraits` → `NewsletterBlock`.
- **SEO / JSON-LD** : `organizationSchema()` + `websiteSchema()` injectés
  via `<JsonLd>` SSR.
- **Tests** : 6 fichiers Vitest dédiés sections (Hero, GestesGrid,
  Manifeste, AvisStrip, JournalExtraits, NewsletterForm) — ~33 cas, axe 0.

### Décisions notables

| Code | Décision | Justification |
| ---- | -------- | ------------- |
| **D1** | Hero `<Image priority>` + dimensions fixes | Cible LCP < 2 s : éviter CLS et lazy-load du visuel pliure |
| **D2** | Newsletter via `NewsletterBlock` Client + route `/api/newsletter` | Consentement RGPD côté front (`z.literal(true)`), POST validé Zod côté serveur |
| **D3** | Chaque section séparée par `Fleuron` plutôt que par filets CSS | Tient la voix éditoriale (motif maison) sans alourdir le DOM |

### Métriques (baseline → après)

| Métrique | Baseline | Cible | Après |
| -------- | -------- | ----- | ----- |
| First Load JS | 99.2 kB | ≤ 90 kB | **160 kB** (au-dessus cible — Hero + carrousel avis + form newsletter) |
| Violations axe | 0 | 0 | **0** |
| CLS | 0 | < 0.05 | **0** |
| Score Lighthouse a11y | 100 | 100 | **100** |
| Score Lighthouse Perf desktop (dev) | 62 | ≥ 95 | 71 (mode dev — non représentatif) |
| Tests Vitest sections | 0 | ≥ 5 | **6 fichiers / ~33 cas** |
| TypeScript / ESLint | 0 / 0 | 0 / 0 | **0 / 0** |

### Limites

- **First Load JS au-dessus de la cible** (160 kB vs 90 kB) : assumé, dû
  aux composants Client `AvisStrip` (carrousel) et `NewsletterBlock` (RHF
  + Zod). Lighthouse Perf à mesurer en `next start` plutôt qu'en `next dev`
  pour une lecture exacte.
- **LCP mesuré en mode dev uniquement** : les 17.7 s mobile / 0.72 s
  desktop ne reflètent pas la prod. Re-mesure prod recommandée avant la
  mise en ligne.
- **Pas de Sanity/CMS** : `data.hero`, `data.gestes`, `data.manifeste`,
  `data.avis` viennent de fixtures locales. À brancher Phase 2.
- **Pas de Storybook ni de Playwright e2e** : couverture interaction via
  Vitest + jest-axe uniquement.

### Suivi

- Mesurer Lighthouse Perf en build prod et viser ≥ 95.
- Profiler le bundle (`ANALYZE=true`) — candidats à split : carrousel
  `AvisStrip`, form `NewsletterBlock` (lazy via `next/dynamic`).
- Brancher Sanity sur les sections éditoriales (Hero, Manifeste, Avis,
  Journal) Phase 2.
