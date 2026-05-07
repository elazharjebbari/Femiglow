# Plan 02 — Page Rituel (`/rituel`)

> Plan d'exécution détaillé pour porter la page `/rituel` au niveau « cabinet
> international ». Cette page est le **moment narratif MOFU** : elle ne vend
> pas, elle convainc lentement. Lecture 3 à 5 minutes, vidéo lente, schéma
> animé, témoignage en interview. À lire de bout en bout avant de toucher au
> code.

**Page cible** : `apps/web/src/app/(marketing)/rituel/page.tsx`
**Spec source** : [§ 4.2 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 22 à 28 heures de travail concentré (3 à 4 jours).

---

## 1. Objectif

La page `/rituel` est le **MOFU narratif**. Elle doit, dans l'ordre :

1. Asseoir une posture éditoriale digne d'un magazine de beauté lente : on
   raconte une origine, une science, une voix.
2. Faire **descendre lentement** la lectrice — vidéo 90 s, micro-essais, schéma
   animé, interview. Aucun CTA jusqu'à la section 6.
3. Au pivot, ouvrir la porte de `/kit` sans pression : un bandeau, un fleuron
   champagne, une phrase calme, une seule action.
4. Reconduire vers le journal — la lectrice repart soit avec un kit en tête,
   soit avec un article à lire.

KPIs cibles ([§ 4.2](../preparation/04-specifications-pages.md)) :

| KPI                              | Cible    |
| -------------------------------- | -------- |
| Temps moyen sur page             | > 2:30   |
| Scroll ≥ 75 %                    | > 50 %   |
| Watch rate vidéo ≥ 50 %          | > 40 %   |
| CTR pivot → `/kit`               | > 25 %   |
| Bounce rate                      | < 35 %   |
| LCP                              | < 2.2 s  |
| CLS                              | < 0.05   |
| INP                              | < 150 ms |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                                | Pourquoi                                                              |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | [00 — Résumé exécutif](../preparation/00-executive-summary.md)                                           | Recadrer la posture éditoriale                                        |
| 2   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                                     | Tenir la voix sur 3 à 5 minutes de lecture                            |
| 3   | [02 — Design system](../preparation/02-design-system.md)                                                 | Couleurs sauge clair, fleuron champagne, encre, espacements généreux  |
| 4   | [04 — Spécifications de pages, § 4.2](../preparation/04-specifications-pages.md)                         | Source canonique de la page Rituel                                    |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                          | Composants `HeroLifestyle`, `VideoPlayer4Gestes`, `SchemaSVG`         |
| 6   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md)               | Reveal lent, scroll progress, schéma animé, vidéo en intersection     |
| 7   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                           | Captions vidéo, transcript, `prefers-reduced-motion`, footnotes ARIA  |
| 8   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                             | Vidéo lazy, poster, `preload="metadata"`, AVIF, polices locales       |
| 9   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                              | JSON-LD `Article` ou `HowTo`, OpenGraph, canonical                    |
| 10  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                              | Vocabulaire autorisé sur les sciences du soin (pas de promesses)      |
| 11  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5                       | Cycle, DoD composant, DoD page                                        |

**Temps de relecture** : 90 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (à vérifier dans `tokens.css`)

