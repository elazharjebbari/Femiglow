# BUG-035 — Les tests de compose/transcode mockent intégralement sharp+ffmpeg+fs — zéro preuve réelle, artefacts de 10 octets sur disque

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | montage-composition |
| **Composant** | `src/lib/ai-engine/nodes/compose.test.ts, transcode-export.test.ts, .media-storage/ai-engine/*` |
| **Mode mock** | `untested` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les tests verts (1695 passed) prouvent que la composition et le transcodage produisent des médias valides.

## État réel vérifié
compose.test.ts/transcode-export.test.ts font vi.mock de 'sharp', 'fluent-ffmpeg', 'ffmpeg-static' ET 'node:fs/promises' (writeFile→noop). Aucun pixel/octet réel n'est produit en test. Les 977 .jpg dans .media-storage/ai-engine font 10 ou 14 octets et contiennent le texte ASCII 'mock-image' ; un seul vrai JPEG (23577 octets) existe. Aucun .mp4 (0).

## Écart
Le rendu monté réel (overlay SVG, amix audio, copy/transcode H.264) n'est exercé par AUCUN test. Un rapport tout-vert masque un pipeline jamais validé bout-en-bout avec les vraies libs.

## Cause racine
Stratégie de test 100% mock sur les dépendances natives lourdes ; aucun test d'intégration avec ffmpeg/sharp réels (pourtant installés sur le serveur).

## Preuves
- compose.test.ts:19-63 vi.mock('node:fs/promises' writeFile noop), vi.mock('sharp'), vi.mock('fluent-ffmpeg'), vi.mock('ffmpeg-static')
- file .media-storage/ai-engine/composed-*.jpg → 'ASCII text, with no line terminators' (10 octets, contenu xxd = 'mock-image')
- ls .media-storage/ai-engine | sed extension → 977 jpg, 211 srt, 0 mp4
- tailles composed-*.jpg: 375×10o, 225×14o, 1×23577o

## Reproduction
1. head -c10 composed-*.jpg → 'mock-image'. 2. grep vi.mock compose.test.ts → sharp/fluent-ffmpeg/fs mockés. 3. Constater qu'aucun assert ne porte sur des octets JPEG/MP4 réels.

## Piste de correction
Ajouter un test d'intégration (tag e2e/integration) qui exécute composeNode/transcodeExportNode SANS mock contre ffmpeg/sharp réels sur un petit clip, et vérifie ffprobe (durée/codec) + magic bytes JPEG.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie integralement. compose.test.ts (19,30,41,59) et transcode-export.test.ts (19,30,41,63) font vi.mock de node:fs/promises (writeFile->noop, readFile->'mock image data', stat->{size:1024}), sharp (toBuffer->'composed image'), fluent-ffmpeg (end fire immediatement) et ffmpeg-static. Aucune assertion sur magic bytes JPEG/MP4 ou ffprobe (grep ffprobe|magic|ffd8|moov|ftyp = vide). Sur disque .media-storage/ai-engine: 977 jpg, 212 srt, 0 mp4. Les composed-*.jpg font 10o (375 fichiers) ou 14o (225 fichiers), contenu ASCII 'mock-image' — ces 10 octets viennent des tests d'integration pipeline-real.test.ts:61 et budget-guard.test.ts:56 (sharp.toBuffer->Buffer.from('mock-image')) ecrits via fs reel. Un seul vrai JPEG (23577o) et un seul vrai export (19690o). Aucun pipeline ffmpeg/sharp reel valide bout-en-bout par les tests.
- **Contre-preuve / nuance :** grep 'vi.mock' compose.test.ts => node:fs/promises, sharp, fluent-ffmpeg, ffmpeg-static tous mockes. ls .media-storage/ai-engine: 977 jpg / 212 srt / 0 mp4; tailles composed-*.jpg = {375x10o, 225x14o, 1x23577o}. head -c40 composed-*.jpg = 'mock-image'. pipeline-real.test.ts:61 toBuffer:()=>Buffer.from('mock-image'). Aucune assertion ffprobe/magic-byte dans les .test.ts.

> Réf. registre : `bug-register.csv` ligne `BUG-035` · matrice : `gap-matrix.csv`.
