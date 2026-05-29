# État réel constaté — Voix-off / Audio (preuves)

## Architecture et atteignabilité
- Les nodes audio existent uniquement dans le graphe AI-Engine: `generate-voiceover.ts`, `generate-music.ts`, `generate-subtitles.ts`. Routing confirmé (builder.ts:139-142): generateVideo → generateVoiceover → generateMusic → generateSubtitles, atteint seulement via `video_flow` (routing.ts:12,18-22 pour reel/story/shorts/video).
- **Le flux opérateur principal `/create` n'a AUCUN lien avec l'audio**: `grep ai-engine src/lib/content-studio/` (hors tests) = vide; `grep voiceover src/components/.../create/` = vide; route `generate-visual` sans aucune référence audio. Le bridge `content-studio-bridge.ts` n'est importé QUE par `/api/admin/ai-engine/generate/route.ts:7`.

## MODE MOCK — exercé réellement (job ee13529b, format=reel, tone=inspiring, humanReviewRequired:false)
- Résultat API: `status: completed`, quality `average:0.91`. Cost breakdown: generate_script 0.0677, generate_voiceover 0, generate_music 0, generate_caption 0.0297.
- **MAIS** `videos: [('fallback','video/mp4','')]` — url vide.
- **Logs PM2 (preuve directe):**
  - `[ERROR] generate-video Video generation failed "Error: Input formats lavfi, lavfi are not available"`
  - `[WARN] generate-voiceover TTS failed, generating silent fallback "Input format lavfi is not available"`
  - `[ERROR] generate-voiceover Silent audio fallback also failed "Input format lavfi is not available"`
  - `[ERROR] generate-music Music generation failed "Input format lavfi is not available"`
  - Pourtant: `generate-voiceover Voiceover generated (1ms)`, `generate-music Music generated (1ms)`, `Generation completed (17362ms) ($0.0111)`.
- **Disque** (`.media-storage/ai-engine`): 0 `voiceover-*`, 0 `music-*`, 0 `video-*`, 0 `.mp4`. 601 `composed-*.jpg` (tous des runs flux image historiques). 1 nouveau `subtitles-ee13529b-...srt` (réel) créé par mon probe — bien formé (5 cues), servi en HTTP 200 via /_media.
- Avant mon probe, les 210 `subtitles-*.srt` sur disque provenaient TOUS de `job-sub-1` (jobId des tests unitaires generate-subtitles.test.ts:37) — preuve qu'aucun run réel n'avait produit de sous-titres avant.

## Réponse API — champs exposés
- Clés: bridgeResult, caption, contentStudioUrl, costTracking, durationMs, errors, hashtags, images, jobId, moderationResult, qualityScores, reviewPayload, script, status, videos.
- **Absents**: voiceover, music, subtitles, composition, exports, thumbnails. Confirmé par probe ('has voiceover key: False', etc.). Cause: orchestrator.ts GenerationResult (30-45) + buildResultFromState (109-131) ne les mappent pas. GenerationResult.tsx (30-43) idem. normalizeResultData (page.tsx:604-637) idem.

## Mismatch d'enum tone (échec pré-audio)
- Probe tone='empowering' → `status:failed`, `invalid_enum_value ... received empowering, options [professional,casual,playful,luxurious,educational,inspiring]`. parse-brief.ts:9 impose cet enum; l'UI (page.tsx:85-93) propose empowering/authentic/urgent. La génération échoue avant tout node, donc avant l'audio.

## MODE LIVE — non fonctionnel / non testé
- `AI_ENGINE_DEFAULT_TTS_PROVIDER=mock` (process environ + .env:129). ElevenLabs `configured:false` (clé len=0). OpenAI `configured:true` (OPENAI_API_KEY len=164, fallback engine-config.ts:75) mais jamais appelé en TTS car provider=mock. Music: aucun provider réel codé.
- Conformément au principe directeur: live = untested/broken.

## ffmpeg / lavfi
- En invocation shell directe, le binaire ffmpeg-static (resolved: node_modules/.pnpm/ffmpeg-static@5.3.0/.../ffmpeg) ET /usr/bin/ffmpeg supportent lavfi (anullsrc OK, fichiers wav produits). Pourtant le process serveur PM2 échoue avec 'Input format lavfi is not available' — divergence runtime (bundle/standalone Next ou détection de capacités fluent-ffmpeg dans le runtime tracé). Conséquence pratique: tout l'audio/vidéo mock par ffmpeg est mort dans le serveur en cours.

## Sous-titres (seul composant qui marche)
- generate-subtitles.ts = JS pur + writeFile, sans ffmpeg → fonctionne (SRT valide, servi). Limites: timings estimés (pas alignés sur l'audio), troncature dure à 117 chars (ligne 54), output non exposé.