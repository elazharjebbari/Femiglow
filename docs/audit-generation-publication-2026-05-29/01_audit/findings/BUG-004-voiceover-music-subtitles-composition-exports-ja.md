# BUG-004 — Voiceover/music/subtitles/composition/exports jamais exposés au-delà du graphe: l'opérateur ne les reçoit jamais (fonctionnalité inatteignable)

| | |
|---|---|
| **Sévérité** | `blocker` |
| **Domaine** | voix-off |
| **Composant** | `src/lib/ai-engine/orchestrator.ts (GenerationResult, buildResultFromState), src/lib/ai-engine/bridge/content-studio-bridge.ts, src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx` |
| **Mode mock** | `broken` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le pipeline vidéo génère voiceover, music, subtitles, puis compose les muxe dans une vidéo finale (composeVideo) et transcode-export produit le MP4 final + thumbnail. L'opérateur devrait recevoir une vidéo avec voix-off, musique et sous-titres.

## État réel vérifié
Confirme. Nuance sur le framing 'travail produit puis jete': en MOCK l'audio voiceover/music n'est PAS reellement produit (lavfi echoue, asset vide), donc rien a jeter pour ces deux-la. Le SRT EST produit sur disque et la composition tentee. Le defaut de DTO est reel et persisterait apres correction de lavfi; mais le blocage proximal aujourd'hui est voix-off-1/4.

## Écart
Tout le travail audio/sous-titres/composition/export est produit côté serveur puis jeté avant d'atteindre l'API, le bridge et l'UI. Annoncé mais inatteignable pour l'opérateur.

## Cause racine
Le DTO de sortie de l'orchestrateur n'a jamais été étendu pour inclure les médias composés/audio; seul 'videos' (assets pré-compose) est propagé, et de plus l'asset video du flux mock est vide (cf voix-off-1/4).

## Preuves
- orchestrator.ts:30-45 interface GenerationResult: pas de voiceover/music/subtitles/composition/exports
- orchestrator.ts:116-130 buildResultFromState: ne mappe pas ces champs
- Probe API: clés de la réponse = ['bridgeResult','caption','contentStudioUrl','costTracking','durationMs','errors','hashtags','images','jobId','moderationResult','qualityScores','reviewPayload','script','status','videos'] — 'has voiceover key: False', 'has music key: False', 'has subtitles key: False'
- GenerationResult.tsx:30-43 GenerationResultData: champs script/caption/hashtags/images/videos/qualityScores/costBreakdown/totalCostCents uniquement
- create/page.tsx:604-637 normalizeResultData: n'extrait pas voiceover/music/subtitles
- content-studio-bridge.ts:106-193: lit script/caption/hashtags/images/qualityScores, jamais l'audio

## Reproduction
1. POST MOCK reel valide (voir voix-off-1). 2. Inspecter JSON: aucune clé voiceover/music/subtitles. 3. Lire GenerationResult.tsx: aucun rendu audio/sous-titres.

## Piste de correction
Étendre GenerationResult + buildResultFromState pour inclure voiceover, music, subtitles, composition, exports, thumbnails; propager via l'API; étendre GenerationResultData et normalizeResultData et ajouter un rendu (lecteur audio, lien SRT, vidéo composée) dans GenerationResult.tsx. Le bridge doit aussi lier la vidéo composée/exportée comme asset primaire.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie par lecture code ET probe API live. orchestrator.ts:30-45 (GenerationResult) et :116-130 (buildResultFromState) ne contiennent aucune cle voiceover/music/subtitles/composition/exports/thumbnails. La route generate/route.ts:125 NextResponse.json({...result}) ne peut exposer que GenerationResult. Probe live reel/inspiring: top-level keys sans voiceover/music/subtitles/composition/exports/thumbnails (tous has-key=False). generate-stream/route.ts:198-211 construit le MEME GenerationResult ampute -> aucune voie API n'expose l'audio. GenerationResult.tsx:30-43 sans champ audio. content-studio-bridge.ts ne lit jamais l'audio.
- **Contre-preuve / nuance :** Probe API confirme l'absence des 6 cles. generate-stream/route.ts:198-211 omet aussi voiceover/music/subtitles/composition/exports/thumbnails. isGraphInterrupted (orchestrator.ts:88-99) omet aussi l'audio du payload review.

> Réf. registre : `bug-register.csv` ligne `BUG-004` · matrice : `gap-matrix.csv`.