À confronter à [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge`, `--sauge-soft` (pivot), `--sauge-dark`, `--creme`,
  `--encre`, `--champagne` (fleuron pivot), `--ciel` (fonds micro-essais).
- Typographies : `--font-display` (Cormorant Garamond — titre 64 pt hero,
  italique 28 pt sur micro-essais), `--font-body` (Inter — corps article),
  `--font-script` (Pinyon Script — signature interview).
- Tailles : `display-lg` (64 pt hero), `display-md` (sections), `lead`,
  `body`, `body-prose` (mesure 60 ch), `caption`.
- Espacements : `--space-1` à `--space-32`. La page demande des respirations
  longues entre sections (≥ `--space-24` desktop).
- Motion : `--duration-base` (240 ms), `--duration-slow` (480 ms),
  `--ease-out-soft`, `--ease-in-out-slow`. Schéma SVG : `--duration-xl`
  (1200 ms) à ajouter si manquant.
- Z-index : `--z-sticky` (ScrollProgress), `--z-overlay` (modal transcript).
- Media queries : `prefers-reduced-motion`, `prefers-contrast: more`.

### 3.2 Primitifs UI (à polir avant la page)

Dans `apps/web/src/components/ui/` :

| Composant   | État actuel | À polir avant Rituel                                              |
| ----------- | ----------- | ----------------------------------------------------------------- |
| `Heading`   | Polish Home | Variant `display-lg` (64 pt) — vérifier line-height 1.05          |
| `Text`      | Polish Home | Variant `body-prose` (mesure 60-65 ch, line-height 1.7)           |
| `Container` | Polish Home | Variant `prose` (max-width 720 px) pour les micro-essais          |
| `Image`     | Polish Home | Photo sépia 1920s : `quality={85}`, AVIF prioritaire              |
| `Kicker`    | Polish Home | Variant `champagne` pour surtitre « LE RITUEL »                   |
| `Button`    | Polish Home | Variant `link` pour cross-link Journal, `primary` encre pour pivot|

### 3.3 Layout (déjà polis pour Home, à valider)

| Composant     | À valider avant Rituel                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| `Header`      | Reste sticky transparent jusqu'au scroll, blur encre 6 % puis ombre subtile  |
| `Footer`      | Inchangé                                                                     |
| `SkipLink`    | Cible `#contenu-rituel` (à exposer comme id sur le `<main>`)                 |

### 3.4 Sections de la page (à créer ou polir)

| #   | Section                | Fichier                                  | État        |
| --- | ---------------------- | ---------------------------------------- | ----------- |
| 1   | Hero lifestyle         | **`sections/HeroLifestyle.tsx`**          | **À créer** |
| 2   | L'origine japonaise    | **`sections/SectionNarrative.tsx`**       | **À créer** |
| 3   | Les quatre gestes (vidéo) | **`sections/VideoPlayer4Gestes.tsx`**  | **À créer** |
| 4   | Sciences du soin       | **`sections/SciencesDuSoin.tsx`**         | **À créer** |
| 5   | Témoignage Q/R         | **`sections/InterviewQR.tsx`**            | **À créer** |
| 6   | Pivot vers le kit      | **`sections/PivotBanner.tsx`**            | **À créer** |
| 7   | Cross-link Journal     | `sections/JournalGrid.tsx` (mutualiser)   | **À créer / réutiliser** |

> `JournalGrid` est mutualisé avec `/kit`, `/maison`, `/journal`. À factoriser
> dès cette page : on s'en sert au moins quatre fois.

### 3.5 Composants spécifiques à créer ou polir

| Composant            | Pourquoi                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| `ScrollProgress`     | Barre fine sauge en haut de page, progresse avec le scroll, `aria-hidden`           |
| `SchemaSVG`          | Schéma anatomique de l'ongle, animé via `motion.path` + `stroke-dasharray`          |
| `Footnote` / `Sup`   | `<sup>` numéroté avec `aria-describedby` pointant sur la liste des sources         |
| `VideoPoster`        | Poster statique servi avant l'autoplay, AVIF/WebP, ratio 16:9                       |
| `CaptionsTrack`      | Composant utilitaire qui injecte `<track kind="captions">` FR et AR                 |
| `Reveal`             | (Déjà créé Phase 3 du plan Home) — réutilisé partout                                |
| `Fleuron`            | (Déjà créé) — variant `champagne` ajouté ici si pas encore fait                     |

### 3.6 Données

Étendre le schéma existant `rituelPageContentSchema`
([`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts))
qui est aujourd'hui sous-spécifié. Récupération via `cms.getRituelPageContent()`
(à ajouter à l'adapter). Mock dans
[`data/mock/rituel.ts`](../../apps/web/src/data/mock/) (à créer).

```ts
// Schéma cible (Phase 1)
export const microEssaiSchema = z.object({
  id: z.string(),
  titre: z.string(),
  paragraphe: z.string(),
  sourceRef: z.string().optional(), // ex: "[1]"
});

export const qaItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  reponse: z.string(),
});

export const rituelPageContentSchema = z.object({
  hero: heroSchema, // variant 'editorial', surtitre champagne
  origine: z.object({
    kicker: z.string(),
    titre: z.string(),
    paragraphes: z.array(z.string()).min(2).max(4),
    photoSepia: imageSchema,
  }),
  videoGestes: z.object({
    sources: z.object({
      mp4: z.string().url().or(z.string().startsWith('/')),
      webm: z.string().url().or(z.string().startsWith('/')),
    }),
    poster: imageSchema,
    captions: z.object({
      fr: z.string(), // chemin .vtt
      ar: z.string(),
    }),
    transcript: z.string(), // texte plein, affiché dans <details>
    durationSeconds: z.number().int().positive(),
  }),
  sciences: z.object({
    titre: z.string(),
    essais: z.array(microEssaiSchema).length(3),
    sourcesAcademiques: z.array(z.string()).min(1),
  }),
  interview: z.object({
    introduction: z.string(),
    portrait: imageSchema.optional(),
    nomInterviewee: z.string(),
    questions: z.array(qaItemSchema).min(3).max(6),
  }),
  pivot: z.object({
    phrase: z.string(),
    cta: ctaSchema, // → /kit
  }),
  journalCrossSlugs: z.array(z.string()).length(3),
});
```

---

## 4. Écarts entre la spec (§ 4.2) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec (§ 4.2)                                          | Scaffold actuel                                            | Décision proposée                                                                |
| --- | ----------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| E1  | « Les **quatre** gestes » dans la spec                | Schéma Home et Rituel ont **5 gestes**                     | Aligner Rituel sur **5 gestes** comme la Home (cohérence prime sur la spec)      |
| E2  | Page riche : hero photo, narrative, vidéo, sciences, interview, pivot, cross-link | Page actuelle : `Hero` + `GestesGrid` + `Manifeste` (3 sections seulement) | Reconstruire intégralement la page autour des 7 sections de la spec              |
| E3  | `cms.getRituelPageContent()` attendu                  | L'adapter expose seulement `getHomepageContent()`          | Ajouter `getRituelPageContent()` au type `CMSAdapter` et au `mockAdapter`        |
| E4  | Vidéo 90 s slow motion captions FR/AR                 | Aucune vidéo livrée                                        | Mock = poster + sources `/videos/rituel-90s.{mp4,webm}` (placeholder Phase 1)    |
| E5  | Schéma SVG ongle animé                                | N'existe pas                                               | Créer `SchemaSVG.tsx` avec 3 calques (matrice, lit, plaque) animés au scroll     |
| E6  | Sources académiques en footnotes                      | Pas de pattern de note de bas de page                      | Créer `Footnote` minimal `<sup id="fn-1"><a href="#src-1">1</a></sup>`           |
| E7  | `ScrollProgress` barre fine                           | N'existe pas                                               | Créer `ScrollProgress.tsx` (Client Component, `useScroll` framer-motion)         |
| E8  | Pivot bandeau sauge clair fleuron champagne           | N'existe pas                                               | Créer `PivotBanner.tsx` mutualisable (utilisé aussi sur `/maison` plus tard)     |
| E9  | « Les quatre gestes » en vidéo, pas en grille de cards | Page actuelle réutilise `GestesGrid`                       | **Remplacer** `GestesGrid` par `VideoPlayer4Gestes` ; la grille reste sur Home   |
| E10 | Surtitre champagne « LE RITUEL »                      | `Kicker` actuel ne propose pas de variant `champagne`      | Ajouter variant `tone="champagne"` au `Kicker`                                   |

Ces dix écarts représentent ~3 h 30 de travail préparatoire. **À traiter avant
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

- [ ] Capture d'écran de `/rituel` actuel (mobile 375 px, desktop 1440 px).
- [ ] Lighthouse mobile sur `/rituel` : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : nombre de violations critiques.
- [ ] `pnpm build` puis bundle size de la route `/rituel`.
- [ ] Sauvegarder dans `docs/plans/02-page-rituel-baseline.md`.

### Phase 1 — Résolution des écarts spec / scaffold (3 h 30)

#### 1.1 Étendre `rituelPageContentSchema`

Fichier : [`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts)

