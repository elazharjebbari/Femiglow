# 07 — Stratégie de tests

Vitest (unit + integration MSW) + Playwright (E2E + a11y). Couverture cible 90 % sur `lib/video/**`, `components/kit/Video*`.

## 1. Pyramide

```
       +-------------------+
       |  E2E Playwright   |  ~ 5-8 specs
       +-------------------+
      +---------------------+
      |  Integration MSW    |  ~ 12 specs
      +---------------------+
     +-----------------------+
     |   Unit (Vitest)       |  ~ 55 specs
     +-----------------------+
```

Cible : 75 % unit, 18 % MSW, 7 % E2E.

## 2. Outillage

| Couche | Outil | Localisation |
|---|---|---|
| Unit | Vitest + Testing Library | Co-localisée `.test.ts(x)` |
| Integration | Vitest + MSW v2 + IFrame API mock | À côté + setup global |
| E2E | Playwright | `apps/web/e2e/video/*.spec.ts` |
| A11y | `@axe-core/playwright` | `apps/web/e2e/video/a11y.spec.ts` |
| Visual regression | Playwright `toHaveScreenshot` (backlog P4) | — |

## 3. Conventions

### 3.1 Nommage

- Fichier : `<source>.test.ts(x)` co-localisé.
- Describe : nom du composant / fonction.
- It : « doit … » en français.

### 3.2 Fixtures partagées

```ts
// apps/web/src/test/fixtures/video.ts
import type { RituelVideo, VideoChapter } from '@/lib/schemas';

export function makeChapter(over: Partial<VideoChapter> = {}): VideoChapter {
  return {
    key: 'paste',
    label: 'Paste',
    startSeconds: 0,
    ...over,
  };
}

export function makeRituelVideo(over: Partial<RituelVideo> = {}): RituelVideo {
  return {
    poster: { src: '/poster.jpg', alt: 'Geste paste sur ongle', width: 1080, height: 1920 },
    sources: { mp4: 'https://cdn.example.com/v.mp4', webm: 'https://cdn.example.com/v.webm' },
    captions: { fr: 'https://cdn.example.com/fr.vtt', ar: 'https://cdn.example.com/ar.vtt' },
    youtubeUrl: 'https://www.youtube.com/shorts/N2pDuciP4uQ',
    transcript: 'Paragraphe un.\n\nParagraphe deux.',
    posterCustom: undefined,
    chapters: [
      makeChapter({ key: 'paste', label: 'Paste', startSeconds: 0 }),
      makeChapter({ key: 'powder', label: 'Powder', startSeconds: 18 }),
      makeChapter({ key: 'step-4', label: 'Step 4', startSeconds: 42 }),
      makeChapter({ key: 'polissage', label: 'Polissage', startSeconds: 68 }),
    ],
    provenance: 'Filmé à l\'atelier de Rabat, mars 2026.',
    durationDisplay: '90″',
    accentColor: 'sauge',
    ...over,
  };
}
```

### 3.3 Mock YouTube IFrame API

```ts
// apps/web/src/test/mocks/youtube-iframe-api.ts
export function installYoutubeIframeMock() {
  const callbacks: { onStateChange?: (e: { data: number }) => void } = {};
  let currentTime = 0;
  let duration = 90;

  (window as unknown as { YT: unknown }).YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
    Player: class {
      constructor(_iframe: HTMLIFrameElement, opts: { events: typeof callbacks }) {
        Object.assign(callbacks, opts.events);
      }
      getCurrentTime = () => currentTime;
      getDuration = () => duration;
      destroy = () => {};
    },
  };

  return {
    triggerState: (state: number) => callbacks.onStateChange?.({ data: state }),
    setCurrentTime: (s: number) => { currentTime = s; },
    setDuration: (d: number) => { duration = d; },
  };
}
```

## 4. Tests par phase

### 4.1 Phase 0 — Quick wins iframe

- Étendre `YouTubeEmbed.test.tsx` (~4 cas) :
  - URL embed contient `mute=1`,
  - `cc_load_policy=1`,
  - `cc_lang_pref=fr`,
  - `enablejsapi=1` uniquement quand prop `enableJsApi` passée.
