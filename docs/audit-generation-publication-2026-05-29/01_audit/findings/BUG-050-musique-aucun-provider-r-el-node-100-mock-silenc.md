# BUG-050 — Musique: aucun provider réel — node 100% mock (silence). Aucune génération musicale n'existe

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | voix-off |
| **Composant** | `src/lib/ai-engine/nodes/generate-music.ts` |
| **Mode mock** | `broken` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
La 'génération de musique' suggère une vraie piste musicale adaptée au mood (musicMood) du script.

## État réel vérifié
Confirme. 'Musique' = stub silencieux non cable a aucun provider, et meme ce silence echoue (lavfi). Aucune capacite musique dans EngineConfig.

## Écart
La 'musique' est purement décorative: au mieux du silence, en pratique rien (lavfi échoue). Aucune voie live n'existe, même future.

## Cause racine
Fonctionnalité non implémentée au-delà d'un stub silencieux; pas de provider audio musical câblé dans la config (EngineConfig n'a pas de providers.music).

## Preuves
- generate-music.ts:30-48 generateSilentTrack via anullsrc/lavfi uniquement
- generate-music.ts:62 const costCents = 0; generate-music.ts:110 void config;
- engine-config.ts:6-21: providers = text|image|video|tts; pas de 'music'
- PM2 log job ee13529b: generate-music 'Music generation failed Input format lavfi is not available' -> asset url=''

## Reproduction
1. Lire generate-music.ts: aucun fetch provider. 2. POST MOCK reel: aucun fichier music-* créé.

## Piste de correction
Si la musique est un objectif produit: câbler un vrai provider (et l'ajouter à EngineConfig.providers.music) + exposer l'output (cf voix-off-2). Sinon documenter explicitement que 'music' = piste silencieuse facultative, et au minimum produire ce silence de façon fiable (sans lavfi).

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie par lecture. generate-music.ts: aucun appel provider musical; seule generation = generateSilentTrack via anullsrc/lavfi (:30-48). costCents=0 (:62), void config (:110). engine-config.ts:6-21 providers = text|image|video|tts, pas de 'music'. Piste silencieuse, de surcroit non produite (job 013c6ae7: 'Music generation failed Input format lavfi is not available', 0 fichier music-*). Aucune voie live.
- **Contre-preuve / nuance :** generate-music.ts:39-47 lavfi uniquement. engine-config.ts: aucun providers.music. PM2 job 013c6ae7: generate-music failed lavfi.

> Réf. registre : `bug-register.csv` ligne `BUG-050` · matrice : `gap-matrix.csv`.
