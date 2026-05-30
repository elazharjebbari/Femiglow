# BUG-034 — Le bridge ne propage pas composition/exports/thumbnails vers la bibliothèque

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | montage-composition |
| **Composant** | `src/lib/ai-engine/bridge/content-studio-bridge.ts` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Après génération AI-Engine, le média composé+exporté (vidéo/image finale, vignettes) apparaît dans la bibliothèque Content Studio et est publiable.

## État réel vérifié
Non seulement le bridge ignore composition/exports/thumbnails — ces champs ne sont meme pas inclus dans GenerationResult par orchestrator.buildResult, donc ils sont perdus avant d'atteindre le bridge. Le seul rattachement tente (images) echoue car generate-images produit un assetId synthetique sans row media correspondante. Resultat: aucune image/composition/export/vignette du Systeme A n'est persistee ni rattachee au draft.

## Écart
Même quand le graphe produit une composition réelle, elle est perdue : aucune URL d'export/vignette n'est persistée ni rattachée au draft. La bibliothèque n'affiche jamais le rendu monté.

## Cause racine
Le bridge a été écrit pour les métadonnées textuelles, pas pour les assets médias. Aucun mapping assetId AI-Engine → row table media.

## Preuves
- content-studio-bridge.ts:148-162 — bind par img.assetId, try/catch silencieux 'Media ID might not exist'
- content-studio-bridge.ts: aucune occurrence de composition/exports/thumbnails (grep)
- generate/route.ts:116 bridgeResult = await bridgeToContentStudio(result, parsed) — result.exports/composition jamais transmis

## Reproduction
1. POST /api/admin/ai-engine/generate (format post). 2. compose produit une image composée (provider 'compose'/'compose:mock'). 3. Le bridge tente upsertPrimaryAsset avec assetId 'composed-img-...' → introuvable en table media → catch silencieux. 4. Le draft créé n'a aucun asset.

## Piste de correction
Dans le bridge, persister composition/exports[*] via createMedia (table media) puis upsertPrimaryAsset avec l'ID réel. Mapper aussi thumbnails.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Verifie et meme PLUS grave que decrit. bridgeToContentStudio (content-studio-bridge.ts) ne lit que result.script/caption/hashtags/images et tente upsertPrimaryAsset({mediaId: realImage.assetId}) sous try/catch silencieux (153-162). Mais la cause racine est en amont: orchestrator.ts buildResult (116-131) NE RETOURNE PAS composition/exports/thumbnails — ces champs n'existent que dans l'initialState/finalState interne du graphe (182-184) et ne sont PAS dans l'interface GenerationResult publique (30-45). Le bridge ne peut donc meme pas les propager: ils sont absents du result. De plus generate-images.ts produit assetId='<adapter>-img-<ts>' (124) et ne cree JAMAIS de row media (grep createMedia generate-images.ts = vide), donc upsertPrimaryAsset insere un binding vers une mediaId inexistante -> echec FK avale en silence ou binding orphelin. Le rendu monte n'atteint jamais la bibliotheque.
- **Contre-preuve / nuance :** src/lib/ai-engine/orchestrator.ts:116-131 buildResult sans composition/exports/thumbnails (grep => seulement 182-184 dans l'initialState). src/lib/ai-engine/nodes/generate-images.ts:124 assetId=`${adapter.name}-img-${Date.now()}-${index}`; aucun createMedia. repository.ts:445-472 upsertPrimaryAsset insere dans contentAssetBindings une mediaId non validee.

> Réf. registre : `bug-register.csv` ligne `BUG-034` · matrice : `gap-matrix.csv`.
