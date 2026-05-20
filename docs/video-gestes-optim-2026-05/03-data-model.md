# 03 — Modèle de données

## 1. Schema existant `RituelVideo` — à conserver

`apps/web/src/lib/schemas/page-content.ts` (autour de la définition `kitVideoSchema`) :

```ts
export const rituelVideoSchema = z.object({
  poster: imageSchema,
  sources: z.object({
    mp4: z.string().url(),
    webm: z.string().url(),
  }),
  captions: z.object({
    fr: z.string().url(),
    ar: z.string().url(),
  }),
  youtubeUrl: z.string().url().optional(),
  transcript: z.string(),
});
export type RituelVideo = z.infer<typeof rituelVideoSchema>;
```

À ne **pas casser** :
- `videoSrc` dans `kitPageContentSchema` (consommé par `VideoPlayer4Gestes`).
- Tests existants `VideoPlayer4Gestes.test.tsx` et `YouTubeEmbed.test.tsx`.
- Mock `mockKitPageContent.videoSrc`.

## 2. Extensions (Phase 1)

Tous les nouveaux champs sont **optionnels** pour préserver la rétrocompatibilité.

```ts
/**
 * Chapitre temporel d'une vidéo. Permet une mini-timeline cliquable qui
 * scrute la vidéo à un timestamp précis (`?t=NNs`).
 *
 * Contraintes :
 *  - `key` slug-like (kebab-case), unique dans le tableau parent.
 *  - `label` court (max 24 chars) pour tenir sur la timeline mobile.
 *  - `startSeconds` ≥ 0, ≤ 600 (10 min max — la vidéo cible 90 s).
 *  - Les chapitres sont posés dans l'ordre croissant de `startSeconds`.
 *
 * cf. Kolenda §4.4 (mini-chapters) + Attention §53 (goal-directed).
 */
export const videoChapterSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
  label: z.string().min(1).max(24),
  startSeconds: z.number().int().min(0).max(600),
});
export type VideoChapter = z.infer<typeof videoChapterSchema>;

/**
 * Schema étendu `RituelVideo` — phase 1.
 */
export const rituelVideoSchema = z.object({
  // existant
  poster: imageSchema,
  sources: z.object({
    mp4: z.string().url(),
    webm: z.string().url(),
  }),
  captions: z.object({
    fr: z.string().url(),
    ar: z.string().url(),
  }),
  youtubeUrl: z.string().url().optional(),
  transcript: z.string(),

  // extensions phase 1
  /**
   * Poster custom maison (frame d'action) qui remplace le poster YouTube
   * tant que la cliente n'a pas cliqué sur play. Activé par
   * `VideoPosterCover` en mode `click-to-play`.
   * Optionnel : si absent, on garde `poster` (rétrocompat).
   */
  posterCustom: imageSchema.optional(),

  /**
   * Chapitres de la vidéo, ordonnés par `startSeconds` croissant.
   * Validés au `parse()` pour garantir l'ordre. Max 6 chapitres
   * (au-delà la timeline devient illisible).
   */
  chapters: z
    .array(videoChapterSchema)
    .min(2)
    .max(6)
    .refine(
      (arr) => arr.every((c, i) => i === 0 || c.startSeconds >= (arr[i - 1]?.startSeconds ?? 0)),
      { message: 'chapters doivent être triés par startSeconds croissant' },
    )
    .optional(),

  /**
   * Mention de provenance affichée sous le sous-titre, en italique
   * Cormorant. Voix maison — pas de prénom nominal, on évoque l'atelier.
   * Ex. « Filmé à l'atelier de Rabat, mars 2026. ».
   *
   * Contraintes :
   *  - 1 à 120 caractères après trim,
   *  - se termine par une ponctuation finale (`.`, `!`, `?` ou guillemet `»`).
   */
  provenance: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/[.!?»]$/, 'provenance doit se terminer par une ponctuation finale')
    .optional(),

  /**
   * Affichage de la durée sur le poster (badge `90″`). Format libre court.
   * Optionnel ; si absent, pas de badge.
   */
  durationDisplay: z.string().min(1).max(8).optional(),

  /**
   * Couleur d'accent pour le bouton play et les chapitres actifs.
   * Réutilise le même enum que `SubProduct.accentColor` (Annexe A).
   * Fallback `champagne` côté résolveur.
   */
  accentColor: subProductAccentColorSchema.optional(),
});
```

## 3. Types dérivés

Les types TS sont **inférés de Zod** via `z.infer`. Aucun type écrit à la main.

```ts
export type RituelVideo = z.infer<typeof rituelVideoSchema>;
export type VideoChapter = z.infer<typeof videoChapterSchema>;
```

## 4. Mock — mise à jour (Phase 1)

`apps/web/src/data/mock/kit.ts` — section `videoSrc` :

```ts
videoSrc: {
  // existant conservé
  poster: { ... },
  sources: { ... },
  captions: { ... },
  youtubeUrl: 'https://www.youtube.com/shorts/N2pDuciP4uQ',
  transcript: '...',

  // extensions phase 1
  posterCustom: {
    src: '/media/video-gestes/poster-paste.jpg',
    alt: 'Application de la paste sur le poignet, geste lent',
    width: 1080,
    height: 1920,
  },
  chapters: [
    { key: 'paste', label: 'Paste', startSeconds: 0 },
    { key: 'powder', label: 'Powder', startSeconds: 18 },
    { key: 'step-4', label: 'Step 4', startSeconds: 42 },
    { key: 'polissage', label: 'Polissage', startSeconds: 68 },
  ],
  provenance: 'Filmé à l\'atelier de Rabat, mars 2026.',
  durationDisplay: '90″',
  accentColor: 'sauge',
},
```

