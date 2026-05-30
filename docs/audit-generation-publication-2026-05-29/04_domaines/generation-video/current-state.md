# Domaine Génération Vidéo — État RÉEL constaté (preuves)

## Architecture: deux systèmes, l'opérateur n'en touche qu'un
- Flux opérateur `/create` (système B) → `content-studio/video-generation.ts::generateStudioVideo`. NE touche PAS les nodes AI-Engine (grep: aucun import `ai-engine/nodes` dans `src/lib/content-studio` ni dans `create/`).
- Pipeline LangGraph (système A: `generate-video.ts`, `compose.ts`) exposé seulement via `/api/admin/ai-engine/generate`. Voix-off/musique/sous-titres/compose vidéo → hors de portée opérateur.

## MOCK (vérifié en exerçant) — WORKS
- Probe POST authentifiée (cookie `cs_generation_mode=mock`, kind=video, model=mock-video-1.0, draft reel réel `cd_84zknq6becu7x4oq`) → **HTTP 200**, `media.previewUrl=/_media/content-studio/mock/reel-9x16.mp4`, `thumbUrl=poster-9x16.jpg`, 1080x1920, durationMs=5000.
- Asset présent: `reel-9x16.mp4` 62790 o (`file` → ISO Media MP4). Servi: `curl -I` → **HTTP 200 video/mp4**. story-9x16.mp4, poster-9x16.jpg, sample-1080.png également servis 200.
- VideoPlayer.tsx:118 rend `<video src={media.previewUrl}>` → lecture OK.

## E2E create-mock-video:8 — ÉCHEC, mais bug du TEST
- `/tmp/audit-playwright.log:114-128`: « Test timeout of 30000ms exceeded » en attente de `getByRole('button',{name:/Générer un visuel IA/i})`.
- Cause: MediaStudio.tsx:240 → en kind=video le bouton s'appelle **« Générer une vidéo IA »**. Le page-snapshot Playwright confirme le bouton `[ref=e239] « Générer une vidéo IA »` présent. L'app fonctionne; le sélecteur du test est obsolète. (Le 2e test, ligne 51, passe car il bascule en kind=image → libellé « Générer un visuel IA ».)

## LIVE — BROKEN (déterminé statiquement; POST live volontairement non exécuté, hors périmètre)
- Env: `AI_ENGINE_HIGGSFIELD_API_KEY` = un token mono-partie sans `:` ; `AI_ENGINE_HIGGSFIELD_API_SECRET` = vide. → `higgsfieldAuthHeader()` = null (higgsfield-auth.ts:31-37).
- video-generation.ts:104-116: model `hf-*` + auth null → `throw HttpError('invalid_state','...credential Higgsfield incomplet...')`. Confirmé par le test :111-122.
- Même avec credential: endpoints codés SYNC faux (`/v1/videos/generate` :157, `/v1/videos/status/{id}` :187) ≠ API réelle async (`/v1/image2video/<model>` + `/v1/requests/{id}/status`), aveu TODO :153-155 et higgsfield-auth.ts:14-16.

## Desync picker↔backend — CRITICAL
- `curl /models?role=video` → 8 modèles higgsfield `source:live` (cinematic_studio_3_0, veo3_1, kling3_0, wan2_7, seedance_2_0, minimax_hailuo, marketing_studio_video, soul_cast) + 4 `hf-video-*` static + mock-video-1.0; suggested=mock-video-1.0.
- video-generation.ts ne route que `/^mock-/` et `startsWith('hf-')`. Un modèle live-discovered en live → :119 throw « aucun modèle vidéo live disponible » (message trompeur). Défaut mock = sûr.

## Pipeline AI-Engine vidéo — FANTÔME
- `.media-storage/ai-engine/`: 977 .jpg (majoritairement 10-14 o), 210 .srt, **0 .mp4, 0 video-*, 0 voiceover-*, 0 music-***.
- Les .jpg 10-14 o contiennent du texte: `mock-image`, `composed image` (xxd) → stubs de tests. generate-video.test.ts:20-40 mocke ffmpeg (save→end sans écriture).

## Pollution stockage prod par les tests — MAJOR
- Fichiers `composed-*.jpg`/`export-*.jpg` 10-14 o datés **18:33:17**, soit pendant l'audit vitest (Start 18:32:40 + 78s). compose.test.ts:34 `Buffer.from('composed image')`, transcode-export.test.ts:25 `Buffer.from('mock image data')`. MEDIA_DIR=`process.cwd()/../../.media-storage/ai-engine` (compose.ts:15) = stockage prod partagé; mock writeFile partiel inopérant.

## Vitest EXIT 1 masqué
- `/tmp/audit-vitest.log`: `Tests 1695 passed`, `Errors 1 error`, `VITEST_EXIT=1`. Unhandled Rejection `Higgsfield video failed: content policy violation` ❯ video-generation.ts:206 (test 'polling status=failed' :198-224, gestion fake-timers incorrecte).