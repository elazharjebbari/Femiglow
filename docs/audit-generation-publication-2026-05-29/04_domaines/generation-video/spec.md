# Domaine Génération Vidéo — Fonctionnement OPTIMAL attendu

## 1. Parcours opérateur (flux /create, système B)
1. L'opérateur ouvre `/admin/content-studio-v2/create`, choisit un format vidéo-capable (`reel` ou `story`).
2. MediaStudio détecte `videoCapable` (VIDEO_FORMATS=['reel','story']) et passe `kind='video'` par défaut (radio « Vidéo » coché, `data-cs-kind="video"`).
3. Le ModelPicker `role=video` propose UNIQUEMENT des modèles réellement consommables par le backend, avec un défaut sûr (mock en l'absence de provider live opérationnel).
4. Le bouton « Générer une vidéo IA » (libellé conditionnel au kind) est actif dès qu'un draft est sélectionné.
5. Le toggle Mode (mock/live) pose le cookie `cs_generation_mode`. En mock: génération simulée, 0¢, aucun appel externe. En live: vrai provider, coûts réels, avertissement toast.

## 2. Génération MOCK (doit marcher toujours)
- POST `/api/admin/content-studio/drafts/{id}/generate-visual` body `{kind:'video', model, prompt, size, quality}`.
- Route lit le cookie → mode. `generateVisualForDraft` → `generateVideoForDraft` → `generateStudioVideo({format, mode:'mock'})`.
- Retourne l'asset statique du registre MOCK_ASSETS (reel-9x16.mp4 5s / story-9x16.mp4 3s), poster, 1080x1920, mime video/mp4, coût 0.
- L'asset DOIT exister sur disque ET être servi HTTP 200 `video/mp4` sous `/_media/content-studio/mock/`.
- VideoPlayer rend `<video src=previewUrl poster=thumbnailUrl autoPlay muted loop playsInline>` → lecture immédiate, badge VIDÉO + durée, contrôles play/mute.

## 3. Génération LIVE (Higgsfield)
- Pré-requis: credential complet `KEY_ID:KEY_SECRET` (via AI_ENGINE_HIGGSFIELD_API_KEY au format `id:secret` ou AI_ENGINE_HIGGSFIELD_API_SECRET séparé).
- Routage: tout modèle higgsfield (qu'il soit `hf-video-*` interne OU un id natif live-discovered) doit être routé vers l'adaptateur Higgsfield (idéalement sur `provider==='higgsfield'`, pas sur le préfixe `hf-`).
- Appels conformes à l'API réelle async: submit `POST /v1/image2video/<model>` (ou text2video), récupérer un id de requête, poll `GET /v1/requests/{id}/status` jusqu'à completion, extraire l'URL de sortie.
- Gestion d'erreurs: statut failed → erreur claire; timeout borné; 5xx → retry/poll continue; 4xx → erreur remontée.
- Le coût estimé doit refléter le modèle réel.

## 4. Pipeline AI-Engine vidéo (système A) — si exposé à l'opérateur
- `generateVideoNode`: rend un MP4 réel via ffmpeg (drawtext par scène) OU délègue au provider vidéo si configuré; écrit dans un stockage isolé du test.
- `composeNode`: mixe vidéo + voix-off (volume 1.0) + musique (volume 0.3-0.5, amix) + sous-titres, copie vidéo (-c:v copy) + AAC, faststart; produit un MP4 final lisible.
- Le bridge content-studio-bridge doit propager la vidéo composée vers la bibliothèque Content Studio (pas seulement les images).

## 5. Catalogue de modèles
- `GET /models?role=video` ne doit lister que des modèles dont le backend sait router et exécuter la génération, avec un flag `source` honnête (live = vraiment appelable).
- Le défaut suggéré doit être le modèle le plus sûr disponible.

## 6. Qualité / Tests
- La suite vitest doit sortir EXIT 0 quand tous les tests passent (aucune unhandled rejection).
- Les tests de nodes ne doivent JAMAIS écrire dans le stockage média réel (isolation tmpdir/env).
- Les sélecteurs E2E doivent refléter les libellés réels de l'UI (« Générer une vidéo IA » pour le kind vidéo).