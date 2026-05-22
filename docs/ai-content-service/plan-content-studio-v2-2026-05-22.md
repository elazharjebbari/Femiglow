# Plan d'exécution — Content Studio v2

**Date** : 2026-05-22
**Auteur** : agent
**Documents parents** : `audit-content-studio-ux-2026-05-22.md`, `solutions-content-studio-ux-2026-05-22.md`
**Statut** : draft, en attente de tes choix Phase 0 (typo + couleurs), puis exécution

## 0. Décisions retenues

| Question | Choix | Conséquence |
|---|---|---|
| Périmètre | **Refonte complète** | 4 modes (`/home`, `/create`, `/library`, `/plan`), 8 phases |
| Image vs vidéo | **Choix explicite à la création** | Format = top-level dans `/create`, upload + édition supportent les 2 dès Phase 2 |
| Typo & couleurs | **Refonte intégrale** | Phase 0 décide 1 combo typo + 1 palette parmi 3 options (cf. §2) |
| Dark mode | **Oui, dark + light** | Tous les composants v2 sont thémés via CSS vars dès Phase 0 |
| Stratégie release | **Feature flag + route alternative** | `CONTENT_STUDIO_V2_ENABLED`, route `/admin/content-studio-v2/*`, bascule progressive |

### Hors scope explicite (à traiter plus tard)

- **AI video generation** (Sora/Veo/Kling) : trop d'incertitude API + coût. Phase 2 supporte l'upload vidéo + trim ; la génération vidéo IA reste hors v2.
- **Multi-tenant / multi-brand** : ce sera S4.
- **A/B testing de variantes côté audience** : dépend de la taille d'audience, S4.
- **Notifications push admin** (Slack/email "draft validé") : peut être ajouté en Polish si besoin.

## 1. Vue d'ensemble — 8 phases, ~22-29 jours

```
Phase 0 ▸ Foundations (typo + couleurs + dark mode + tokens + libs)   3-4j
Phase 1 ▸ Layout & navigation (shell, sidebar, 4 routes stubs)         1-2j
Phase 2 ▸ Media foundation (upload + crop image + trim vidéo)          4-5j
Phase 3 ▸ Mode /create (stepper, variants, autosave, preview)          4-5j
Phase 4 ▸ Mode /library (grid, filtres, bulk actions)                  2-3j
Phase 5 ▸ Mode /plan (calendrier DnD, queue jobs)                      3-4j
Phase 6 ▸ Mode /home (dashboard intégré, deep links)                   1-2j
Phase 7 ▸ Polish (hotkeys, Cmd+K palette, skeletons, E2E)              2-3j
Phase 8 ▸ Migration & sunset (bascule flag, suppression ancien)        1-2j
```

Chaque phase est commitable indépendamment derrière le flag `CONTENT_STUDIO_V2_ENABLED`. L'ancienne UI reste 100% fonctionnelle pendant toute la durée du chantier.

### Dépendances entre phases

```
0 ────► 1 ────► 2 ────► 3 ────► 7 ────► 8
        │       │       │       │
        ├──────►├──────►├──────►│
        │       │       │       │
        │       │       4 ──────►
        │       │       5 ──────►
        │       │       6 ──────►
```

Phase 0-1-2 sont **bloquantes** pour tout le reste (foundations). Phases 3-6 sont parallélisables si plusieurs développeurs. Phases 7-8 closent.

## 2. Décisions Phase 0 — typo & couleurs

Tu dois trancher avant de lancer Phase 0. Voici 3 combos cohérents avec le branding FemiGlow (skincare féminin, rituel, "slow living", marque marocaine).

### Option A — "Editorial élégant" (recommandée si la marque vise sophistication magazine)

| Élément | Choix | Source |
|---|---|---|
| Display (titres) | **Tobias** — serif moderne, refined editorial | Klim Type Foundry (licence commerciale) ou alternative libre : **Recoleta** |
| Body (lecture) | **Newsreader** — serif lisible, chaleureux | Google Fonts (gratuit, variable) |
| Mono (code/numérique) | **JetBrains Mono** | Google Fonts (gratuit) |
| Palette claire (light) | Ivory `#FBF6F1`, Sand `#E8DDD0`, Clay `#7A4E3F`, Rose profond `#9C2A47`, Sage `#5A7560` | Inspiré Marrakech, palette terre |
| Palette sombre (dark) | Espresso `#1A1411`, Bronze `#2F2520`, Linen `#E8DDD0`, Saffron `#D4A24C` (accent), Rose tamisé `#A65E72` | Maintient warmth, baisse saturation |

**Pour qui** : audience qui aime Vogue, Kinfolk, Bon Iver. Sophistiqué, intemporel, calme.
**Risque** : Tobias est payante. Recoleta (alternative gratuite) reste très bonne.

### Option B — "Modern warm" (recommandée si la marque vise modernité chaleureuse)

| Élément | Choix | Source |
|---|---|---|
| Display | **Cabinet Grotesk** — geometric warm | Fontshare (gratuit) |
| Body | **DM Sans** — geometric lisible | Google Fonts (gratuit) |
| Mono | **Geist Mono** | Vercel (gratuit) |
| Palette claire | Cream `#FAF7F2`, Stone `#D6CFC5`, Charcoal `#2C2825`, Rose vif `#C2436F`, Mint `#7FBCA8` | Modern, lisible, chaleureux |
| Palette sombre | Onyx `#121110`, Slate `#27241F`, Cream `#FAF7F2`, Rose lumineux `#E07B9B`, Mint `#9FD4C0` | Inversion warm-aware |

**Pour qui** : audience qui aime Linear, Notion, Vercel. Geek-friendly, accessible.
**Risque** : peut paraître "tech" et perdre la chaleur de la marque skincare.

### Option C — "Soft luxury" (recommandée pour positionnement premium-discret)