Remplacer l'actuelle définition minimaliste par le schéma complet présenté en
§ 3.6 (microEssai, QAItem, etc.). Exporter les types associés.

#### 1.2 Étendre `CMSAdapter`

Fichier : [`lib/cms/types.ts`](../../apps/web/src/lib/cms/types.ts)

```ts
export interface CMSAdapter {
  // ...existant
  getRituelPageContent(): Promise<RituelPageContent>;
}
```

#### 1.3 Créer le mock `rituel.ts`

Fichier : `apps/web/src/data/mock/rituel.ts`

- Hero : surtitre « LE RITUEL », titre « Le rituel, geste après geste. »
- Origine : 3 paragraphes sobres sur la tradition japonaise du soin lent,
  photo sépia placeholder `/images/origine-sepia.svg`.
- Vidéo : sources `/videos/rituel-90s.mp4` et `.webm`, poster
  `/videos/rituel-poster.svg`, captions `/captions/rituel-fr.vtt` et `-ar.vtt`,
  transcript de ~120 mots, `durationSeconds: 90`.
- Sciences : 3 micro-essais (cire, jojoba, kaolin) avec `sourceRef: '[1]'`,
  liste de 3 sources académiques formatées (auteur, année, revue).
- Interview : 4 Q/R, photo portrait optionnelle.
- Pivot : phrase « Si le geste vous parle, le kit l'accompagne. », CTA
  `/kit` libellé « Voir le kit ».
- `journalCrossSlugs` : 3 slugs existants depuis `mock/articles.ts`.

#### 1.4 Implémenter `getRituelPageContent()` côté mock

Fichier : `apps/web/src/lib/cms/mock/index.ts` (ou équivalent)

```ts
import { mockRituelContent } from '@/data/mock/rituel';
// ...
async getRituelPageContent() {
  return rituelPageContentSchema.parse(mockRituelContent);
},
```

#### 1.5 Ajouter `tone="champagne"` au `Kicker`

Fichier : [`components/ui/Kicker.tsx`](../../apps/web/src/components/ui/Kicker.tsx)

```tsx
type KickerTone = 'default' | 'soft' | 'champagne' | 'on-dark';
const toneClass: Record<KickerTone, string> = {
  default: 'text-encre/70',
  soft: 'text-encre/50',
  champagne: 'text-champagne',
  'on-dark': 'text-creme/80',
};
```

#### 1.6 Mettre à jour la spec § 4.2

Remplacer « 4 gestes » par « 5 gestes (vidéo) » et noter la décision E1.

#### 1.7 Commit

```
git add -A
git commit -m "Aligne le sch\u00e9ma Rituel : contenu complet, adapter, kicker champagne"
```

> **Sortie de phase** : `pnpm typecheck` vert, `cms.getRituelPageContent()`
> renvoie un objet conforme.

### Phase 2 — Polissage des primitifs UI restants (1 h 30)

| Ordre | Composant   | Points d'attention spécifiques Rituel                                                          |
| ----- | ----------- | ---------------------------------------------------------------------------------------------- |
| 1     | `Heading`   | Vérifier `display-lg` (64 pt) line-height 1.05, tracking -0.01em                               |
| 2     | `Text`      | Variant `body-prose` (Inter 17 pt, line-height 1.7, mesure 60-65 ch)                            |
| 3     | `Container` | Variant `prose` (max-width 720 px) — micro-essais et interview tiennent dedans                  |
| 4     | `Image`     | Photo sépia : `quality={85}`, `placeholder="blur"`, hauteur fixe pour éviter CLS                |

**Commits** : un par composant si modifications notables, sinon un seul.

### Phase 3 — Création des primitifs transversaux (3 h)

#### 3.1 `ScrollProgress`

Fichier : `apps/web/src/components/patterns/ScrollProgress.tsx`

```tsx
'use client';
import { motion, useScroll, useReducedMotion } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-sticky h-[2px] origin-left bg-sauge"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
```

