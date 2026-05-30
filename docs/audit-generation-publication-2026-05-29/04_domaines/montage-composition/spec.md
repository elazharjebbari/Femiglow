## Spécification — Montage / Composition / Export (fonctionnement OPTIMAL attendu)

### 1. Périmètre opérateur (create flow) — montage par import
L'opérateur, depuis `/admin/content-studio-v2/create` → onglet média (`MediaStudio` → `MediaPicker` → `Uploader`), doit pouvoir :
- **Importer une image** (JPEG/PNG/WebP, ≤ 25 Mo), la **recadrer** (`ImageCropper`, ratios 1:1 / 4:5 / 9:16 / 16:9 / libre, zoom 1–3, rotation 90°), et obtenir un média réutilisable (preview 1080px WebP + thumb 320px WebP) rangé dans le compartiment `imported`.
- **Importer une vidéo** (MP4/MOV/WebM, ≤ 200 Mo), la **découper** (`VideoTrimmer`, plage ≤ 90 s), obtenir un MP4 H.264/AAC + poster JPEG (frame à 0,5 s), rangé `imported`.
- Le recadrage doit être **fidèle au cadre affiché**, y compris sous rotation.
- Les médias importés doivent être **immédiatement listés** dans le `MediaPicker` et **sélectionnables** comme média principal du draft, donc publiables.

### 2. Périmètre génération (AI-Engine graphe) — montage automatisé
Pour un format vidéo (reel/story/shorts/video), le graphe doit : générer la vidéo → voix-off → musique → sous-titres → caption → **compose** → **transcode-export** → quality → moderate → review.
- **compose (vidéo)** : muxer la voix-off (volume 1.0) et la musique (volume 0.3, amix `duration=longest`) sur la piste vidéo ; **incruster ou attacher les sous-titres** (SRT) ; produire un MP4 `+faststart`.
- **compose (image/carousel)** : recadrer/redimensionner l'image au spec plateforme (sharp `cover`), avec overlay de caption si demandé.
- **transcode-export** : ré-encoder H.264 (ou `spec.codec`) à la dimension plateforme, **respecter `maxFileSizeMb`** (re-compresser si dépassement), extraire une **vignette** (frame à 1 s).
- Le résultat (`composition`, `exports`, `thumbnails`) doit être **persisté via l'abstraction de stockage** (`getStorage()`) et **propagé par le bridge** dans la table `media` + rattaché au draft → visible en bibliothèque et publiable.

### 3. Cohérence mode mock/live
- Les opérations locales (crop/trim, compose sharp/ffmpeg) sont **déterministes et indépendantes du mode** : identiques en mock et live.
- Les opérations dépendant de providers (génération vidéo/voix/musique/image LIVE) doivent dégrader proprement en l'absence de clé : message d'erreur clair, pas de média corrompu, pas de placeholder publié par erreur.

### 4. Robustesse / erreurs
- Endpoints upload : 401 sans session, 403/invalid_state si v2 désactivé, 400 invalid_input pour fichier/champ manquant ou JSON invalide (y compris corps non-multipart), 429 rate_limited, 201 succès.
- ffmpeg/sharp doivent provenir d'un binaire **garanti** (ffmpeg-static), uniforme sur toute la chaîne.
- Stockage uniforme via `getStorage()` quel que soit le driver (local/vercelBlob/external).

### 5. Tests
- Au moins UN test d'intégration **sans mock** exécutant compose/transcode contre ffmpeg/sharp réels, vérifiant magic bytes (JPEG/MP4) et ffprobe (durée, codec, dimensions).