- Étendre `VideoPlayer4Gestes.test.tsx` (~3 cas) :
  - H2 contient « Quatre gestes » (pas « Cinq »),
  - section bg `#E8EDE3` (sauge pâle),
  - `provenance` rendue si présente dans video.

### 4.2 Phase 1 — Schema étendu

`apps/web/src/lib/schemas/page-content.test.ts` (étendre, ~15 cas) :

```ts
describe('videoChapterSchema', () => {
  it('accepte un chapitre valide', () => { /* ... */ });
  it('rejette une key non-kebab-case', () => { /* ... */ });
  it('rejette un label > 24 chars', () => { /* ... */ });
  it('rejette startSeconds < 0', () => { /* ... */ });
  it('rejette startSeconds > 600', () => { /* ... */ });
});

describe('rituelVideoSchema — extension phase 1', () => {
  it('accepte sans aucun champ étendu (rétrocompat)', () => { /* ... */ });
  it('accepte chapters triés', () => { /* ... */ });
  it('rejette chapters non triés', () => { /* ... */ });
  it('rejette chapters < 2', () => { /* ... */ });
  it('rejette chapters > 6', () => { /* ... */ });
  it('accepte provenance avec ponctuation finale', () => { /* ... */ });
  it('rejette provenance sans ponctuation', () => { /* ... */ });
  it('accepte durationDisplay 1-8 chars', () => { /* ... */ });
  it('accepte accentColor enum', () => { /* ... */ });
  it('accepte posterCustom optionnel', () => { /* ... */ });
});
```

`apps/web/src/data/mock/kit.test.ts` (étendre, ~3 cas) :
- `videoSrc` passe `rituelVideoSchema`.
- Exactement 4 chapitres dans le mock post-phase 1.
- `provenance`, `durationDisplay`, `accentColor` présents.

### 4.3 Phase 2 — `VideoPosterCover`

`apps/web/src/components/kit/VideoPosterCover.test.tsx` (nouveau, ~10 cas) :

```ts
describe('VideoPosterCover', () => {
  it('rend un <button> accessible avec aria-label dérivé de l\'alt', () => { /* ... */ });
  it('utilise posterCustom si fourni', () => { /* ... */ });
  it('fallback sur poster si posterCustom absent', () => { /* ... */ });
  it('applique la couleur d\'accent au bouton play', () => { /* ... */ });
  it('rend le badge durationDisplay si fourni', () => { /* ... */ });
  it('omet le badge si durationDisplay absent', () => { /* ... */ });
  it('au clic, appelle onPlay', () => { /* ... */ });
  it('au clic, monte YouTubeEmbed (played=true)', () => { /* ... */ });
  it('respecte prefers-reduced-motion (pas de scale hover)', () => { /* ... */ });
  it('cleanup à l\'unmount', () => { /* ... */ });
});
```

### 4.4 Phase 3 — `VideoChapters`

`apps/web/src/lib/video/chapters.test.ts` (nouveau, ~8 cas) :

```ts
describe('formatTimestamp', () => {
  it('formate 0 → "0:00"', () => { /* ... */ });
  it('formate 18 → "0:18"', () => { /* ... */ });
  it('formate 65 → "1:05"', () => { /* ... */ });
  it('clamp les négatifs à 0', () => { /* ... */ });
});

describe('activeChapterIndex', () => {
  it('retourne -1 si chapters vide', () => { /* ... */ });
  it('retourne 0 pour seconds < premier chapter', () => { /* ... */ });
  it('retourne l\'index du chapitre en cours via binary search', () => { /* ... */ });
});

describe('chapterProgress', () => {
  it('retourne 0 si durationSeconds <= 0', () => { /* ... */ });
  it('calcule progressInChapter [0..1]', () => { /* ... */ });
  it('calcule progressInVideo [0..1]', () => { /* ... */ });
});
```

`apps/web/src/components/kit/VideoChapters.test.tsx` (nouveau, ~10 cas) :