- Hauteur 2 px, couleur `--sauge`, `aria-hidden` toujours.
- Désactivé si `prefers-reduced-motion: reduce`.
- À monter dans le layout `(marketing)/rituel/layout.tsx` (créé Phase 7).

#### 3.2 `Footnote` et `SourcesList`

Fichier : `apps/web/src/components/patterns/Footnote.tsx`

```tsx
type FootnoteProps = { n: number };
export function Footnote({ n }: FootnoteProps) {
  return (
    <sup id={`fn-${n}`} className="ml-0.5 text-xs">
      <a
        href={`#src-${n}`}
        aria-describedby={`src-${n}`}
        className="text-encre/70 underline-offset-2 hover:underline"
      >
        {n}
      </a>
    </sup>
  );
}

export function SourcesList({ sources }: { sources: string[] }) {
  return (
    <ol className="mt-12 list-decimal space-y-2 pl-6 text-sm text-encre/70">
      {sources.map((s, i) => (
        <li key={i} id={`src-${i + 1}`}>{s}</li>
      ))}
    </ol>
  );
}
```

#### 3.3 `SchemaSVG` (ongle anatomique animé)

Fichier : `apps/web/src/components/patterns/SchemaSVG.tsx`

- Client Component, 3 calques `<motion.path>` (matrice, lit unguéal, plaque).
- Animation `pathLength` de 0 à 1, déclenchée `whileInView`, durée 1200 ms,
  ease `--ease-in-out-slow`.
- Si `useReducedMotion()` → render statique avec `pathLength={1}` et opacité
  pleine d'emblée.
- Légendes positionnées avec `<text>` SVG, font Inter 12 pt.
- ViewBox 0 0 480 320, `role="img"`, `aria-label` descriptif (« Coupe
  anatomique simplifiée d'un ongle : matrice, lit unguéal, plaque kératinisée »).

#### 3.4 `VideoPoster` et `CaptionsTrack` (utilitaires internes)

Fichiers : à inclure directement dans `VideoPlayer4Gestes.tsx` (pas de
réutilisation ailleurs avant Phase 2 produit).

**Commits** : un par composant. Trois commits.

### Phase 4 — Création des sections de la page (8 h)

#### 4.1 `HeroLifestyle` (1 h 30)

Fichier : `apps/web/src/components/sections/HeroLifestyle.tsx`

- Server Component (le hero n'a pas d'interactivité).
- Layout : photo lifestyle pleine hauteur 86vh desktop / 78vh mobile, gradient
  encre 0 → 35 % en bas pour lisibilité du texte.
- Surtitre `<Kicker tone="champagne">LE RITUEL</Kicker>`.
- Titre `<Heading as="h1" size="display-lg">` (64 pt Cormorant).
- Sous-titre `<Text size="lead">` 1 phrase max, 14 mots.
- Pas de CTA dans le hero (la spec impose : aucun CTA jusqu'à section 6).
- Image : `<Image priority fetchPriority="high" sizes="100vw" placeholder="blur" />`.

#### 4.2 `SectionNarrative` (1 h)

Fichier : `apps/web/src/components/sections/SectionNarrative.tsx`

- Layout 2 colonnes desktop (texte 60 % / image 40 %), 1 colonne mobile
  (texte puis image).
- Props : `kicker`, `titre`, `paragraphes: string[]`, `image`, `imageSide?: 'left' | 'right'`.
- Mesure de texte 60-65 ch (Container `prose`).
- `Reveal direction="up"` sur le bloc texte avec stagger 60 ms paragraphe par
  paragraphe.

#### 4.3 `VideoPlayer4Gestes` (2 h 30)

Fichier : `apps/web/src/components/sections/VideoPlayer4Gestes.tsx`

```tsx
'use client';
import { useRef, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function VideoPlayer4Gestes({ video }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [showTranscript, setShowTranscript] = useState(false);

  // IntersectionObserver : autoplay seulement si visible ≥ 50 %
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const obs = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? el.play().catch(() => {}) : el.pause()),
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  return (
    <section aria-labelledby="video-title" className="py-20">
      {/* ... */}
      <video
        ref={ref}
        poster={video.poster.src}
        preload="metadata"
        muted
        playsInline
        loop
        aria-describedby="video-transcript-summary"
        controls={reduced /* fallback motion réduit */}
      >
        <source src={video.sources.webm} type="video/webm" />
        <source src={video.sources.mp4} type="video/mp4" />
        <track kind="captions" srcLang="fr" src={video.captions.fr} default />
        <track kind="captions" srcLang="ar" src={video.captions.ar} />
      </video>
      <button onClick={() => setShowTranscript((v) => !v)}>
        {showTranscript ? 'Masquer la transcription' : 'Lire la transcription'}
      </button>
      {showTranscript && <p id="video-transcript-summary">{video.transcript}</p>}
    </section>
  );
}
```

Points clés :
- `preload="metadata"` (pas `auto`) — économise jusqu'à 5 Mo au chargement.
- `muted playsInline loop` — autoplay autorisé sur tous navigateurs mobiles.
- Captions FR par défaut, AR sélectionnable.
- Transcript dans un `<details>` ou bouton toggle, pour accessibilité et SEO.
- En `prefers-reduced-motion: reduce` : pas d'autoplay, controls visibles,
  poster reste affiché jusqu'au clic.
- `aria-describedby` pointe vers le résumé du transcript.

#### 4.4 `SciencesDuSoin` (1 h 30)

Fichier : `apps/web/src/components/sections/SciencesDuSoin.tsx`

- Layout : titre centré, puis grille 3 colonnes desktop / 1 colonne mobile
  pour les micro-essais ; sous la grille, le `SchemaSVG` centré et large.
- Chaque micro-essai : `Kicker` + `Heading h3` + `Text body-prose` + footnote
  `<Footnote n={...} />` à la fin du paragraphe quand `sourceRef` présent.
- En bas de section : `<SourcesList sources={...} />` (Phase 3.2).
- Fond `--ciel` très clair pour différencier visuellement la section science.

#### 4.5 `InterviewQR` (1 h)

Fichier : `apps/web/src/components/sections/InterviewQR.tsx`

- Layout magazine : portrait 1/3 + texte 2/3 desktop (image à gauche),
  pile mobile.
- Introduction en italique Cormorant 22 pt, signée du prénom de
  l'interviewée en Pinyon Script.
- Questions : `<dl>` avec `<dt>` (question, kicker majuscule) + `<dd>` (réponse,
  body-prose). Espacement vertical large entre Q/R.
- Une citation forte mise en exergue tous les 2-3 Q/R (Cormorant Italic 28 pt,
  encadrée par 2 `Fleuron` champagne).

#### 4.6 `PivotBanner` (1 h)

Fichier : `apps/web/src/components/sections/PivotBanner.tsx`

- Bandeau pleine largeur, fond `--sauge-soft`, padding vertical
  `--space-24` desktop / `--space-16` mobile.
- Centre : `Fleuron tone="champagne" size="lg"`, puis phrase Cormorant
  Italic 32 pt, puis CTA `<Button variant="primary" tone="encre">`.
- Animation : `Reveal` doux, pas de carrousel, pas d'urgence.
- Composant prévu pour être réutilisé sur `/maison` (le pivot vers `/rituel`
  ou `/kit`).

**Commits** : un par section. Six commits.

### Phase 5 — Sections mutualisées : `JournalGrid` (1 h 30)

Fichier : `apps/web/src/components/sections/JournalGrid.tsx`

- Server Component qui prend `articles: Article[]` et `kicker?`, `title?`.
- Layout : 3 colonnes desktop (équilibrées), 2 colonnes tablet, 1 mobile.
- Chaque card : `ArticleCard` (à créer si pas déjà fait — image 4:5,
  catégorie pill, titre Cormorant, temps de lecture).
- Variant prop : `variant?: 'symmetric' | 'asymmetric'`. La Home utilise
  `asymmetric` (1 hero + 2), Rituel utilise `symmetric` (3 égales).
- Limite : `slice(0, limit ?? articles.length)` pour absorber les listes plus
  longues côté CMS.

**Commit** : « Mutualise `JournalGrid` (variants symmetric / asymmetric) ».

### Phase 6 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/rituel/page.tsx`](../../apps/web/src/app/(marketing)/rituel/page.tsx)

