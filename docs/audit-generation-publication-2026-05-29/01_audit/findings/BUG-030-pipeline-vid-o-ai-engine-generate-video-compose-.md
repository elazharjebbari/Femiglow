# BUG-030 — Pipeline vidéo AI-Engine (generate-video/compose) jamais exécuté en réel: zéro MP4 produit, déconnecté du flux opérateur

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-video |
| **Composant** | `src/lib/ai-engine/nodes/generate-video.ts + src/lib/ai-engine/nodes/compose.ts + .media-storage/ai-engine/` |
| **Mode mock** | `partial` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
generateVideoNode rend un MP4 via ffmpeg (drawtext par scène); composeNode mixe vidéo+voix+musique+sous-titres en MP4 final. Ces nodes sont les 'vraies' étapes vidéo de l'AI Engine.

## État réel vérifié
Aucun fichier .mp4 / video-* / voiceover-* / music-* dans .media-storage/ai-engine/ (977 .jpg dont la quasi-totalité 10-14 octets de stubs texte, + 210 .srt). Le pipeline vidéo AI-Engine n'a jamais produit de média réel dans cet environnement. De plus, le node n'est PAS atteint par le flux opérateur /create (aucun import croisé content-studio→ai-engine/nodes): l'opérateur utilise generateStudioVideo (mock asset statique), pas ffmpeg. Donc voix-off/musique/sous-titres/compose vidéo sont inaccessibles à l'opérateur.

## Écart
Toute la chaîne vidéo 'riche' (compose audio+sous-titres) est soit fantôme (jamais run avec succès) soit hors du chemin opérateur. Le mock opérateur sert juste un MP4 préenregistré sans aucune composition.

## Cause racine
Deux systèmes parallèles non reliés pour la vidéo; le pont content-studio-bridge ne ramène que des images (skip mock images) et n'achemine pas de vidéo. Les nodes vidéo ne sont validés qu'en tests avec ffmpeg mocké.

## Preuves
- ls .media-storage/ai-engine | extension → 977 jpg, 210 srt, 0 mp4
- ls video-* voiceover-* music-* → 'No such file or directory'
- grep ai-engine/nodes|generateVideoNode|composeNode dans src/lib/content-studio + create/ → NONE (create flow does NOT use AI-Engine nodes)
- generate-video.test.ts:20-40 → vi.mock('fluent-ffmpeg') save() fait setTimeout(end) sans écrire de fichier
- content-studio-bridge.ts:147-162 → ne bind que des images (realImage), aucune vidéo

## Reproduction
1) ls .media-storage/ai-engine → aucun mp4. 2) Déclencher /api/admin/ai-engine/generate format=reel → vérifier qu'un mp4 réel apparaît (probable: échec ou fallback url='' selon dispo ffmpeg/providers).

## Piste de correction
Décider si l'opérateur doit atteindre le pipeline AI-Engine vidéo (sinon documenter que /create ne fait que servir un mock). Si oui: brancher le bridge sur la vidéo composée et valider ffmpeg en prod.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie: (1) 0 fichier .mp4/video-*/voiceover-*/music-* dans .media-storage/ai-engine (977 jpg + 211 srt seulement). (2) Aucun import de ai-engine/nodes dans src/lib/content-studio/ ni create/ -> l'operateur passe par generate-visual route -> service.ts:398 generateStudioVideo (mock asset statique), JAMAIS par generateVideoNode/composeNode. (3) Le bridge content-studio-bridge.ts:147-162 ne bind QUE realImage (images non-mock), aucune propagation video. Donc voix-off/musique/sous-titres/compose video sont inaccessibles a l'operateur /create. Nuance ajoutee (sans changer severite): generateVideoNode:42-95 ECRIT bien un vrai MP4 via ffmpeg libx264 si execute — '0 mp4 sur disque' prouve seulement qu'il n'a jamais tourne avec succes dans cet env, pas une incapacite structurelle. La conclusion 'fantome + hors chemin operateur' tient.
- **Contre-preuve / nuance :** ls .media-storage/ai-engine: 977 jpg, 211 srt, 0 mp4. grep -rln 'ai-engine/nodes' src/lib/content-studio src/components/.../create -> aucun. service.ts:398 generateStudioVideo. content-studio-bridge.ts:148-153 realImage = images.find(provider && !startsWith('mock')); seul upsertPrimaryAsset(image), zero video. /api/admin/ai-engine/generate route = systeme separe (runGeneration).

> Réf. registre : `bug-register.csv` ligne `BUG-030` · matrice : `gap-matrix.csv`.