```ts
describe('VideoChapters', () => {
  it('rend une <nav> avec aria-label "Chapitres de la vidéo"', () => { /* ... */ });
  it('rend un <ol> avec un <li><button> par chapitre', () => { /* ... */ });
  it('le chapitre actif a aria-current="true"', () => { /* ... */ });
  it('le chapitre actif a une underline de l\'accent', () => { /* ... */ });
  it('au clic, appelle onSeek(startSeconds, chapterKey)', () => { /* ... */ });
  it('numérotation 01, 02, 03 zero-padded', () => { /* ... */ });
  it('timestamp formaté 0:18 par chapitre', () => { /* ... */ });
  it('focus visible au clavier', () => { /* ... */ });
});
```

### 4.5 Phase 4 — IFrame API tracker

`apps/web/src/lib/video/iframe-tracker.test.ts` (nouveau, ~10 cas) :

```ts
describe('loadYouTubeIframeApi', () => {
  it('retourne YT global si déjà disponible', () => { /* ... */ });
  it('injecte le script et résout à onYouTubeIframeAPIReady', () => { /* ... */ });
  it('mémoïse la promesse (idempotent)', () => { /* ... */ });
});

describe('attachVideoTracker', () => {
  it('émet onComplete à ENDED', async () => {
    const ctrl = installYoutubeIframeMock();
    const onComplete = vi.fn();
    await attachVideoTracker(makeIframe(), { onComplete, onProgress: vi.fn() });
    ctrl.triggerState(0 /* ENDED */);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it('émet onProgress(25) au franchissement 25 %', () => { /* ... */ });
  it('émet onProgress(50) au franchissement 50 %', () => { /* ... */ });
  it('émet onProgress(75) au franchissement 75 %', () => { /* ... */ });
  it('ne re-émet pas un palier déjà franchi', () => { /* ... */ });
  it('cleanup arrête l\'interval', () => { /* ... */ });
});
```

### 4.6 Phase 5 — Provenance + CTA post

Étendre `VideoPlayer4Gestes.test.tsx` (~5 cas) :
- Provenance rendue si `video.provenance` set.
- Provenance non rendue si absent.
- CTA `Voir le pack ci-dessous` rendu après transcription.
- CTA pointe vers `#commander-femiglow`.

### 4.7 Phase 6 — Admin

```ts
// apps/web/src/components/admin/kit/KitVideoEditor.test.tsx
describe('KitVideoEditor', () => {
  it('pré-remplit le form depuis l\'override existant', () => { /* ... */ });
  it('Save appelle PATCH /api/admin/kit/video avec body Zod valide', () => { /* ... */ });
  it('URL YouTube invalide → erreur affichée', () => { /* ... */ });
  it('Chapitres non triés → erreur de validation', () => { /* ... */ });
  it('Aperçu live met à jour à chaque keystroke', () => { /* ... */ });
  it('Publish désactivé si dirty', () => { /* ... */ });
  it('Reset ouvre modale RESET-VIDEO', () => { /* ... */ });
});

// API routes
describe('PATCH /api/admin/kit/video', () => {
  it('401 sans session admin', () => { /* ... */ });
  it('422 si body invalide Zod', () => { /* ... */ });
  it('200 + draft persisté si valide', () => { /* ... */ });
});
```

### 4.8 Phase 7 — Migration self-hosted

- Test variante `SelfHostedVariant` réutilise `VideoPosterCover` en mode `native`.
- Test bascule via flag `NEXT_PUBLIC_VIDEO_SOURCE`.
- Test tracking complet `onPlay`, `onEnded`, `onTimeUpdate` toujours OK.

### 4.9 Phase 8 — Playwright E2E

```ts
// apps/web/e2e/video/render.spec.ts
test.describe('Video section rendering', () => {
  test('@video rend la section avec poster + bouton play sauge', async ({ page }) => { /* ... */ });
  test('@video chapitres visibles avec numérotation 01/02/03/04', async ({ page }) => { /* ... */ });
  test('@video badge durée affiché sur poster', async ({ page }) => { /* ... */ });
});

// apps/web/e2e/video/interaction.spec.ts
test.describe('Video interactions', () => {
  test('@video click sur poster monte l\'iframe et masque le poster', async ({ page }) => { /* ... */ });
  test('@video click sur chapitre déclenche seek', async ({ page }) => { /* ... */ });
  test('@video click sur transcription révèle le texte', async ({ page }) => { /* ... */ });
  test('@video CTA post-vidéo scroll vers #commander-femiglow', async ({ page }) => { /* ... */ });
});

// apps/web/e2e/video/a11y.spec.ts
test('@video @a11y 0 violation axe sur /kit#video-gestes', async ({ page }) => { /* ... */ });
```