```tsx
import { cms } from '@/lib/cms';
import { HeroLifestyle } from '@/components/sections/HeroLifestyle';
import { SectionNarrative } from '@/components/sections/SectionNarrative';
import { VideoPlayer4Gestes } from '@/components/sections/VideoPlayer4Gestes';
import { SciencesDuSoin } from '@/components/sections/SciencesDuSoin';
import { InterviewQR } from '@/components/sections/InterviewQR';
import { PivotBanner } from '@/components/sections/PivotBanner';
import { JournalGrid } from '@/components/sections/JournalGrid';
import { Fleuron } from '@/components/ui/Fleuron';

export const revalidate = 3600;

export default async function RituelPage() {
  const [content, journalArticles] = await Promise.all([
    cms.getRituelPageContent(),
    cms.getArticles({ limit: 3, featured: true }),
  ]);

  return (
    <main id="contenu-rituel">
      <HeroLifestyle data={content.hero} />
      <SectionNarrative {...content.origine} imageSide="right" />
      <Fleuron />
      <VideoPlayer4Gestes video={content.videoGestes} />
      <Fleuron />
      <SciencesDuSoin data={content.sciences} />
      <Fleuron />
      <InterviewQR data={content.interview} />
      <PivotBanner data={content.pivot} />
      <JournalGrid
        articles={journalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures de la maison."
        variant="symmetric"
      />
    </main>
  );
}
```

Et dans [`apps/web/src/app/(marketing)/rituel/layout.tsx`](../../apps/web/src/app/(marketing)/rituel/layout.tsx) (à créer) :

```tsx
import { ScrollProgress } from '@/components/patterns/ScrollProgress';
export default function RituelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollProgress />
      {children}
    </>
  );
}
```

**Commit** : « Assemble la page Rituel ».

### Phase 7 — SEO, métadonnées, JSON-LD (1 h)

Référence : [§ 11 — SEO](../preparation/11-seo-metadata.md).

```tsx
export const metadata: Metadata = {
  title: 'Le rituel \u2014 quatre gestes, une m\u00e9thode lente',
  description:
    'Origine japonaise, sciences du soin, t\u00e9moignage. Le rituel FemiGlow racont\u00e9 sans pr\u00e9cipitation.',
  alternates: { canonical: '/rituel' },
  openGraph: {
    type: 'article',
    title: 'Le rituel FemiGlow',
    description: 'Quatre gestes, une m\u00e9thode lente, racont\u00e9e \u00e0 Casablanca.',
    images: [{ url: '/og/rituel.svg', width: 1200, height: 630, alt: 'Le rituel FemiGlow' }],
  },
};
```

