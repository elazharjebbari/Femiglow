# `components/kit/` — Composants dédiés à la page `/kit`

Composants extraits ou créés pour les refontes successives de `/kit` selon
le playbook Kolenda (`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`) :

- §4.3 « La composition » → plan `docs/composition-reveal-optim-2026-05/`
- §4.4 « Les gestes » (vidéo) → plan `docs/video-gestes-optim-2026-05/`

## Inventaire

### Section composition (§4.3)

| Composant | Rôle | Source |
|---|---|---|
| `CompositionCard.tsx` | Card individuelle d'un sous-produit (pastille numérotée, image, titre+volume inline, description, sensation italique, lien profondeur INCI). Remplace `commerce/ProductCard` (supprimé phase 8). | Kolenda §4.3 |
| `NumberBadge.tsx` | Pastille typographique 36×36 avec couleur d'accent (sauge/petale/ciel/champagne), `aria-hidden`. | Kolenda §4.3 + Annexe A |
| `SensationLine.tsx` | `<p>` italique Cormorant Garamond text-encre/70 pour la phrase de sensation. | Kolenda §4.3 + UX §13 |
| `MediaCrossfade.tsx` | Crossfade isolated ↔ contextual au hover desktop / tap mobile / clavier (Enter/Space). Respecte `prefers-reduced-motion`. | Kolenda §4.3 + Ecommerce §6 |

### Section vidéo « Les gestes » (§4.4)

| Composant | Rôle | Source |
|---|---|---|
| `VideoPosterCover.tsx` | Overlay click-to-play sur l'iframe YouTube (`forwardRef<HTMLIFrameElement>`). Rend poster custom ou fallback + bouton play 64×64 en couleur d'accent + badge durée. L'iframe n'est montée qu'après clic (économie ~150 kB initial). | Kolenda §4.4 |
| `VideoChapters.tsx` + `VideoChaptersFromRituel` | Mini-timeline cliquable sous le player. 4 colonnes responsives, `aria-current="step"` + underline accent pour le chapitre actif, tracking `video_chapter_click`. Retourne `null` si moins de 2 chapitres. | Kolenda §4.4 |
| `VideoIFrameTracker.tsx` | Composant React-only (rend `null`) qui attache la YouTube IFrame API à l'iframe pour émettre `video_progress_25/50/75` + `video_complete`, et propage `currentSeconds` aux composants frères. Graceful degradation si ad-blocker. | Kolenda §4.4 + Analytics |
| `VideoPostCta.tsx` | Lien éditorial discret « Voir le pack ci-dessous ↓ » sous la transcription, scroll smooth vers `#commander-femiglow`, tracking `video_cta_click`. | Kolenda §4.4 |

## Helpers associés

| Module | Rôle |
|---|---|
| `@/lib/composition/copy.ts` | Fonctions pures : `buildCardHeader`, `formatSensation`, `formatIndex`, `resolveAccentHex`. |
| `@/lib/video/youtube-url.ts` | `parseYouTubeUrl`, `buildYouTubeEmbedUrl` (mute/captions/enableJsApi). |
| `@/lib/video/chapters.ts` | `formatChapterTimestamp`, `findActiveChapterIndex`, `formatChapterIndex` — pur compute (testable sans React). |
| `@/lib/video/iframe-tracker.ts` | `loadYouTubeIframeApi` (idempotent) + `attachVideoTracker` (player + polling 25/50/75 + ENDED). |

## Conventions

- **Pas d'apostrophe ASCII (`'`) dans les chaînes JSX**. Utiliser `’` (U+2019) ou échapper `\'` si nécessaire (`prettier` peut le faire pour vous).
- **Toujours passer `index` à `CompositionCard`** pour que la pastille numérotée soit cohérente avec l'ordre de la liste.
- **`accentColor` est optionnel**. Le fallback automatique est `champagne` (`#B8956B`).
- **`sensation` est optionnel**. Si absent du SubProduct, la `SensationLine` n'est pas rendue.
- **`contextualImage` est optionnel**. Si absent, `MediaCrossfade` désactive son interaction.
- **Vidéo — tous les champs étendus sont optionnels** (`chapters`, `posterCustom`, `provenance`, `durationDisplay`, `accentColor`). Un `RituelVideo` sans aucun champ reste rendu (timeline et badges juste invisibles).
- **`VideoIFrameTracker` mount conditionnel** : ne monter QUE quand `played === true`, sinon l'iframe n'existe pas et le tracker no-op.
- **L'iframe YouTube DOIT contenir `enablejsapi=1`** pour que `VideoIFrameTracker` puisse l'attacher (`YouTubeEmbed` le passe quand `enableJsApi` est `true`, ce que `VideoPosterCover` active automatiquement à `played === true`).

## Tests

- Tous les composants ont leur propre `*.test.tsx` co-localisé.
- Helpers `lib/composition/copy.ts` couverts par `copy.test.ts` (15 cas).
- Helpers `lib/video/chapters.ts` couverts par `chapters.test.ts` (15 cas).
- `lib/video/iframe-tracker.ts` couvert par `iframe-tracker.test.ts` (16 cas, mock `window.YT`).
- Couverture cible : ≥ 85 % branches (cf. les `07-tests-strategy.md` de chaque plan).

## Roadmap

### Composition (§4.3)

- **Phase 6 (à venir)** : éditeur admin `/admin/kit/composition/[id]` qui pilote nom, volume, description, sensation, ingrédients, certifications, image isolated et contextuelle.
- **Phase 7 (à venir)** : E2E Playwright + a11y axe pour figer le rendu et les interactions.

### Vidéo (§4.4)

- **Phase 6 (à venir)** : éditeur admin `/admin/kit/video` (form Zod live + aperçu + publish/reset). cf. `docs/video-gestes-optim-2026-05/06-admin-ui-ux-design.md`.
- **Phase 7 (à venir)** : bascule self-hosted MP4 + WebM (suppression dépendance YouTube). Les sous-composants (`VideoPosterCover`, `VideoChapters`, `VideoIFrameTracker`) restent réutilisés.
- **Phase 8 (à venir)** : E2E Playwright `@video-render` + `@video-interaction` + axe `@video-a11y`.

## Référence

- Plan composition : [`docs/composition-reveal-optim-2026-05/`](../../../../../docs/composition-reveal-optim-2026-05/).
- Plan vidéo : [`docs/video-gestes-optim-2026-05/`](../../../../../docs/video-gestes-optim-2026-05/).
- Playbook Kolenda : [`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`](../../../../../docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md) §4.3 + §4.4.
