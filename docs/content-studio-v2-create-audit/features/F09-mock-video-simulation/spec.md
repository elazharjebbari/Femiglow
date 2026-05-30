# F09 — Mock Video Simulation

## Objectif
Fournir un chemin reproductible qui simule une génération vidéo IA en servant des fichiers MP4 statiques pré-générés. Permet de valider tout le flux reel/story sans dépendance externe.

## Importance
🟠 **P1** — sans mock vidéo, impossible de valider le flux reel en staging / E2E.

## Comportement attendu

### Assets statiques
3 fichiers à committer dans `apps/web/public/_media/content-studio/mock/` :
- `reel-9x16.mp4` (5s, 1080×1920, H.264 baseline + AAC, ~700 KB)
- `story-9x16.mp4` (3s, 1080×1920, H.264 baseline + AAC, ~500 KB)
- `poster-9x16.jpg` (frame du gradient, ~30 KB)

### Service
`generateMockVideo({ draftId, format })` :
- Lit le `format` du draft
- Sélectionne l'asset correspondant (reel → reel-9x16.mp4)
- Insère un row `media` kind=video
- Insère `content_asset_binding`
- Insère `content_generation_run` (provider=mock, model=mock-video-1.0, cost=0)

### Frontend
- PreviewPane affiche `<video controls poster={thumbnailUrl} src={previewUrl}>`
- Badge "Mode mock" visible (cf F19)

## Comportement actuel
Inexistant.

## Gaps
- G02 : pas de chemin vidéo (adressé ici)
- F09-LOCAL-1 : pas de variation visuelle entre 2 générations mock (toujours le même MP4) — acceptable en mock

## Propositions

### A — Single static asset per format
Un MP4 unique par format. Simple, déterministe.

### B — Random selection from N variants
Pool de 3-5 MP4 par format, sélection aléatoire à chaque génération.

### C — Procedural generation via ffmpeg-wasm
Générer un MP4 unique à chaque appel avec un texte personnalisé. Plus lourd.

## Recommandation
**A** — single asset. Suffisant pour démo / test. B et C envisageables en v2 si besoin.

## Implementation

### 1. Générer les MP4 via ffmpeg
Commande dans `data-contracts/api-mock-video-endpoint.yaml` (section `ffmpeg_recipe`).

Si ffmpeg pas disponible, fournir des assets pré-générés via Git LFS ou téléchargement manuel — documenter dans le runbook.

### 2. Service `generateMockVideo`
Cf F08 implementation.

### 3. URL servies par Next.js
Les fichiers sous `public/_media/...` sont servis automatiquement par Next.js. Aucun handler particulier.

### 4. PreviewPane
Déjà supporté (cf MediaStudio.tsx flow). Le composant lit `media.kind === 'video'` et rend `<video src={previewUrl}>`.

### 5. Badge Mock
Composant `MockModeBadge` rendu dans Stepper et PublishActionGroup, source de vérité = API `/health`.

## Tests
Voir `test-scenarios.yaml`.