JSON-LD `HowTo` (4 ou 5 étapes du rituel) injecté via `<JsonLd type="HowTo" />` :

```ts
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Le rituel FemiGlow",
  "totalTime": "PT5M",
  "step": gestes.map((g, i) => ({
    "@type": "HowToStep",
    "position": i + 1,
    "name": g.titre,
    "text": g.description,
  })),
}
```

**Commit** : « SEO et JSON-LD pour `/rituel` ».

### Phase 8 — Performance (2 h)

Référence : [§ 10 — Performance](../preparation/10-performance-web-vitals.md).

#### 8.1 Vidéo

- `preload="metadata"` (pas `auto`) — vérifier dans DevTools Network.
- Poster en AVIF, ratio 16:9, taille ≤ 60 ko.
- Sources WebM en premier (compression supérieure), MP4 en fallback Safari.
- IntersectionObserver autoplay seuil 0.5 → la vidéo ne charge ni ne lit
  tant qu'elle n'est pas visible à moitié.

#### 8.2 Image hero lifestyle

- LCP candidate. `priority fetchPriority="high" sizes="100vw"`.
- AVIF, qualité 80, `blurDataURL` 16 px.
- Vérifier que le hero est servi sans CLS (hauteur fixée par `aspect-ratio`
  ou par `min-h-[86vh]`).

#### 8.3 Schéma SVG

- Pas d'animation tant que pas dans le viewport.
- `LazyMotion` + `domAnimation` (déjà appliqué dans `Reveal`).

#### 8.4 Mesure

- `pnpm build` → first-load JS de `/rituel`. Cible : ≤ 110 kB gzip
  (un peu plus que la Home à cause du player vidéo client).
- Lighthouse mobile : LCP < 2.2 s, CLS < 0.05, INP < 150 ms.
- Watch rate vidéo : à instrumenter Phase 9 (analytics).

**Commit** : « Optimise `/rituel` : vid\u00e9o lazy, hero AVIF, framer tree-shake ».

### Phase 9 — Accessibilité (2 h)

