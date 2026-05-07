# Plan 06 — Page Maison — Baseline

> Mesures et état initial avant exécution du Plan 06. Capturé le 2026-05-03.

## État initial du scaffold

- Fichier : `apps/web/src/app/(marketing)/maison/page.tsx`
- Server Component minimal :
  - `Hero` variant `'lettre'` (kicker « La maison », titre « Une maison, à
    Casablanca. », pas de CTA scroll, pas d'image).
  - Une seule section `Container width="prose"` avec
    `content.storyParagraphs.map(...)` → 4 paragraphes en pile, sans photo.
  - **Aucun** : `HeroMaison`, `SectionNarrative`, `AtelierGallery`,
    `MatieresGrid` / `MatiereCard`, `EngagementsGrid` / `EngagementCard`,
    `CrossLinkTriptyque` / `CrossLinkCard`, `Fleuron`, signature manuscrite.
- Métadonnées `metadata` : title + description seuls. Pas d'`alternates`
  canonical, pas d'`openGraph`, pas de Twitter card, pas de JSON-LD
  `LocalBusiness` ou `Organization`.
- `revalidate = 3600` ✓.

## Schéma actuel `MaisonPageContent`

Trop pauvre ([`schemas/page-content.ts`](../../apps/web/src/lib/schemas/page-content.ts:138)) :

```ts
maisonPageContentSchema = z.object({
  hero: heroSchema,
  storyParagraphs: z.array(z.string()),     // <- à éclater
  signatureImage: imageSchema.optional(),
  fondatriceImage: imageSchema.optional(),  // <- jamais utilisé
});
```

À étendre selon la spec § 4.5 : `origine`, `fondatrice`, `atelier`,
`matieres[4]`, `engagements[4]`, `crossLinks[3]`.

## Composants déjà disponibles

- `Hero`, `Container`, `Heading`, `Image`, `Kicker`, `Text`, `Fleuron`,
  `Reveal`, `Button` — primitifs polis Plan 01.
- `JsonLd` (Plan 01) — réutilisable pour `LocalBusiness` / `Organization`.

## Composants manquants (à créer)

| Composant              | Type   |
| ---------------------- | ------ |
| `HeroMaison`           | Server |
| `SectionNarrative`     | Server |
| `AtelierGallery`       | Client (Radix Dialog) |
| `MatiereCard`          | Server |
| `MatieresGrid`         | Server |
| `EngagementCard`       | Server |
| `EngagementsGrid`      | Server |
| `CrossLinkCard`        | Server |
| `CrossLinkTriptyque`   | Server |

## Mock — état actuel

- Hero `lettre` + 4 `storyParagraphs` plats. Aucune image, aucun engagement,
  aucune matière, aucun cross-link.

## Métriques avant / après

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| Hero 92vh dédié                   | absent (variant `lettre` partagé) | présent (`HeroMaison`) | présent (gradient crème → champagne, fleuron décor, h1 96 pt italique-auto, CTA scroll `#origine`) |
| Sections L'origine + La fondatrice | 4 § plats | 2 sections image+texte alternées | 2× `SectionNarrative` (right/left), photos 4:5, paragraphes Reveal |
| Atelier Casablanca + galerie 3 photos | absent | présent + Dialog | `AtelierGallery` Client + `<dialog>` natif (ESC, focus, backdrop) + 3 photos 3:2 |
| 4 matières (cire / jojoba / kaolin / mica) | absent | grille 2×2 + 4 ambiances | `MatieresGrid` 2×2 + 4 `MatiereCard` (champagne/sauge/crème/pétale) + 4 SVG botaniques |
| 4 engagements (sourcing / sans vernis / lent / local) | absent | 4 col desktop | `EngagementsGrid` 4 col + numéros 01..04 Cormorant champagne |
| Cross-links triptyque /rituel /journal /kit | absent | 3 cards 4:5 | `CrossLinkTriptyque` + 3 `CrossLinkCard` (image 4:5, hover scale, motion-reduce) |
| Signature manuscrite              | non utilisée | optionnelle en clôture fondatrice | optionnelle conservée dans le schéma (non utilisée par le mock) |
| JSON-LD `LocalBusiness`           | absent | présent | `LocalBusiness` + `Organization` |
| OG image dédiée Maison            | absent | `/og/maison.svg` | `/og/maison.svg` + Twitter `summary_large_image` |
| Tests Vitest dédiés Maison        | 0 | ≥ 5 fichiers | 5 fichiers, 15 tests verts (HeroMaison, MatieresGrid, EngagementsGrid, CrossLinkTriptyque, AtelierGallery) |
| Violations axe                    | _ | 0 | 0 (vérifié sur `/maison` via axe-core 4.10) |
| First Load JS `/maison`           | 99.2 kB (185 B route) | ≤ 130 kB | 128 kB (3.02 kB route) |
| Suite Vitest globale              | 98 verts | _ | 113 verts (33 fichiers) |
| TypeScript / ESLint               | _ | 0 / 0 | 0 / 0 |
