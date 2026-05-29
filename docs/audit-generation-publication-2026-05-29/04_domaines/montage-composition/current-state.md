## État réel constaté (preuves)

### A. Ce qui MARCHE réellement (vérifié par probes authentifiées MOCK)
- **ffmpeg/sharp présents** : `which ffmpeg` → `/usr/bin/ffmpeg` (v6.1.1), `ffprobe` présent ; `ffmpeg-static` bundlé (`apps/web/node_modules/ffmpeg-static/ffmpeg`).
- **upload-and-crop** : GET → 405 ; POST unauth → 401 ; POST multipart sans `crop` → 400 `invalid_input` "Paramètre crop manquant" ; crop x<0 → 400 zod fieldErrors. **Probe réel** : JPEG 200×200 + crop {0,0,100,100} → `201` `{media:{...previewUrl:/_media/content-studio-v2/mev2_.../preview.webp...}}`, fetch preview → `200 image/webp`, `file` = `RIFF Web/P VP8 100x100`. **Recadrage sharp réel fonctionnel.**
- **upload-and-trim** : POST multipart sans `trim` → 400 ; **Probe réel** : MP4 test 3 s + trim {0.5,2.0} → `201` `durationSec:1.5`, fetch trimmed.mp4 → `200 video/mp4` (`ISO Media MP4`, ffprobe durée 1.6 s), poster.jpg → `200 image/jpeg` (`JPEG 320x240`). **Découpe ffmpeg + poster réels fonctionnels.**
- Auth : `/api/admin/content-studio/health` → 200 authentifié.
- `CONTENT_STUDIO_V2_ENABLED=true`, `AI_ENGINE_ENABLED=true`, `MEDIA_STORAGE_DRIVER=local`, `MEDIA_LOCAL_DIR=/var/www/femiglow-staging/.media-storage`, `MEDIA_PUBLIC_BASE_URL=/_media`.

### B. Ce qui est CASSÉ / ISOLÉ
- **compose/transcode inatteignables par l'opérateur** : `MediaStudio` POSTe vers `/api/admin/content-studio/drafts/[id]/generate-visual` (système B `generateVisualForDraft`, aucun import compose/transcode). compose/transcode ne tournent que via `/api/admin/ai-engine/generate` (GET→405, route POST distincte du create flow).
- **Bridge ne propage pas le montage** : `content-studio-bridge.ts` ignore `composition/exports/thumbnails` (grep → 0 occurrence) ; binding image par `assetId` ('composed-img-…') introuvable en table media → catch silencieux (l.148-162).
- **Sous-titres jamais incrustés** : `compose.ts:42` lit `state.subtitles` mais ne l'utilise que comme `hasSubtitles` (booléen métadonnée, l.72/136). Chaîne ffmpeg sans `-c:s`/`subtitles=`. 211 `.srt` orphelins sur disque.
- **maxFileSizeMb / codec non appliqués** : `transcode-export.ts` retourne `maxFileSizeMb`/`codec` mais ne les compare/utilise jamais ; `libx264` codé en dur, `codec:'h264'` littéral.

### C. Décalage TEST ↔ RÉALITÉ
- `compose.test.ts`/`transcode-export.test.ts` font `vi.mock` de `sharp`, `fluent-ffmpeg`, `ffmpeg-static`, `node:fs/promises` (writeFile noop) → **le rendu réel n'est jamais exercé**.
- `.media-storage/ai-engine/` : **977 `.jpg`, 211 `.srt`, 0 `.mp4`**. Les `composed-*.jpg`/`export-*.jpg` font 10–14 octets, contenu ASCII = **`mock-image`** ; un seul vrai JPEG (23577 o). → artefacts de tests mockés, pas de vraies compositions.
- vitest : 1695 passed mais **EXIT 1** (unhandled rejection `Higgsfield video failed: content policy violation`, video-generation.test.ts) — rapport vert masquant un échec process.
- playwright : 37 passed / 2 FAILED, dont `create-mock-video.spec` timeout en attendant le bouton `Générer un visuel IA` (mismatch UI), hors pipeline média.

### D. Fragilités
- Stockage : compose/transcode écrivent en dur `process.cwd()/../../.media-storage/ai-engine` (contourne `getStorage()`), servi via `/_media/ai-engine` uniquement si driver=local (`media-files/route.ts:75`). upload v2 passe par `getStorage()`→local. Deux conventions.
- `upload-video.ts` utilise `process.env.FFMPEG_PATH ?? 'ffmpeg'` (PATH système) vs `ffmpeg-static` pour compose/transcode ; `FFMPEG_PATH` absent du `.env`.
- POST corps non-multipart → **500 internal_error** au lieu de 400 (probe réel).
- Rotation+crop : ordre `rotate→extract` avec coordonnées react-easy-crop — fidélité non testée pour angles non nuls.

### E. Mode mock vs live
- crop/trim : mode-agnostiques (pas de lecture `cs_generation_mode`) → works en mock ET live.
- compose/transcode : en LIVE, génération amont cassée (clés OpenAI/Higgsfield vides/incomplètes) → compose reçoit `videos=[]` → `createEmptyAsset('No video source available')`. En MOCK, mux jamais exercé réellement.