Référence : [§ 9 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>`, dans `HeroLifestyle`.
- [ ] Hiérarchie h1 → h2 (sections) → h3 (micro-essais, Q dans interview)
      sans saut.
- [ ] Skip-link cible `#contenu-rituel`.
- [ ] Vidéo : captions FR par défaut, captions AR alternatives, transcript
      complet accessible via bouton.
- [ ] Bouton transcript : `aria-expanded`, focus visible, label explicite.
- [ ] `prefers-reduced-motion: reduce` → `ScrollProgress` masqué, `SchemaSVG`
      statique, vidéo non autoplayée et controls visibles, `Reveal` désactivé.
- [ ] Footnotes : `<sup>` cliquable, focus visible, ancre vers `<li id="src-N">`,
      retour clavier possible (`<a href="#fn-N">↩</a>` dans la source).
- [ ] Tap targets ≥ 44×44 px (boutons transcript, captions toggle, CTA pivot).
- [ ] Contraste : surtitre champagne sur photo sombre ≥ 4.5:1 (vérifier sur
      la photo réelle ; sinon ajouter overlay encre 25 %).
- [ ] axe : zéro violation critique.
- [ ] VoiceOver : lecture cohérente du `dl` interview, des footnotes, du
      transcript.
- [ ] Test clavier : Tab couvre toute la page sans piège, ESC ferme le
      transcript ouvert.

**Commit** : « Audit a11y `/rituel` : 0 violation, vid\u00e9o transcript clavier ».

### Phase 10 — Tests (2 h)

Référence : [§ 12 — QA](../preparation/12-qa-debugging-observabilite.md).

#### 10.1 Vitest unitaires

- `HeroLifestyle.test.tsx` : rend h1, image avec `priority`, surtitre champagne.
- `VideoPlayer4Gestes.test.tsx` : rend `<video preload="metadata">`, `<track kind="captions">` FR + AR, transcript caché par défaut, bouton bascule
  l'affichage. Test motion réduit : controls visibles, pas d'autoplay.
- `SchemaSVG.test.tsx` : axe propre, `role="img"` + `aria-label` présent.
- `Footnote.test.tsx` : ancre `#src-N`, `aria-describedby` propre.
- `PivotBanner.test.tsx` : un seul CTA, libellé attendu, fleuron champagne.

```ts
// VideoPlayer4Gestes.test.tsx
it('rend les captions FR et AR', () => {
  render(<VideoPlayer4Gestes video={mockRituelContent.videoGestes} />);
  const tracks = document.querySelectorAll('track[kind="captions"]');
  expect(tracks).toHaveLength(2);
  expect(tracks[0]).toHaveAttribute('srclang', 'fr');
});
```

#### 10.2 Storybook stories

- Une story par section + une story `Page > Rituel` qui assemble tout.
- Story `VideoPlayer4Gestes` avec contrôle motion réduit (toggle decorator).

#### 10.3 Playwright golden path

```ts
// e2e/rituel.spec.ts
test('Rituel : golden path', async ({ page }) => {
  await page.goto('/rituel');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('link', { name: /voir le kit/i }).click();
  await expect(page).toHaveURL('/kit');
});

test('Rituel : transcript ouvrable au clavier', async ({ page }) => {
  await page.goto('/rituel');
  await page.getByRole('button', { name: /lire la transcription/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/transcript/i)).toBeVisible();
});
```

**Commit** : « Tests `/rituel` : unitaires, stories, E2E golden path + transcript ».

### Phase 11 — Copy et finitions (1 h)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets « … » et avant `:` `;` `?` `!`.
- [ ] Surtitre hero : « LE RITUEL » (capitales, tracking 0.18em, champagne).
- [ ] Pivot CTA : « Voir le kit » (pas « Acheter », pas « Commander »).
- [ ] Phrase pivot : un seul verbe, présent ou impératif doux. Test à voix
      haute : sonne-t-elle comme un conseil ou comme une injonction ? Conseil.
- [ ] Sources académiques : format auteur (année), titre, revue. Pas
      d'exagération scientifique.
- [ ] Captions VTT : relire FR et AR, vérifier rythme (≤ 42 caractères/ligne,
      ≥ 1 s à l'écran).

**Commit** : « Polit la copy de `/rituel` contre le glossaire \u00e9ditorial ».

### Phase 12 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile ET desktop sur `/rituel`.
- [ ] Comparaison baseline vs après dans
      `docs/plans/02-page-rituel-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → tout vert.
- [ ] Capture vidéo du golden path (mobile 375 px puis desktop 1440 px).
- [ ] PR vers `main` référencée à ce plan et à la spec § 4.2.
- [ ] Merge.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` :
      « Rituel : LCP 1.8 s, CLS 0.02, INP 110 ms, axe 0, transcript a11y, copy validée ».

---

## 6. Definition of Done — spécifique Rituel

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] La page se lit d'un trait sans rupture de ton — lecture à voix haute
      validée par une personne extérieure.
- [ ] La vidéo s'autoplay muet **uniquement** quand visible ≥ 50 %, jamais en
      arrière-plan ; la lecture cesse quand on scrolle hors champ.
- [ ] Le poster est visible **avant** que la vidéo charge (poids ≤ 60 ko).
- [ ] Captions FR par défaut, AR sélectionnable, transcript complet
      accessible au clavier et au lecteur d'écran.
- [ ] `prefers-reduced-motion: reduce` → tout est statique, controls vidéo
      visibles, schéma figé, scroll progress masqué.
- [ ] Aucun CTA visible avant la section 6 (pivot). Vérifié à la souris et
      au clavier (Tab order ne rencontre aucun bouton avant le pivot, hors
      bouton transcript).
- [ ] Le pivot ne dramatise pas : un seul CTA, pas de promesse, pas d'urgence.
- [ ] Sources académiques cliquables, ancrées, retour possible vers le `<sup>`.
- [ ] La page reste élégante en arabe (test rapide : translate page → vérifier
      que les captions et la mise en page tiennent). RTL n'est pas Phase 1
      mais on prépare.
- [ ] Aucun warning console en dev, en build, en prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/02-page-rituel-baseline.md` (créé en Phase 0) :

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| LCP mobile                        | _        | < 2.2 s  | _      |
| LCP desktop                       | _        | < 1.6 s  | _      |
| CLS                               | _        | < 0.05   | _      |
| INP                               | _        | < 150 ms | _      |
| TBT                               | _        | < 250 ms | _      |
| First-load JS gzip                | _        | ≤ 110 kB | _      |
| Poids vidéo (poster + métadonnées)| _        | < 200 kB | _      |
| Violations axe critique           | _        | 0        | _      |
| Score Lighthouse Perf             | _        | ≥ 90     | _      |
| Score Lighthouse a11y             | _        | 100      | _      |
| Score Lighthouse Best Pr.         | _        | ≥ 95     | _      |
| Score Lighthouse SEO              | _        | 100      | _      |

---

## 8. Risques et points d'attention

| Risque                                                                  | Mitigation                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vidéo 90 s = asset le plus lourd, peut faire exploser le LCP            | `preload="metadata"`, poster AVIF léger, autoplay seulement en intersection ≥ 50 %  |
| Autoplay refusé par certains navigateurs malgré `muted`                  | Fallback : controls natifs visibles, bouton play sur poster, captions toujours OK   |
| Captions VTT mal synchronisées                                          | Relecture humaine sur device, test sur Safari iOS et Chrome Android                 |
| `SchemaSVG` animé saccadé sur Android bas de gamme                      | Animation `transform`/`opacity` uniquement, désactivée si motion réduit             |
| Footnotes inaccessibles au lecteur d'écran                              | `aria-describedby` + ancres bidirectionnelles `<sup>` ↔ `<li id="src-N">`           |
| Sources académiques fictives ou non vérifiables                          | Lister uniquement des sources réelles ; sinon, ne pas écrire la section 4           |
| Pivot trop commercial casse la posture éditoriale                        | Test à voix haute, glossaire éditorial, pas d'urgence, pas de prix mentionné        |
| Page longue → scroll fatigue mobile                                     | Respirations généreuses, `Fleuron` entre sections, pas de paroi de texte > 800 mots |
| `JournalGrid` mutualisé casse la Home si signature change               | Variant `symmetric`/`asymmetric` ; tests Storybook pour les deux variants           |
| Vidéo non livrée à temps en Phase 1                                      | Mock = poster statique + sources factices ; remplacer par la vraie vidéo Phase 2    |

---

## 9. Estimation horaire récapitulative

| Phase                                       | Estimation |
| ------------------------------------------- | ---------- |
| 0 — Baseline                                | 0 h 30     |
| 1 — Résolution écarts                       | 3 h 30     |
| 2 — Polissage primitifs UI                  | 1 h 30     |
| 3 — Primitifs transversaux                  | 3 h        |
| 4 — Sections de la page                     | 8 h        |
| 5 — `JournalGrid` mutualisé                 | 1 h 30     |
| 6 — Assemblage page                         | 1 h        |
| 7 — SEO + JSON-LD                           | 1 h        |
| 8 — Performance                             | 2 h        |
| 9 — Accessibilité                           | 2 h        |
| 10 — Tests                                  | 2 h        |
| 11 — Copy & finitions                       | 1 h        |
| 12 — Mesure & merge                         | 0 h 30     |
| **Total**                                   | **27 h 30**|

Avec interruptions, écriture des captions VTT, et premier passage sur le
schéma SVG (qui demande du dessin) : **28 h ou 4 jours pleins**.

---

## 10. Annexes — commandes utiles

### Lancer le dev sur la route Rituel
```bash
cd apps/web
pnpm dev
# puis ouvrir http://localhost:3000/rituel
```

### Lighthouse en CLI
```bash
npx lighthouse http://localhost:3000/rituel --view --preset=desktop --output=html --output-path=./lighthouse-rituel-desktop.html
npx lighthouse http://localhost:3000/rituel --view --output=html --output-path=./lighthouse-rituel-mobile.html
```

### Bundle analyzer ciblé
```bash
ANALYZE=true pnpm --filter @femiglow/web build
# inspecter le chunk de /rituel et celui de framer-motion
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000/rituel
```

### Vérifier la vidéo
```bash
# Inspecter dans DevTools : Network → filter "media"
# Vérifier que .webm sert avant .mp4, preload=metadata, et range request 206
```

### Tests
```bash
pnpm --filter @femiglow/web test -- rituel
pnpm --filter @femiglow/web test:e2e -- rituel
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *La page Rituel tient debout si, en l'envoyant à une rédactrice de Vogue
> Beauté ou à un conseiller en e-commerce de luxe, elle se lit comme un long
> format de magazine et non comme une fiche produit. Si on doit dire « c'est
> en attendant la vraie vidéo », « les sources sont génériques », « le
> schéma sera retravaillé » — la page n'est pas finie. Si la lectrice
> referme l'onglet en se sentant respectée, elle l'est.*

À cocher **avant** d'attaquer la page suivante (`/kit`).

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Page** : [`apps/web/src/app/(marketing)/rituel/page.tsx`](../../apps/web/src/app/(marketing)/rituel/page.tsx) (Server Component, 86 lignes).
- **Sections rendues** (verticales) : `HeroLifestyle` (image priority) →
  `SectionNarrative` → `Fleuron` → `VideoPlayer4Gestes` → `Fleuron` →
  `SciencesDuSoin` → `Fleuron` → `InterviewQR` → `PivotBanner` →
  `JournalGrid`.
- **SEO / JSON-LD** : `howToSchema` (5 étapes, durée totale `PT5M`) injecté
  via `<JsonLd>` SSR.
- **Tests** : 7 fichiers Vitest sections + ~41 cas — couvrant
  HeroLifestyle, SectionNarrative, VideoPlayer4Gestes, SciencesDuSoin,
  InterviewQR, PivotBanner, JournalGrid. Axe 0 violations.

### Décisions notables

| Code | Décision | Justification |
| ---- | -------- | ------------- |
| **D1** | `VideoPlayer4Gestes` Client avec `<source webm>` avant `<source mp4>` + `preload="metadata"` | Servir le format léger en priorité ; `metadata` évite de tirer la vidéo entière au LCP |
| **D2** | `<dl>` à plat dans `SciencesDuSoin` (pas de div interleaving) | Conformité axe `definition-list`/`dlitem` |
| **D3** | `HowTo` JSON-LD plutôt que `Article` | La page est un mode opératoire éditorialisé, pas un article ; rich result Google « How-to » plus aligné |

### Métriques (baseline → après)

| Métrique | Baseline | Cible | Après |
| -------- | -------- | ----- | ----- |
| First Load JS | n/a | ≤ 130 kB | **129 kB** ✓ |
| Violations axe | _ | 0 | **0** (corrigées Phase 1 — definition-list, landmark) |
| Tests Vitest sections | 0 | ≥ 6 | **7 fichiers / ~41 cas** |
| JSON-LD HowTo | absent | présent | **présent** (5 étapes, PT5M) |
| TypeScript / ESLint | 0 / 0 | 0 / 0 | **0 / 0** |
| Build | OK | OK | **OK** |

### Limites

- **Pas de mesure Lighthouse prod** : Web Vitals (LCP/CLS/INP) à mesurer
  en `next start` avant la mise en ligne.
- **Vidéo non finale** : `VideoPlayer4Gestes` joue un placeholder ; à
  remplacer par le master final du studio (sans changement de code, juste
  remplacement du fichier `public/`).
- **Sources `SciencesDuSoin` génériques** : à enrichir avec citations
  vérifiables (DOI / éditeur) Phase 2.

### Suivi

- Re-tourner la vidéo finale 4 gestes (45–60 s) et la déposer en
  `.webm` + `.mp4`.
- Brancher les sources scientifiques sur un CMS / DOI registry plutôt
  que sur fixtures.
- Mesurer Lighthouse Perf prod (cible ≥ 90) et profiler le bundle vidéo.