| Élément | Choix | Source |
|---|---|---|
| Display | **Garet** — humaniste géométrique, féminin | Fontshare (gratuit) |
| Body | **Söhne** — Swiss neo-grotesque | Klim (payant) ou alternative : **Inter** (gratuit, mais l'audit dit éviter) → ou **GT Walsheim** (alternative payante) ou **Manrope** (gratuit) |
| Mono | **Söhne Mono** ou **JetBrains Mono** | |
| Palette claire | Ivory `#F7F4EF`, Champagne `#E0CFB4`, Espresso `#3A2F25`, Velvet rose `#8E2E47`, Olive `#6B7A4F` | Discret, luxueux, mature |
| Palette sombre | Charcoal `#161310`, Bronze `#2A211B`, Champagne `#E0CFB4`, Velvet vif `#B23F5C`, Olive `#90A06D` | Conserve les terres |

**Pour qui** : audience qui aime The Row, Aesop, Loro Piana. Élégance silencieuse, qualité.
**Risque** : peut sembler "froid" si mal exécuté ; demande une iconographie + photographie cohérente.

### Comment choisir

Avant ta réponse, je peux générer (Phase 0 ouverte) **3 mini-mockups HTML/CSS** d'un même écran (`/create` step "Visuel") dans chacun des 3 styles, pour comparaison visuelle. C'est 1h de travail, hors du chemin critique du plan, qui te permet de trancher avec preuve.

Recommandation par défaut si tu ne tranches pas : **Option A — Editorial élégant** (alignée avec le positionnement "rituel slow" du studio).

## 3. Architecture cible

### 3.1 Routes (Next.js App Router)

```
apps/web/src/app/admin/content-studio-v2/
├── layout.tsx                 ← Shell v2 (sidebar + topbar + theme provider + Toaster)
├── page.tsx                   ← Redirect → /home
├── home/
│   └── page.tsx               ← Dashboard intégré (réutilise S3.3 widgets + ajouts)
├── create/
│   ├── page.tsx               ← Liste des idées + bouton "+ Nouvelle idée"
│   └── [draftId]/page.tsx     ← Mode édition full focus, stepper persistant
├── library/
│   └── page.tsx               ← Grid de tous drafts/posts, filtres, bulk actions
└── plan/
    └── page.tsx               ← Calendrier interactif + queue de jobs
```

### 3.2 État (React Context + hooks métier)

```ts
// lib/content-studio-v2/state/StudioContext.tsx
export interface StudioState {
  ideas: ContentIdea[];
  drafts: ContentDraft[];
  posts: ContentPost[];
  jobs: SocialPublishJob[];
  mediaItems: StudioMediaItem[];
  selectedDraftId: string | null;
}

// Hooks composables
useStudio()              // accès full state + setters
useDraft(draftId)        // single draft + brief + asset + jobs
useDraftAutosave(draftId)// debounced PATCH + indicator
usePublishJobs(postId?)  // active jobs + queue
useCalendarItems(range)  // calendar view items
useMediaLibrary(filters) // media grid + upload
useTheme()               // light/dark toggle persistant
```

### 3.3 Design tokens (CSS variables + Tailwind config)

```css
/* apps/web/src/styles/content-studio-v2/tokens.css */
:root[data-theme="light"] {
  --cs-bg-base: #FBF6F1;
  --cs-bg-elevated: #FFFFFF;
  --cs-bg-sunken: #F2EBE3;
  --cs-fg-primary: #1A1411;
  --cs-fg-secondary: #6B5E54;
  --cs-fg-muted: #A89D90;
  --cs-accent-primary: #9C2A47;     /* Rose profond (CTA) */
  --cs-accent-secondary: #7A4E3F;   /* Clay */
  --cs-accent-success: #5A7560;
  --cs-accent-warning: #C28846;
  --cs-accent-danger: #B8323A;
  --cs-border-subtle: rgba(122, 78, 63, 0.12);
  --cs-border-strong: rgba(122, 78, 63, 0.32);
  --cs-shadow-sm: 0 1px 2px rgba(26, 20, 17, 0.04);
  --cs-shadow-md: 0 4px 12px rgba(26, 20, 17, 0.08);
  --cs-shadow-lg: 0 12px 32px rgba(26, 20, 17, 0.12);
  --cs-radius-sm: 6px;
  --cs-radius-md: 10px;
  --cs-radius-lg: 16px;
  --cs-radius-full: 9999px;
  /* Sectorial tones (re-usés depuis l'ancien, normalisés) */
  --cs-sector-idea: #C24C73;
  --cs-sector-draft: #4A8AB8;
  --cs-sector-validation: #5A7560;
  --cs-sector-planning: #4F8B8B;
  --cs-sector-ai: #7A4E9C;
  --cs-sector-media: #C28846;
}
:root[data-theme="dark"] {
  --cs-bg-base: #1A1411;
  --cs-bg-elevated: #2F2520;
  --cs-bg-sunken: #120E0B;
  --cs-fg-primary: #FBF6F1;
  /* … */
}
```

```ts
// apps/web/src/styles/content-studio-v2/tokens.ts
export const studioTokens = {
  spacing: { 0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px', 16: '64px', 24: '96px' },
  fontSize: { xs: '11px', sm: '13px', base: '15px', lg: '17px', xl: '20px', '2xl': '24px', '3xl': '32px', '4xl': '44px' },
  fontFamily: {
    display: 'var(--cs-font-display)',
    body: 'var(--cs-font-body)',
    mono: 'var(--cs-font-mono)',
  },
  // …
};
```

Et exposé à Tailwind via `tailwind.config.ts` extends.

### 3.4 Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 14 App Router (existant) | Pas de migration |
| State | React Context + custom hooks | Suffisant au scale, pas de dépendance externe |
| UI primitives | **Radix UI** (@radix-ui/react-*) | Accessibilité native, headless, customisable |
| Animations | **framer-motion** | Standard, API simple, performant |
| Icônes | **Lucide React** | Cohérent open-source, 1000+ icons |
| Dialog/Toast | Radix + **sonner** | Sonner = standard de facto |
| Drag-and-drop | **@dnd-kit/core** | Léger, a11y, modern |
| Cropping | **react-easy-crop** | Maintenu, simple, suffisant |
| Vidéo trim (front) | **react-range** pour slider + HTML5 video preview | Pas de lib spécialisée, leveraging native |
| Vidéo trim (back) | **ffmpeg** (CLI, déjà installé staging probablement) | Industriel |
| Fonts | **next/font** (local + Google) | Performance optimale, no FOUT |
| Theme persistance | `localStorage` + cookie pour SSR initial | Pas de flash |

### 3.5 Layers de fichiers

```
apps/web/src/
├── app/admin/content-studio-v2/        ← Routes (Next.js)
├── components/admin/content-studio-v2/ ← Composants UI v2
│   ├── shell/                          ← Layout, Sidebar, Topbar, ThemeToggle
│   ├── primitives/                     ← Button, Input, Select, Dialog, Toast, Badge (wraps Radix)
│   ├── home/                           ← Dashboard widgets
│   ├── create/                         ← Stepper, IntentionForm, VariantsCompare, MediaStudio
│   ├── library/                        ← Grid, Filters, BulkActions
│   ├── plan/                           ← Calendar, JobQueue
│   └── media/                          ← Uploader, ImageCropper, VideoTrimmer, MediaPicker
├── lib/content-studio-v2/
│   ├── state/                          ← StudioContext, hooks
│   ├── api.ts                          ← Client HTTP (réutilise existant)
│   └── helpers.ts
└── styles/content-studio-v2/
    ├── tokens.css
    └── globals.css
```

## 4. Phases détaillées

### Phase 0 — Foundations (3-4j)

**But** : poser le socle (flag, routes, design system, dark mode, libs) sur lequel toutes les phases suivantes vont s'appuyer. À la fin de cette phase, l'app a une route `/admin/content-studio-v2` accessible (sous flag) qui affiche une page vide stylée avec theme toggle fonctionnel.

#### Étapes

**0.1 — Feature flag et route**
- Ajouter `CONTENT_STUDIO_V2_ENABLED: z.enum(['true','false']).optional()` à `env.ts`.
- Créer `app/admin/content-studio-v2/layout.tsx` (shell vide).
- Créer `app/admin/content-studio-v2/page.tsx` qui redirige vers `/home` ou affiche "v2 disabled" si flag false.
- Tests : route accessible avec flag true, 404 ou message désactivé sans flag.

**0.2 — Fonts (next/font)**
- Si Option A (Tobias/Newsreader/JetBrains Mono) :
  ```ts
  // apps/web/src/styles/content-studio-v2/fonts.ts
  import { Newsreader, JetBrains_Mono } from 'next/font/google';
  import localFont from 'next/font/local';
  export const fontDisplay = localFont({ src: './tobias.woff2', variable: '--cs-font-display' });
  export const fontBody = Newsreader({ subsets: ['latin'], variable: '--cs-font-body' });
  export const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--cs-font-mono' });
  ```
- Si licence Tobias bloquante : fallback Recoleta (gratuit).
- Appliquer les variables sur `<html>` côté layout v2.

**0.3 — Design tokens**
- Créer `styles/content-studio-v2/tokens.css` avec CSS variables light + dark.
- Créer `styles/content-studio-v2/tokens.ts` (échelles spacing/fontSize/radius).
- Étendre `tailwind.config.ts` avec `theme.extend.colors.cs` qui lit les CSS vars (via `colors: { cs: { 'bg-base': 'var(--cs-bg-base)', ... } }`).

**0.4 — Theme provider**
- `components/admin/content-studio-v2/shell/ThemeProvider.tsx` :
  - Lit `localStorage.theme` ('light'|'dark'|'system') au mount.
  - Applique `data-theme` sur `<html>`.
  - Écoute `prefers-color-scheme` pour 'system'.
  - Expose `useTheme()` hook.
- Stocker aussi le choix en cookie pour SSR (évite flash au reload).
- Tests : changement de theme → `data-theme` updated, persistant après reload.

**0.5 — Libs installées**
```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select \
  @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-radio-group \
  sonner framer-motion lucide-react @dnd-kit/core @dnd-kit/sortable react-easy-crop react-range
```

**0.6 — Primitives v2**
- `primitives/Button.tsx` (variants: primary, secondary, ghost, danger; sizes: sm, md, lg).
- `primitives/Input.tsx`, `primitives/Select.tsx`, `primitives/Textarea.tsx` (avec floating labels).
- `primitives/Dialog.tsx` (wrapper Radix avec style cohérent).
- `primitives/Badge.tsx`, `primitives/Spinner.tsx`, `primitives/Skeleton.tsx`.
- `primitives/Toast.tsx` (wrap sonner avec tons custom).
- Storybook-like : `app/admin/content-studio-v2/_dev/primitives/page.tsx` (page de démo des primitives, sous flag, accessible directement par URL pour QA visuelle).

**0.7 — Storybook visuel (optionnel mais recommandé)**
- Si déjà installé, monter une story par primitive.
- Sinon : page `/admin/content-studio-v2/_dev/preview` qui affiche toutes les primitives dans les 2 themes.

#### DoD Phase 0
- [ ] `npx tsc --noEmit` vert.
- [ ] Tests vitest des primitives passent (≥ 15 tests).
- [ ] Route `/admin/content-studio-v2` répond 200 (avec flag) avec layout stylé + toggle theme fonctionnel.
- [ ] Toggle theme persiste après reload (cookie + localStorage).
- [ ] Page `_dev/preview` montre toutes les primitives en light + dark, sans cliché visuel.
- [ ] 0 régression sur l'ancien `/admin/content-studio` (tests vitest + smoke curl).

#### Commits attendus Phase 0
```
0.1  feat(content-studio-v2): scaffold route + feature flag CONTENT_STUDIO_V2_ENABLED
0.2  feat(content-studio-v2): typography (next/font, display + body + mono)
0.3  feat(content-studio-v2): design tokens (CSS vars + Tailwind extension)
0.4  feat(content-studio-v2): theme provider light/dark + persistance
0.5  chore(content-studio-v2): install Radix + sonner + framer-motion + lucide + dnd-kit + cropping
0.6  feat(content-studio-v2): primitives (Button, Input, Dialog, Toast, Badge, Skeleton)
0.7  feat(content-studio-v2): _dev/preview page for visual QA
```

---

### Phase 1 — Layout & navigation (1-2j)

**But** : le shell v2 est en place. L'admin peut naviguer entre `/home`, `/create`, `/library`, `/plan` (chaque mode étant un placeholder pour l'instant).

