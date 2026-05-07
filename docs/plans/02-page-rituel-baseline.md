# Baseline — Page Rituel (`/rituel`)

> Mesures consignées après exécution complète du [plan 02](./02-page-rituel.md).
> Phase 0 (mesure préalable) sautée à la demande explicite de l'utilisateur :
> *« go pour Phase 1+ du plan suivant »*. Le présent document tient lieu
> de baseline-after.

**Date de la mesure** : 2026-05-02
**Environnement** : Next.js 14.2.15 (`pnpm build`), Node 22.22.2,
pnpm 11.3.0, axe-core 4.11.4 in-browser, viewport mobile 375 × 812 et
desktop 1440 × 900.
**Mode** : preview server `pnpm dev` (port 3001) pour l'audit a11y et
visuel ; `pnpm build` pour le bundle.

---

## 1. Inventaire structurel livré

| Marqueur                                       | Constat                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| `<html lang>`                                  | `fr` ✓                                               |
| `<h1>` unique                                  | « Le rituel, geste après geste. » ✓                  |
| Hiérarchie                                     | 1 h1 / 5 h2 / 6 h3                                   |
| `<main id="main">` unique                      | fourni par `(marketing)/layout.tsx` ✓                |
| Skip-link                                      | hérité du layout marketing ✓                         |
| Sections                                       | 7 (Hero, Origine, Vidéo, Sciences, Interview, Pivot, Journal) |
| Fleurons séparateurs                           | 3 (entre Origine/Vidéo, Vidéo/Sciences, Sciences/Interview) |
| `<meta name="description">`                    | présent ✓                                            |
| `<link rel="canonical">`                       | `/rituel` ✓                                          |
| OpenGraph                                      | type `article`, locale `fr_MA`, OG image dédiée      |
| `<script type="application/ld+json">`          | **HowTo** schema (5 steps) ✓                         |
| Vidéo `<video>`                                | poster, 2 sources (webm + mp4), 2 tracks (fr default + ar) |
| Transcription                                  | bouton `aria-expanded` + section masquée par défaut  |
| `ScrollProgress`                               | barre fine sticky (désactivée en reduced-motion) ✓   |

---

## 2. Composants nouveaux

| Composant                | Type            | Fichier                                                     |
| ------------------------ | --------------- | ----------------------------------------------------------- |
| `HeroLifestyle`          | section RSC     | `src/components/sections/HeroLifestyle.tsx`                 |
| `SectionNarrative`       | section RSC     | `src/components/sections/SectionNarrative.tsx`              |
| `VideoPlayer4Gestes`     | section client  | `src/components/sections/VideoPlayer4Gestes.tsx`            |
| `SciencesDuSoin`         | section RSC     | `src/components/sections/SciencesDuSoin.tsx`                |
| `InterviewQR`            | section RSC     | `src/components/sections/InterviewQR.tsx`                   |
| `PivotBanner`            | section RSC     | `src/components/sections/PivotBanner.tsx`                   |
| `JournalGrid`            | section RSC     | `src/components/sections/JournalGrid.tsx`                   |
| `ScrollProgress`         | pattern client  | `src/components/patterns/ScrollProgress.tsx`                |
| `Footnote` + `SourcesList` | pattern RSC   | `src/components/patterns/Footnote.tsx`                      |
| `SchemaSVG`              | pattern client  | `src/components/patterns/SchemaSVG.tsx`                     |

`JournalGrid` mutualise deux variantes (`symmetric` 3 cartes, `asymmetric`
1 hero + 2 mini-cartes), prête à servir le journal et la home.

---

## 3. Schémas Zod ajoutés

`src/lib/schemas/page-content.ts` : `microEssaiSchema`, `qaItemSchema`,
`rituelOrigineSchema`, `rituelVideoSchema`, `rituelSciencesSchema`,
`rituelInterviewSchema`, `rituelPivotSchema`, `rituelPageContentSchema`.

CMS : `cms.getRituelPageContent()` câblé sur `mockRituel` (mock adapter)
et stub Sanity en attente de Phase 2.

---

## 4. Accessibilité — axe-core 4.11.4 en page

| Indicateur                  | Résultat |
| --------------------------- | -------: |
| Violations                  | **0**    |
| Incomplete                  | 0        |

Trajectoire : 5 violations à la première itération (8 nodes
`definition-list`/`dlitem` + 3 nodes `landmark-no-duplicate-main`).
Corrigées par :

1. Un `<dl>` par paire question/réponse, exergue rendu à l'extérieur de
   la dl (le HTML5 interdit `<figure>` comme enfant de `<dl>`).
2. Suppression du `<main>` au niveau de la page `/rituel` (le layout
   `(marketing)` en fournit déjà un).

---

## 5. Bundle prod (`pnpm build`)