## 5. Non-régression (tests existants à préserver)

| Fichier | Risque |
|---|---|
| `VideoPlayer4Gestes.test.tsx` | Moyen — extension structure |
| `YouTubeEmbed.test.tsx` | Moyen — paramètres URL |
| `lib/video/youtube-url.test.ts` | Faible (pas modifié) |
| `feed.xml/route.test.ts` | Faible (videoSrc consommé) |

Stratégie : `pnpm vitest run` complet avant chaque commit.

## 6. Couverture

| Module | Branches | Functions | Lines |
|---|---|---|---|
| `lib/video/youtube-url.ts` | 90 % | 100 % | 95 % |
| `lib/video/chapters.ts` | 95 % | 100 % | 95 % |
| `lib/video/iframe-tracker.ts` | 80 % | 100 % | 90 % |
| `components/kit/Video*.tsx` | 85 % | 95 % | 90 % |
| `components/sections/VideoPlayer4Gestes.tsx` | 80 % | 100 % | 90 % |
| `components/admin/kit/KitVideoEditor.tsx` | 80 % | 90 % | 85 % |

Étendre `apps/web/vitest.config.ts` :

```ts
coverage: {
  include: [
    'src/lib/video/**',
    'src/components/kit/Video*.tsx',
    'src/components/sections/VideoPlayer4Gestes.tsx',
    'src/components/sections/YouTubeEmbed.tsx',
    'src/components/admin/kit/KitVideo*.tsx',
  ],
  thresholds: { branches: 85, functions: 95, lines: 90, statements: 90 },
}
```

## 7. CI

Étendre le workflow existant :

```yaml
- name: Video section tests
  run: pnpm --filter web vitest run \
    src/components/kit/Video \
    src/components/sections/VideoPlayer4Gestes \
    src/components/sections/YouTubeEmbed \
    src/lib/video \
    src/components/admin/kit/KitVideo

- name: Playwright video
  run: pnpm --filter web playwright test --grep '@video'
```

## 8. Tags Playwright

- `@video` — tous tests vidéo.
- `@video-render` — rendu visuel.
- `@video-interaction` — clic / clavier.
- `@video-admin` — éditeur admin (phase 6).
- `@a11y` — accessibilité.

## 9. Données de test E2E

### 9.1 Seed

```ts
// apps/web/e2e/fixtures/seed-video.ts
export async function seedVideoTestData() {
  // Met le mock TS dans l'état attendu (chapters + provenance set).
  // En phase 6, seed l'override DB pour tester le cascade.
}
```

### 9.2 Fixture auth admin

Réutilise `apps/web/e2e/fixtures/admin-auth.ts` (livré dans le plan SEO).

## 10. Anti-flake

- Pas de `setTimeout` arbitraire dans les tests. `expect.poll` ou `waitFor` uniquement.
- Mocker l'IFrame API YouTube dans les tests intégration (jamais d'iframe réelle).
- Reset DB entre suites E2E.
- `--workers=1` sur les suites qui touchent l'override DB.
- `--retries=2` en CI uniquement.

## 11. Visual regression (backlog P4)

Playwright `toHaveScreenshot` sur `section#video-gestes` (poster + bouton play + chapitres + provenance) avec threshold 0,3 %. Stocké dans `apps/web/e2e/video/__snapshots__/video-{viewport}.png`. Actualisation manuelle après refonte intentionnelle.

## 12. Métriques

| Métrique | Outil | Cadence |
|---|---|---|
| Couverture | Codecov | À chaque PR |
| Flake rate | GitHub Actions reruns | Hebdo |
| Latence Playwright `@video` | Playwright reporter | À chaque CI |
| Axe violations | A11y spec | À chaque PR |