#### Étapes

**1.1 — Sidebar navigation**
- `shell/Sidebar.tsx` : 4 entrées (Home, Create, Library, Plan) avec icons Lucide + labels. Active state via `usePathname()`. Collapse on mobile (drawer pattern via Radix Dialog).
- Logo FemiGlow en haut (réutiliser SVG existant).
- Footer sidebar : theme toggle + bouton "Voir ancien Studio" (lien `/admin/content-studio`).

**1.2 — Topbar**
- `shell/Topbar.tsx` : breadcrumb (Mode > Section > Action), recherche globale (Cmd+K placeholder pour Phase 7), user menu (Radix DropdownMenu).
- Notification bell (placeholder, on branchera S3.2 alerts plus tard).

**1.3 — Routes stubs**
- `home/page.tsx` : "Dashboard à venir (Phase 6)".
- `create/page.tsx` : "Liste idées + Nouveau (Phase 3)".
- `library/page.tsx` : "Library à venir (Phase 4)".
- `plan/page.tsx` : "Plan à venir (Phase 5)".

**1.4 — Empty states**
- Chaque route a une zone vide stylée (illustration légère + CTA "Commencer").

#### DoD Phase 1
- [ ] Navigation entre les 4 modes via sidebar fluide (transition framer-motion 200ms).
- [ ] Active state visuel correct.
- [ ] Theme toggle accessible depuis sidebar footer.
- [ ] Layout responsive : sidebar collapse < 1024px en drawer.
- [ ] Tests vitest : routes répondent, sidebar nav correct active.