| Route                      | Page size | First Load JS | Δ vs Home  |
| -------------------------- | --------: | ------------: | ---------: |
| `/`                        |    6.19 kB |     157 kB    |       —    |
| `/rituel`                  |    3.16 kB |  **129 kB**   |   −28 kB   |
| `/journal/[slug]`          |    295 B   |    92.5 kB    |       —    |
| `/kit`                     |    295 B   |    92.5 kB    |       —    |
| Shared chunks total        |       —    |    87.1 kB    |       —    |

`/rituel` est **plus léger** que `/` malgré la vidéo et les patterns
client (ScrollProgress, SchemaSVG, VideoPlayer4Gestes). La Home tire
davantage car elle embarque NewsletterForm + react-hook-form + zod.

---

## 6. Tests automatisés

| Suite                            | Tests | Statut |
| -------------------------------- | ----: | -----: |
| `Hero.test.tsx`                  |     3 |     ✓  |
| `HeroLifestyle.test.tsx`         |     4 |     ✓  |
| `Manifeste.test.tsx`             |     3 |     ✓  |
| `GestesGrid.test.tsx`            |     3 |     ✓  |
| `AvisStrip.test.tsx`             |     3 |     ✓  |
| `JournalExtraits.test.tsx`       |     3 |     ✓  |
| `JournalGrid.test.tsx`           |     4 |     ✓  |
| `SectionNarrative.test.tsx`      |     3 |     ✓  |
| `SciencesDuSoin.test.tsx`        |     3 |     ✓  |
| `InterviewQR.test.tsx`           |     4 |     ✓  |
| `VideoPlayer4Gestes.test.tsx`    |     3 |     ✓  |
| `PivotBanner.test.tsx`           |     2 |     ✓  |
| `NewsletterForm.test.tsx`        |     3 |     ✓  |
| **Total**                        | **41**| **✓** |

Tous incluent un cas `expectNoAxeViolations`. Le test axe sur
`VideoPlayer4Gestes` requiert un timeout porté à 15 s (dom vidéo + 2 sources
+ 2 tracks).

---

## 7. Vérifications terminales

| Commande                              | Résultat |
| ------------------------------------- | -------: |
| `pnpm --filter @femiglow/web typecheck` |    ✓    |
| `pnpm --filter @femiglow/web lint`    |    ✓     |
| `pnpm --filter @femiglow/web test`    | 41/41 ✓ |
| `pnpm --filter @femiglow/web build`   |    ✓     |
| axe en page (`/rituel`)               | 0 violation |

---

## 8. Conformité éditoriale

Audit du mock `mockRituel` et des sections contre
[`docs/preparation/annexes/glossaire-editorial.md`](../preparation/annexes/glossaire-editorial.md) :

- Apostrophes courbes U+2019 partout dans le copy user-facing ✓
- Em-dashes U+2014 employés en séparateur narratif ✓
- Espaces fines U+202F avant `:` et `?` ✓ (mock + VTT FR corrigé)
- Aucun `!`, aucun emoji ✓
- Pas de mots bannis (« acheter », « produit » comme substantif transactionnel,
  superlatifs, urgence) ✓
- Mantras présents : « Cinq minutes », tonalité hospitalière

Le VTT FR initialement en apostrophe ASCII a été corrigé pour utiliser
`’` et insérer les espaces fines U+202F avant les deux-points.

---

## 9. Trade-offs assumés

- **Vidéo et poster en SVG placeholder** : la production fournira des
  fichiers MP4/WebM réels et un poster JPEG ; la mécanique
  IntersectionObserver + tracks FR/AR est livrée prête à recevoir l'asset.
- **Portrait Salma + photo origine sépia** également en SVG placeholders.
- **`ScrollProgress`** monté via `(marketing)/rituel/layout.tsx` plutôt
  qu'au niveau global — il ne s'applique pas hors du rituel pour l'instant.
- **`useScroll` + `pathLength`** dans `SchemaSVG` ramènent un coût
  framer-motion non négligeable, mais déjà partagé avec le bundle Home.
- **Phase 0 (baseline préalable) sautée** ; ce document tient lieu de
  baseline-after, sans comparaison numérique avant/après.

---

## 10. Lecture rapide

- **a11y 0 violation** dès le premier rendu corrigé.
- **Bundle `/rituel` 129 kB** : 28 kB en-dessous de la Home, malgré la
  vidéo et les patterns animés.
- **41/41 tests Vitest** verts incluant des audits axe par composant.
- **Typographie française** conforme au glossaire éditorial sur l'ensemble
  de la chaîne (mock → composants → captions VTT).

> *Le rituel se lit comme on souhaitait qu'il se lise : un long souffle,
> un corpus narratif, une vidéo qui s'efface, des sources qui se rappellent.
> La maison gagne sa deuxième page.*