Le `posterCustom` reste à produire côté DA. En attendant, le champ peut être absent → le composant retombe sur `poster` (rétrocompat).

## 5. Conventions

### 5.1 Chapitres

- **Slug `key`** kebab-case, max 40 chars. Réutilisé pour `data-attribute` et événements analytics.
- **Label court** max 24 chars. Tenir sur la timeline horizontale mobile (320 px / 4 segments = ~75 px par segment moins padding).
- **`startSeconds`** en secondes entières. La durée vidéo cible 90 s, on prévoit 600 s (10 min) comme borne haute.
- **Ordre croissant garanti** par `refine` Zod. Le composant frontend peut faire confiance à l'ordre du tableau.

### 5.2 Provenance

- 1-120 caractères, ponctuation finale obligatoire.
- Voix maison : pas de prénom, on évoque **l'atelier**, **la maison**, **la saison**.
- Exemples valides :
  - `Filmé à l'atelier de Rabat, mars 2026.`
  - `Une saison, un geste, un plan unique.`
  - `Réalisé en lumière naturelle, sans coupe.`
- Exemples rejetés :
  - `Filmé chez Souheila à Rabat` ← pas de nom propre, manque ponctuation.
  - `Trop court` ← manque ponctuation.

### 5.3 `posterCustom` vs `poster`

| Champ | Usage |
|---|---|
| `poster` | Poster historique self-hosted + fallback iframe |
| `posterCustom` | Poster de l'overlay click-to-play (cible : frame d'action contrôlée) |

Quand `posterCustom` est défini, `VideoPosterCover` l'affiche par-dessus l'iframe avant lecture. Quand il est absent, le composant utilise `poster` (et accepte la frame YouTube par défaut, mais avec un overlay sauge atténué pour neutraliser le branding).

### 5.4 `durationDisplay`

Format court affichable sur le poster. Conventions FemiGlow :
- `90″` (Pricing §51-56 tabular-nums) pour 90 secondes.
- `1′30″` accepté pour ≥ 1 minute si nécessaire.
- Pas de format `1:30` avec deux-points (incohérent avec le ton éditorial).

## 6. Tags de cache associés

| Source | Tag |
|---|---|
| Tout le contenu vidéo | `kit-video` |
| Page `/kit` complète | `kit-page` (existant) |

À chaque mutation admin (phase 6) :
```ts
revalidateTag('kit-video');
revalidatePath('/kit');
```

## 7. Migrations

### 7.1 Phase 1 (schema + mock)

Pas de migration DB. Le `videoSrc` reste dans le mock TS. Les nouveaux champs sont optionnels.

### 7.2 Phase 6 (admin)

Si l'admin éditeur stocke en DB, table optionnelle :

```ts
// HORS PÉRIMÈTRE COURT TERME — documentation seulement
export const kitVideoOverride = pgTable('kit_video_override', {
  id: text('id').primaryKey(),  // 'singleton'
  youtubeUrl: text('youtube_url'),
  posterCustomMediaId: text('poster_custom_media_id'),
  chapters: jsonb('chapters'),
  provenance: text('provenance'),
  durationDisplay: text('duration_display'),
  accentColor: text('accent_color'),
  publishedAt: timestamp('published_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by'),
});
```

À court terme (phase 6 sans DB), on peut stocker dans Component-Fields existant (slot `kit-video`).

## 8. Invariants à préserver

1. **`videoSrc` obligatoire dans `kitPageContentSchema`**. Pas de modification.
2. **`poster`, `sources`, `captions`, `youtubeUrl`, `transcript` inchangés**. La variante `SelfHostedVariant` reste fonctionnelle.
3. **Aucun champ obligatoire ajouté**. Rétrocompat garantie.
4. **Schema rétrocompatible**. Un appelant qui ne connaît pas `chapters` continue de fonctionner.
5. **`chapters` triés** : invariant garanti par Zod `refine`. Le composant frontend peut faire confiance.

## 9. Tests data layer

| Fichier | Sujet |
|---|---|
| `apps/web/src/lib/schemas/page-content.test.ts` (étendre) | `videoChapterSchema`, `rituelVideoSchema` étendu (~15 cas) |
| `apps/web/src/data/mock/kit.test.ts` (étendre) | `videoSrc` enrichi passe la validation, exactement 4 chapitres, provenance présente |
| `apps/web/src/lib/video/chapters.test.ts` (nouveau) | Helpers de parsing/formatting des chapitres (~8 cas) |

Détails dans `07-tests-strategy.md`.

## 10. Risques

| Risque | Mitigation |
|---|---|
| Ajout `chapters` casse les consommateurs existants | Champ optionnel — aucun consommateur n'est forcé de l'utiliser |
| `posterCustom` introuvable côté admin → poster vide | Fallback `poster` (rétrocompat) ; jamais d'écran noir |
| Validation `startSeconds` ≥ durée vidéo | Validation côté UI admin (warning, pas erreur) — la vidéo source peut changer ; on tolère pour ne pas bloquer l'édito |
| Provenance trop longue → tronquée à l'affichage | Limite max 120 chars + UI admin avec compteur live |