#### Commits attendus Phase 1
```
1.1  feat(content-studio-v2): sidebar navigation + active state
1.2  feat(content-studio-v2): topbar with breadcrumb + user menu
1.3  feat(content-studio-v2): route stubs for 4 modes
1.4  feat(content-studio-v2): empty states with onboarding CTAs
```

---

### Phase 2 — Media foundation (4-5j)

**But** : ajout / édition de médias (image + vidéo) complètement intégré au Studio. C'est le **pilier P0** identifié dans l'audit.

#### Étapes

**2.1 — Backend : endpoint d'upload image avec crop**
- `POST /api/admin/content-studio/media/upload-and-crop`
- Body multipart : `file` (image), `crop` (JSON `{x, y, width, height, aspectRatio}`).
- Pipeline serveur :
  1. Stocker original dans `.media-storage/originals/`.
  2. Sharp : appliquer crop → résize aux 3 variantes (1024px, 768px, 320px thumbnail).
  3. Insérer en DB (`media` table existante) avec `kind='image'`, `compartment='imported'`, `original_url=...`.
  4. Retourner `StudioMediaItem`.
- Tests vitest + MSW pour le crop pipeline.

**2.2 — Backend : endpoint d'upload vidéo avec trim**
- `POST /api/admin/content-studio/media/upload-and-trim`
- Body multipart : `file` (mp4/mov), `trim` (JSON `{startSec, endSec, aspectRatio?}`).
- Pipeline :
  1. Stocker original.
  2. ffmpeg : `ffmpeg -i input.mp4 -ss <start> -to <end> -c:v libx264 -c:a aac output.mp4`.
  3. Si `aspectRatio` fourni : crop centré.
  4. Générer thumbnail (frame 1) via `ffmpeg -i ... -frames:v 1 thumb.jpg`.
  5. Insérer DB avec `kind='video'`, `original_url`, `thumbnail_url`.
- Limite taille : 200 MB upload (config). Durée max : 90s (Reels constraint).
- Tests vitest pour la validation + smoke côté CLI sur staging avec un MP4 test.

