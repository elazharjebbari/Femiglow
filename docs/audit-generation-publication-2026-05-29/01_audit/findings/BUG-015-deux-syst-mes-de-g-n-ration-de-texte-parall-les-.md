# BUG-015 — Deux systèmes de génération de texte parallèles non connectés (operator create vs AI-Engine LangGraph)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | copywriting |
| **Composant** | `src/lib/content-studio/generation.ts (B) vs src/lib/ai-engine/nodes/generate-script|caption|variants.ts (A); bridge content-studio-bridge.ts` |
| **Mode mock** | `partial` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le parcours opérateur exploite le moteur AI-Engine (16 nœuds: script, caption, variants, voix-off, musique...) via le bridge.

## État réel vérifié
Le create flow (CreateWorkspace.tsx:196) appelle /api/admin/content-studio/ideas/:id/generate -> generateForIdea (système B, fallback déterministe). Les nœuds AI-Engine (système A, prompts riches J-Beauty) ne sont importés QUE par nodes/index.ts et graph/builder.ts, atteignables uniquement via /api/admin/ai-engine/generate. Le bridge est unidirectionnel (AI-Engine -> Content-Studio) et n'est jamais déclenché par le parcours opérateur.

## Écart
L'opérateur n'atteint JAMAIS les prompts de copywriting soignés (frameworks PAS/AIDA/BAB de generate-caption.ts, stratégie hashtags niche/mid/broad, script structuré). Il reçoit le template basique de generation.ts. Voix-off/musique/sous-titres/variants LLM sont hors de portée du parcours create.

## Cause racine
Architecture à deux pipelines jamais fusionnés; le bridge ne couvre que le sens AI-Engine -> CS. CreateWorkspace ne référence aucune route /api/admin/ai-engine/*.

## Preuves
- grep importers: 'generate-script|generateScriptNode|generate-caption|generate-variants' -> seulement src/lib/ai-engine/nodes/index.ts et src/lib/ai-engine/graph/builder.ts (hors tests)
- CreateWorkspace.tsx:196 `fetch('/api/admin/content-studio/ideas/${idea.id}/generate', ...)` — aucune mention d'ai-engine
- grep 'ai-engine' src/app/api/admin/content-studio -> seul models/route.ts (discovery), pas la génération
- content-studio-bridge.ts:89-91 createIdea avec mapPillar/mapObjective => sens A->B uniquement

## Reproduction
Tracer le clic 'Générer' depuis /admin/content-studio-v2/create: il POST /api/admin/content-studio/ideas/:id/generate (système B). Comparer avec POST /api/admin/ai-engine/generate (système A) qui produit script/caption via les nœuds LangGraph.

## Piste de correction
Décider d'un pipeline unique. Soit brancher generateIdeaDrafts sur runGeneration(AI-Engine) via un nouveau bridge B->A, soit retirer le système A du périmètre opérateur et clarifier que generation.ts est la seule source. Documenter le choix.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** CreateWorkspace.tsx:196 fait `fetch('/api/admin/content-studio/ideas/${idea.id}/generate')` (systeme B). grep des importeurs de generate-script/generateScriptNode/generate-caption/generate-variants (hors tests et hors les fichiers nodes eux-memes) -> SEULEMENT src/lib/ai-engine/nodes/index.ts et src/lib/ai-engine/graph/builder.ts. grep 'ai-engine' sous src/app/api/admin/content-studio -> seul models/route.ts (discovery), aucune route de generation. content-studio-bridge.ts:81 `bridgeToContentStudio` + mapPillar/mapObjective = sens AI-Engine -> Content-Studio uniquement; aucun pont B->A. L'operateur n'atteint donc jamais les prompts riches (PAS/AIDA/BAB de generate-caption.ts, hashtags niche/mid/broad, script structure). Severite major justifiee.
- **Contre-preuve / nuance :** Aucune. Confirme par grep + lecture du bridge.

> Réf. registre : `bug-register.csv` ligne `BUG-015` · matrice : `gap-matrix.csv`.
