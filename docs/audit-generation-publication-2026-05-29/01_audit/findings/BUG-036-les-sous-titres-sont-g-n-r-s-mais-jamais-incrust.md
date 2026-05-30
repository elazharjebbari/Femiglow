# BUG-036 — Les sous-titres sont générés mais jamais incrustés ni muxés par compose

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | montage-composition |
| **Composant** | `src/lib/ai-engine/nodes/compose.ts, src/lib/ai-engine/nodes/generate-subtitles.ts` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les sous-titres produits (SRT) sont incrustés (burn-in) ou attachés comme piste à la vidéo composée.

## État réel vérifié
composeNode lit state.subtitles (chaîne SRT) mais ne l'utilise QUE comme booléen de métadonnée generationParams.hasSubtitles. Aucune commande ffmpeg subtitles= / -c:s n'est émise. Les 211 fichiers .srt sur disque confirment la génération, mais compose les ignore.

## Écart
Promesse 'sous-titres' non tenue : la vidéo finale n'a ni incrustation ni piste de sous-titres.

## Cause racine
compose.ts n'implémente pas le filtre subtitles ffmpeg ; le SRT n'est même pas écrit comme input.

## Preuves
- compose.ts:42 const subtitles = state.subtitles as string|null
- compose.ts:72,136 unique usage = hasSubtitles: Boolean(subtitles) (métadonnée)
- compose.ts:80-120 inputs ffmpeg = [video, voiceover?, music?] — jamais le SRT ; outputOptions sans -c:s ni subtitles=
- ls .media-storage/ai-engine → 211 .srt présents (subtitles-*.srt) mais orphelins

## Reproduction
1. Exécuter le video_flow du graphe. 2. generate-subtitles écrit un .srt. 3. compose mux audio mais n'ajoute pas le SRT. 4. ffprobe sur la sortie → aucune piste subtitle.

## Piste de correction
Dans composeVideo, écrire le SRT temporaire et ajouter -vf subtitles=path (burn-in) ou -c:s mov_text + -i sous-titres pour piste soft.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie par lecture directe. compose.ts:42 lit const subtitles = state.subtitles as string|null et l'utilise UNIQUEMENT comme metadonnee booleenne hasSubtitles: Boolean(subtitles) (72 et 136). Les inputs ffmpeg (80-86) = [video, voiceover?, music?] — le SRT n'est jamais ajoute comme input, jamais ecrit en fichier temporaire, et les outputOptions (114-120) ne contiennent ni '-vf subtitles=' ni '-c:s'. grep 'subtitle|-c:s|-vf|srt' compose.ts ne renvoie que les usages metadonnee. 212 fichiers .srt orphelins sur disque confirment que generate-subtitles les ecrit mais compose les ignore.
- **Contre-preuve / nuance :** src/lib/ai-engine/nodes/compose.ts:42,72,136 (subtitles -> hasSubtitles metadonnee uniquement); 80-86 inputs = video+audio sans SRT; 114-120 outputOptions sans -c:s/-vf subtitles. ls .media-storage/ai-engine => 212 .srt presents.

> Réf. registre : `bug-register.csv` ligne `BUG-036` · matrice : `gap-matrix.csv`.