**2.3 — Frontend : Uploader component**
- `media/Uploader.tsx` : drag-and-drop zone + bouton "Choisir un fichier". Détection MIME (image/* | video/*). Progress upload (XHR streaming pour le %).
- Validation côté client : taille max, type accepté.
- Sur drop : ouvre `<ImageCropper>` ou `<VideoTrimmer>` selon kind.

**2.4 — Frontend : ImageCropper**
- `media/ImageCropper.tsx` : wrapper `react-easy-crop`.
- Toolbar : sélecteur ratio (Free / 1:1 / 4:5 / 9:16 / 16:9), zoom slider, rotate 90° button.
- Bouton "Valider" → POST upload-and-crop avec les paramètres crop.
- Tests : crop avec différents ratios produit le bon payload côté API.

**2.5 — Frontend : VideoTrimmer**
- `media/VideoTrimmer.tsx` : `<video>` HTML5 + slider double-handle (react-range) pour start/end.
- Preview en live (`video.currentTime` lié au handle).
- Durée affichée : "Sélectionné : 28.4s · max 90s".
- Bouton "Valider" → POST upload-and-trim.

**2.6 — Frontend : MediaPicker v2**
- `media/MediaPicker.tsx` : grid à 4 colonnes desktop / 2 mobile. Vignettes pour image (`<img>`) et vidéo (`<video poster=...>` muet, hover = play).
- Filtres : Compartiment (Importés / IA), Type (Image / Vidéo / Tous), Recherche (alt/slug).
- Bouton "Importer un média" → ouvre Uploader dans Dialog.

**2.7 — Frontend : PlatformPreview v2 — multi-format**
- `media/PlatformPreview.tsx` : prend `{platform, format, mediaUrl, mediaKind, caption}` et rend :
  - `instagram/post` → 4:5 cadre IG, header avatar, footer like/comment, caption truncated 2 lignes.
  - `instagram/story` → 9:16 cadre plein écran, gradient top/bottom, texte par-dessus.
  - `instagram/reel` → 9:16, video player avec controls IG-like.
  - `instagram/carousel` → 4:5 avec dots indicator.
  - `facebook/post` → 1.91:1 ou variable, mockup FB feed.
- Pour vidéo : preview avec `<video controls muted>`.

**2.8 — Service `.media-storage` ownership**
- Le pipeline upload écrit dans `.media-storage/` — vérifier que `nodeapp` peut écrire après build (cf. note dans les sessions précédentes).
- Script de post-deploy : `chown -R nodeapp:nodeapp .media-storage`.

#### DoD Phase 2
- [ ] Upload image 1080×1080 + crop 4:5 fonctionne end-to-end, le résultat est dans la `MediaPicker`.
- [ ] Upload vidéo 60s + trim à 30s fonctionne, le résultat (mp4 trimmé) est dans la `MediaPicker`.
- [ ] PlatformPreview affiche correctement les 5 combos (post, story, reel, carousel, facebook).
- [ ] Tests vitest pour les 4 composants media + 2 endpoints backend.
- [ ] Smoke live : upload réussi sur staging (image + vidéo), thumbnails générées.
- [ ] 0 régression ancien Studio.

#### Commits attendus Phase 2
```
2.1  feat(content-studio-v2): POST /media/upload-and-crop (sharp pipeline + tests)
2.2  feat(content-studio-v2): POST /media/upload-and-trim (ffmpeg pipeline + tests)
2.3  feat(content-studio-v2): Uploader component (drag-drop + progress)
2.4  feat(content-studio-v2): ImageCropper (react-easy-crop, 5 ratios)
2.5  feat(content-studio-v2): VideoTrimmer (HTML5 + slider start/end)
2.6  feat(content-studio-v2): MediaPicker v2 (grid + filters + type-aware)
2.7  feat(content-studio-v2): PlatformPreview v2 (5 formats fidèles)
2.8  chore(deploy): ensure .media-storage owned by nodeapp after deploy
```

---

### Phase 3 — Mode `/create` (4-5j)

**But** : l'écran de création de zéro. Stepper + intention + variants compare + médias + preview + actions publication.

#### Étapes

**3.1 — StudioContext + hooks state**
- `lib/content-studio-v2/state/StudioContext.tsx` : provider + reducer.
- `useStudio()`, `useDraft()`, `useDraftAutosave()` hooks.
- Tests des hooks avec @testing-library/react-hooks.

**3.2 — Stepper persistant**
- `create/Stepper.tsx` : 4 étapes (Cadrer / Générer / Visuel / Valider).
- Étape active déduite du state du draft (`status` + présence média + caption non vide).
- Click sur étape passée → scroll smooth vers la section correspondante.

**3.3 — IntentionForm v2**
- `create/IntentionForm.tsx` : remplace `IdeaForm` ancien. Layout 2 colonnes : champs (pilier/objectif/format) + textarea intention.
- **Format = top-level radio** : Post / Story / Reel / Carousel — c'est le moment où "image vs vidéo" est tranché (Reel/Story sous-entend vidéo possible, Post = image, Carousel = images).
- Bouton "Générer 3 variantes" avec loading state estimé (cf. 3.6 progress estimator).

**3.4 — VariantsCompare**
- `create/VariantsCompare.tsx` : 3 cards côte à côte (en grille collapse vertical sur mobile).
- Chaque card : caption, score, brand violations, bouton "Choisir cette variante".
- Diff visuel optionnel (toggle "Voir les différences" → highlight diff entre A et B/C).
- Le choix d'une variante = la `active` ; les 2 autres restent en memory pour comparaison.

**3.5 — Editor caption avec autosave**
- `create/CaptionEditor.tsx` : textarea contrôlée + indicator "Enregistré il y a 3s" / "Modification non sauvée" + spinner pendant la sauvegarde.
- `useDraftAutosave(draftId)` : `useDebouncedCallback` 1.5s + `PATCH /drafts/:id`.
- Optimistic locking : envoie `version: draft.version`, serveur rejette si conflit → toast "Conflit, recharger".

**3.6 — Progress estimator pour génération IA**
- `lib/content-studio-v2/state/useGenerationEstimator.ts` :
  - Stocke les durées de génération dans `localStorage` (rolling 20 last).
  - Au déclenchement : affiche une barre qui s'avance au rythme du p50.
  - Si dépasse p95 : message "C'est plus long que d'habitude…".
  - Si dépasse 2×p95 : "Probablement bloqué — vérifier les logs".

**3.7 — MediaStudio (intègre Phase 2)**
- `create/MediaStudio.tsx` : zone média de l'écran `/create`.
- Contenu : MediaPicker (compartiment Importés/IA) + Uploader + bouton "Générer visuel IA" (existant, conservé).
- Affiche le média sélectionné + bouton "Recadrer" qui ré-ouvre ImageCropper.

**3.8 — PreviewPane**
- Colonne droite fixe, `PlatformPreview` v2 + sélecteur de format actif (synchronisé avec IntentionForm).

**3.9 — Publish dropdown**
- `create/PublishActionGroup.tsx` : autosave indicator à gauche + dropdown bouton "Publier" avec 3 options (Maintenant / Programmer / Brouillon Postiz).
- Réutilise les endpoints de S2.3 phase e (`/publish-now`, `/schedule`, `/draft-on-provider`).
- Dialogs Radix au lieu de `window.confirm`.

#### DoD Phase 3
- [ ] Créer un draft de zéro (intention → 3 variants → choisir → ajouter média → publier) en moins de 3 minutes sur staging.
- [ ] Autosave testé : modification + switch draft + retour = caption persistée.
- [ ] Variants compare : on voit les 3 captions visuellement côte à côte.
- [ ] Progress estimator marche : la barre s'avance pendant les 10-20s de génération IA.
- [ ] Publication via les 3 modes fonctionne et n'utilise plus `window.confirm`.
- [ ] Tests vitest ≥ 25 nouveaux + 1 spec E2E happy path (publier un post en draft Postiz).

#### Commits attendus Phase 3
```
3.1  feat(content-studio-v2): StudioContext + hooks (useStudio, useDraft, useDraftAutosave)
3.2  feat(content-studio-v2): Stepper persistant 4 étapes
3.3  feat(content-studio-v2): IntentionForm v2 (format top-level)
3.4  feat(content-studio-v2): VariantsCompare (3-col + diff toggle)
3.5  feat(content-studio-v2): CaptionEditor + autosave (debounced + optimistic lock)
3.6  feat(content-studio-v2): generation progress estimator (p50/p95 from history)
3.7  feat(content-studio-v2): MediaStudio (Phase 2 integration)
3.8  feat(content-studio-v2): PreviewPane (format-aware multi-plateforme)
3.9  feat(content-studio-v2): PublishActionGroup (dropdown 3 modes + Radix dialogs)
```

---

### Phase 4 — Mode `/library` (2-3j)

**But** : voir + opérer sur tout ce qui existe.

#### Étapes

**4.1 — Grid view**
- `library/MediaGrid.tsx` : vignettes 4 cols desktop, vidéo poster ou image cropping centrée. Status badge en bas-droite. Hover = card élève + actions rapides (Éditer, Dupliquer, Archiver).

**4.2 — Filters**
- `library/Filters.tsx` : Statut (multiselect), Plateforme, Pilier, Format, Date range. URL params synchronisés (`?status=approved,scheduled&platform=instagram`).

**4.3 — Search**
- `library/SearchBar.tsx` : input + debounce 250ms. Recherche dans caption + alt média + tags.

**4.4 — Bulk actions**
- Checkbox sélection multiple, action bar fixe en bas quand ≥ 1 sélection : Approuver / Programmer / Archiver. Optimistic update + toast résultat.

**4.5 — Click → Open in /create**
- Cliquer une card → navigation `/admin/content-studio-v2/create/[draftId]`.

#### DoD Phase 4
- [ ] Grid affiche correctement 50+ posts (perf OK).
- [ ] Filtres URL-synchronisés (shareable links).
- [ ] Bulk approuver 3 drafts en 1 action.
- [ ] Tests vitest ≥ 8 + 1 spec E2E (filtrer + bulk-approve).

#### Commits Phase 4
```
4.1  feat(content-studio-v2): library grid view with thumbnails
4.2  feat(content-studio-v2): library filters (URL-synced)
4.3  feat(content-studio-v2): library search (debounced)
4.4  feat(content-studio-v2): bulk actions (approve/schedule/archive)
```

---

### Phase 5 — Mode `/plan` (3-4j)

**But** : calendrier interactif + visibilité sur les jobs.

#### Étapes

**5.1 — Calendar week/month/list**
- `plan/Calendar.tsx` : reprend la logique de `EditorialCalendar.tsx` mais avec rendu cards-image au lieu de texte. 3 modes via tabs (Semaine / Mois / Liste).

**5.2 — Drag-and-drop (@dnd-kit/core)**
- Chaque card-post est draggable. Chaque cellule de jour est droppable.
- On drop sur un nouveau jour : `PATCH /posts/:id/schedule` avec nouveau `scheduledAt` (même heure conservée).
- Optimistic UI + rollback en cas d'erreur serveur.
- A11y : keyboard drag (espace = pickup, flèches = move, entrée = drop) via @dnd-kit accessibility.

**5.3 — Double-clic → drawer édition rapide**
- `plan/QuickEditDrawer.tsx` : drawer latéral droit avec caption + horaire + bouton "Ouvrir en édition complète" (link vers `/create/[id]`).

**5.4 — Job queue panel**
- `plan/JobQueue.tsx` : liste des jobs `queued` + `publishing` + `failed` récents (< 7j). Retry/Cancel actions.

**5.5 — Filters & metrics**
- Mêmes filtres que `EditorialCalendar` existant + métriques en haut (Approuvés / Planifiés / Sent).

#### DoD Phase 5
- [ ] Drag un post de mardi à jeudi → DB updated + UI updated, optimistic.
- [ ] Drag à un jour passé → bloqué (toast erreur).
- [ ] Drawer édition rapide marche.
- [ ] Job queue affiche en temps réel (polling 30s ou SSE futur).
- [ ] Tests vitest ≥ 8 + 1 spec E2E (drag-drop reprogrammation).

#### Commits Phase 5
```
5.1  feat(content-studio-v2): calendar week/month/list views (image cards)
5.2  feat(content-studio-v2): calendar drag-and-drop reschedule (@dnd-kit)
5.3  feat(content-studio-v2): quick edit drawer
5.4  feat(content-studio-v2): job queue panel
5.5  feat(content-studio-v2): plan filters + metrics header
```

---

### Phase 6 — Mode `/home` (1-2j)

**But** : dashboard intégré, premier écran à l'arrivée, hub vers les autres modes.

#### Étapes

**6.1 — Réutiliser dashboard S3.3**
- `home/page.tsx` : importer `buildDashboardSnapshot` (déjà testé en S3.3) et rendre les widgets dans le design system v2 (cards thémées light/dark).

**6.2 — Cards cliquables → deep links**
- "Brouillons en attente" → `/library?status=needs_review`.
- "Prochaines publications" → `/plan?range=next7`.
- "Drafts Postiz en attente" → `/library?postiz_state=draft`.

**6.3 — Brand health card**
- Nouvelle card : "Score moyen brand des 30 derniers drafts" + "Top violations brand de la semaine" (réutilise `content_brand_review`).

**6.4 — Activity feed**
- Liste des 10 dernières actions admin (`audit_event`) en bas du home.

#### DoD Phase 6
- [ ] `/home` affiche tous les widgets dans les 2 themes.
- [ ] Tous les widgets sont cliquables et naviguent correctement.
- [ ] Activity feed paginé.
- [ ] Tests vitest ≥ 5.

#### Commits Phase 6
```
6.1  feat(content-studio-v2): home dashboard (themed S3.3 widgets)
6.2  feat(content-studio-v2): home cards deep-link to library/plan
6.3  feat(content-studio-v2): brand health card
6.4  feat(content-studio-v2): activity feed (audit events)
```

---

### Phase 7 — Polish & hotkeys (2-3j)

**But** : raffinements UX qui font la différence entre "fonctionne" et "agréable à utiliser".

#### Étapes

**7.1 — Cmd+K command palette**
- `shell/CommandPalette.tsx` : ouvert via Cmd+K (ou Ctrl+K Windows). Recherche fuzzy avec `cmdk` lib.
- Commandes : "Aller à Home/Create/Library/Plan", "Nouvelle idée", "Switch theme", "Voir ancien Studio", "Approuver le draft sélectionné", etc.

**7.2 — Hotkeys globaux**
- `lib/content-studio-v2/state/useHotkeys.ts` (wrap `react-hotkeys-hook`).
- `Cmd+S` → sauvegarde explicite (en plus de l'autosave).
- `Cmd+Enter` → action principale du contexte.
- `j/k` → navigate next/prev draft dans library/create.
- `?` → ouvre cheatsheet hotkeys.

**7.3 — Skeleton loaders**
- Toutes les zones de chargement asynchrone reçoivent un skeleton (pas de spinner solo).

**7.4 — Animations transitions**
- Framer-motion : transitions entrée/sortie des modals + drawer + steppers.
- Page transitions Next.js (fade subtil).

**7.5 — Toasts pour toutes les actions**
- Remplacer le pattern `message` actuel par `toast.success(...)` / `toast.error(...)`.

**7.6 — Tests E2E complets**
- `e2e/content-studio-v2/create-flow.spec.ts` : créer idée → générer → ajouter média uploadé → publier brouillon Postiz.
- `e2e/content-studio-v2/library-filters.spec.ts` : filtrer + bulk approve.
- `e2e/content-studio-v2/plan-drag-drop.spec.ts` : drag-drop reprogrammation.
- `e2e/content-studio-v2/theme-toggle.spec.ts` : toggle theme persistant.

#### DoD Phase 7
- [ ] Cmd+K marche, recherche les 15+ commandes.
- [ ] Hotkeys principaux marchent + cheatsheet `?` affichée.
- [ ] Animations fluides (pas de glitch sur theme switch).
- [ ] 4 specs E2E vertes (modulo flake auth orthogonal).
- [ ] Audit a11y (lighthouse ≥ 90 sur les 4 modes).

#### Commits Phase 7
```
7.1  feat(content-studio-v2): Cmd+K command palette (cmdk lib)
7.2  feat(content-studio-v2): global hotkeys + cheatsheet (?)
7.3  feat(content-studio-v2): skeleton loaders for async zones
7.4  feat(content-studio-v2): framer-motion transitions
7.5  feat(content-studio-v2): toasts (sonner) replacing inline messages
7.6  test(e2e): content-studio-v2 happy paths (4 specs)
```

---

### Phase 8 — Migration & sunset (1-2j)

**But** : basculer la v2 par défaut puis supprimer l'ancien.

#### Étapes

**8.1 — Bascule du flag**
- Confirmer 7j de QA staging par un admin sur la v2 (feedback collecté).
- Si OK : flipper `CONTENT_STUDIO_V2_ENABLED=true` côté prod.
- Mettre un redirect `/admin/content-studio → /admin/content-studio-v2/home` (via Next.js middleware).
- Garder l'ancien accessible 14j via `/admin/content-studio-legacy` (lien dans sidebar footer v2 "Ancien Studio").

**8.2 — Collecter télémétrie**
- Audit event `content_studio_v2.visited` à chaque visite d'un mode.
- Comparer avec `content_studio_legacy.visited` sur les 14j.
- Si 0 visite legacy pendant 7j consécutifs → supprimer le code legacy.

**8.3 — Suppression ancien code**
- Supprimer `components/admin/content-studio/` (toutes les v1).
- Supprimer `app/admin/content-studio-legacy/`.
- Garder uniquement ce qui est partagé : helpers, types, service backend.
- Renommer `content-studio-v2/` → `content-studio/` (perd le suffixe v2).
- Migration commit avec couverture tests ≥ 80% confirmée.

**8.4 — Documentation**
- README onboarding admin mis à jour : screenshots des 4 modes.
- ADR (Architecture Decision Record) sur la refonte.
- Cleanup des plan docs intermédiaires.

#### DoD Phase 8
- [ ] Flag flipped, prod sur v2 sans incident pendant 7j.
- [ ] Télémétrie confirme 0 utilisation legacy sur 7j.
- [ ] Ancien code supprimé sans casser les tests.
- [ ] Doc à jour.

#### Commits Phase 8
```
8.1  chore(content-studio): flip CONTENT_STUDIO_V2_ENABLED, redirect legacy
8.2  feat(content-studio): telemetry to measure v2 vs legacy usage
8.3  refactor(content-studio): remove legacy, promote v2 to default path
8.4  docs(content-studio): onboarding + ADR refonte
```

## 5. Tests strategy

### 5.1 Vitest unit + integration

| Couche | Type | Cible |
|---|---|---|
| Primitives | Snapshot + a11y | ≥ 15 tests (Phase 0) |
| Hooks state | Logic | ≥ 12 tests (Phase 3) |
| Components fonctionnels | Render + interaction | 3-5 par composant majeur |
| Endpoints API media | Integration | 8 tests (crop happy, error 413, video trim, etc.) |
| Helpers | Pure | 100% lignes |

Couverture cible : ≥ 80% sur `lib/content-studio-v2/` + `components/admin/content-studio-v2/`.

### 5.2 MSW integration

- Handlers Postiz (déjà créés en S2.3 phase e).
- Nouveau handler pour OpenAI image generation (utilisé par tests de progress estimator).
- 1 integration test par flow critique : `/create` end-to-end avec MSW intercepts.

### 5.3 Playwright E2E

- 4 specs (Phase 7.6).
- Run sur staging avec DATABASE_URL réelle.
- Skip si auth env pas valide (pattern existant `ensureAuthOrSkip`).

### 5.4 Tests visuels (manuel + tooling)

- Page `_dev/preview` : QA visuelle des primitives en light + dark.
- Screenshots Playwright à archivés dans `e2e/__snapshots__/v2/` (optionnel mais utile pour régression visuelle).

## 6. Runbook

### 6.1 Pré-flight Phase 0

```bash
cd /var/www/femiglow-staging
git status --short                     # vide
git pull --rebase origin master
cd apps/web
npx vitest run src/lib src/app --silent 2>&1 | tail -3
# baseline : 4842+ passed, 1 pre-existing flake (seed-mapping) à ignorer
```

### 6.2 Smoke per-phase

Après chaque phase, exécuter :
```bash
# Build
npm run build
chown -R nodeapp:nodeapp .next
systemctl restart femiglow-staging.service
sleep 5
systemctl is-active femiglow-staging.service

# Smoke flag
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Cookie: $(cat /tmp/admin_session)" \
  http://127.0.0.1:8012/admin/content-studio-v2
# Attendu: 200 si flag=true, 404/message si false

# Smoke ancien (no regression)
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8012/admin/content-studio
# Attendu: 307 (login redirect) → ancien marche toujours

# .media-storage perms après upload media tests
chown -R nodeapp:nodeapp .media-storage
```

### 6.3 Validation QA admin (Phase 7 → 8)

Recette manuelle de 30 min par un admin volontaire :
1. Theme : toggle light/dark, refresh, persistant ?
2. Naviguer entre les 4 modes via sidebar.
3. Créer une idée → générer 3 variants → comparer → choisir → uploader une image → cropper en 4:5 → preview correcte → publier en draft Postiz.
4. Aller dans Library : filtrer par "scheduled" → vérifier la liste.
5. Aller dans Plan : drag-drop un post à un autre jour → vérifier DB.
6. Cmd+K → "approuver" → exécuté.
7. Hotkey `?` → cheatsheet visible.

### 6.4 Rollback

À tout moment avant Phase 8 :
```bash
# Désactiver flag (ne casse rien)
sed -i 's/CONTENT_STUDIO_V2_ENABLED=true/CONTENT_STUDIO_V2_ENABLED=false/' apps/web/.env
systemctl restart femiglow-staging.service
# La route v2 retourne "désactivé", l'ancien est seul accessible.
```

En Phase 8 (après bascule) :
```bash
# Revert le redirect
git revert <hash_8.1>
# Ancien Studio redevient accessible directement
```

## 7. Critères d'acceptation finaux

Mesurés en fin de Phase 7, avant bascule Phase 8 :

| # | Critère | Mesure |
|---|---|---|
| 1 | Création post (idée → publier brouillon) | < 3 min chrono, 1 admin novice |
| 2 | Tests vitest scope v2 | ≥ 80 nouveaux, 100% passed |
| 3 | 0 régression sur scope existant (lib + app routes) | confirmé par run full |
| 4 | Build production | OK, taille bundle < +15% par mode |
| 5 | a11y Lighthouse | ≥ 90 sur les 4 modes en light + dark |
| 6 | Upload + crop image (4 ratios) | fonctionne, persisté DB + media-storage |
| 7 | Upload + trim vidéo | fonctionne, mp4 trimmé, thumbnail générée |
| 8 | Drag-and-drop calendrier | fonctionne + a11y keyboard |
| 9 | Theme persiste après reload | OK light + dark + system |
| 10 | E2E Playwright happy paths | 4 specs vertes (modulo auth flake orthogonal) |

## 8. Métriques de succès post-déploiement

À monitorer 14 jours après Phase 8 :

1. **Temps moyen de création d'un post** : baseline (ancien) vs v2. Cible : -50%.
2. **Taux d'erreur création** : posts approuvés sans média / total posts. Cible : 0% (le nouvel UX rend l'oubli impossible).
3. **Utilisation des fonctions nouvelles** :
   - % drafts qui passent par "Compare variants" : cible > 60%.
   - % posts uploadés via Studio (vs venant de médiathèque externe) : cible > 70%.
   - % vidéos / % images : observation (baseline 0% vidéo).
4. **Theme split** : % light vs dark utilisateur.
5. **Cmd+K usage** : % d'actions déclenchées via palette : cible > 20% (signe d'adoption power user).
6. **0 incident production** sur les 14j.

## 9. Mockups demandés (Phase 0 sub-task)

Avant de lancer Phase 0, je peux générer **3 mini-mockups HTML/CSS comparatifs** :
- Mockup A : style Editorial élégant (Tobias/Newsreader)
- Mockup B : style Modern warm (Cabinet Grotesk/DM Sans)
- Mockup C : style Soft luxury (Garet/Söhne)

Chaque mockup rend le même écran (l'étape "Visuel" de `/create`) dans les 2 themes (light + dark). Tu pourras comparer visuellement avant de t'engager.

J'utilise le plugin `frontend-design` que tu viens d'installer pour suivre ses recommandations (typo distinctive, palette cohérente, animations subtiles, layout audacieux).

**Question à toi avant que je lance Phase 0** :
1. **Veux-tu les 3 mockups comparatifs** d'abord (recommandé, ~1h) ? Ou tu choisis directement A, B ou C sur la base des descriptions §2 ?
2. **Approche parallèle ou séquentielle** ? Phase 0-1-2 sont bloquantes, mais Phases 3-6 peuvent être faites en parallèle si tu acceptes que je travaille sur plusieurs branches.
3. **Cadence de validation** : tu valides à la fin de chaque phase (pull review) ou tu me laisses enchaîner et review en fin de cycle (Phase 7) ?

Une fois tes choix faits, j'attaque Phase 0.
