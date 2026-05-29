# Spec — Voix-off / Audio (voiceover, music, subtitles) — fonctionnement optimal attendu

## 1. Périmètre et accès opérateur
- L'audio (voix-off, musique, sous-titres) fait partie du pipeline de génération de contenu **vidéo** (reel, story, shorts, video).
- L'opérateur doit pouvoir y accéder depuis un parcours unique et clair. Aujourd'hui deux parcours existent (`/create` content-studio et `/ai-engine/create` LangGraph). L'optimal: soit le `/create` principal déclenche le graphe complet et expose l'audio, soit l'UI documente sans ambiguïté que l'audio est exclusif à la page AI-Engine.

## 2. Routing du graphe
- `routeAfterScript`: format ∈ {reel, story, shorts, video} → `video_flow` → generateVideo → **generateVoiceover** → **generateMusic** → **generateSubtitles** → generateCaption → compose → transcodeExport → quality → moderate → review → variants.
- Les formats image/carousel/caption ne passent PAS par l'audio (attendu).

## 3. generate-voiceover
- **Mock**: produire un fichier audio silencieux **fiable** (sans dépendre de lavfi si le runtime ne le supporte pas — préférer un WAV PCM silencieux généré en buffer, ou un asset statique), durée = estimateDurationSeconds(text).
- **Live OpenAI**: POST api.openai.com/v1/audio/speech (tts-1, voice nova, mp3) → mp3 réel, coût ≈ chars/1M*1500 cents.
- **Live ElevenLabs**: POST text-to-speech (eleven_multilingual_v2) → mp3 réel, coût ≈ chars/1000*3 cents.
- **Erreurs**: en cas d'échec provider, fallback silencieux fonctionnel; si même le fallback échoue, le node doit **propager un StepError** (et ne pas laisser le job se déclarer completed avec url='').
- **Sortie**: MediaAsset { url non vide, mimeType, durationMs, provider, costCents } + voiceoverScript.

## 4. generate-music
- Idéal: vrai provider musical (mood-aware) si la musique est un objectif produit; sinon piste silencieuse **fiable** clairement étiquetée optionnelle.
- Durée alignée sur script.estimatedDurationSeconds ou la durée du voiceover.
- Mixage attendu (compose): voix-off à volume 1.0, musique à 0.3 (ducking).

## 5. generate-subtitles
- SRT synchronisé sur la durée **réelle** de la voix-off (pas seulement des estimations).
- Découpage multi-cue (≈2 lignes, ~42 chars/ligne) au lieu d'une troncature à 117 chars.
- Sortie exposée à l'opérateur (texte + lien fichier .srt).

## 6. compose + transcode-export
- composeVideo muxe vidéo + voix-off + musique (ducking) et burn/attache les sous-titres; transcode-export produit le MP4 final aux specs plateforme + thumbnail.
- La **composition** et les **exports** finaux doivent être les artefacts livrés à l'opérateur (pas les assets bruts).

## 7. Exposition (DTO/API/UI)
- GenerationResult (orchestrator) DOIT inclure: voiceover, music, subtitles, composition, exports, thumbnails.
- L'API `/api/admin/ai-engine/generate` propage ces champs.
- L'UI GenerationResult.tsx affiche: lecteur audio voix-off, indication musique, sous-titres (et leur fichier), vidéo composée/exportée jouable.
- Le bridge lie la vidéo composée/exportée comme asset primaire du draft.

## 8. Configuration et modes
- AI_ENGINE_DEFAULT_TTS_PROVIDER pilote mock|openai|elevenlabs|google; le provider sélectionné DOIT correspondre à une clé configurée (sinon dégrader explicitement, pas silencieusement).
- Cohérence des enums (tone, format) entre UI, DTO route et parse-brief.
- Le binaire ffmpeg (avec lavfi/filtres requis) DOIT être disponible et figé dans le runtime prod (setFfmpegPath + inclusion dans le bundle/standalone).

## 9. Invariant de vérité
- Un job ne peut être `completed` que si les artefacts annoncés (audio, vidéo) ont une url non vide et un fichier réel sur disque accessible via /_media. Sinon: statut dégradé ou échec explicite.