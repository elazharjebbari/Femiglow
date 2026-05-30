# BUG-026 — Deux systemes de generation image non connectes — le flux operateur n'atteint jamais le noeud LangGraph generate-images

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-image |
| **Composant** | `src/lib/ai-engine/nodes/generate-images.ts vs src/lib/content-studio/image-generation.ts + bridge` |
| **Mode mock** | `partial` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
L'AI-Engine LangGraph (16 noeuds) alimente la generation visuelle du Content Studio.

## État réel vérifié
Le flux create operateur (MediaStudio -> generate-visual -> generateStudioImage) est totalement separe du noeud generateImagesNode. Le bridge content-studio-bridge.ts n'importe PAS generateStudioImage ni generateImagesNode; generateImagesNode n'est appele que par /api/admin/ai-engine/generate (orchestrator) et les tests. Les deux chemins ont des routings, providers et fallbacks differents.

## Écart
Comportements divergents selon le point d'entree; le noeud LangGraph (provider defaut 'openai' via AI_ENGINE_DEFAULT_IMAGE_PROVIDER) tenterait un vrai appel OpenAI avec OPENAI_API_KEY puis fallback vers une URL mock fictive jamais ecrite (/_media/ai-engine/mock/mock-img-*.png -> 404), alors que le flux create produit un vrai PNG/AVIF servi.

## Cause racine
Deux implementations historiques paralleles (systeme A LangGraph, systeme B create) jamais unifiees. Le bridge ne relie pas la generation d'images.

## Preuves
- bridge imports: content-studio/repository + ../orchestrator uniquement (grep: aucune ref a generateStudioImage/generateImagesNode dans le bridge)
- grep generateImagesNode src/ -> seulement nodes/index.ts export + fichiers .test.ts (aucun appelant applicatif hors orchestrator)
- generate-images.ts:161 if(config.providers.image.default==='mock') sinon generateProviderImage; env AI_ENGINE_DEFAULT_IMAGE_PROVIDER=openai
- generate-images.ts:57-67 generateMockImage renvoie url=/_media/ai-engine/mock/${id}.png (jamais ecrit sur disque)
- service.ts:308 generateVisualForDraft appelle generateStudioImage (systeme B), pas le noeud

## Reproduction
Comparer le chemin operateur (POST /api/admin/content-studio/drafts/[id]/generate-visual) vs POST /api/admin/ai-engine/generate: providers/fallback differents, le second renvoie des URLs mock non materialisees.

## Piste de correction
Decider d'une source unique de generation image. A minima documenter que le flux operateur = systeme B; si le noeud LangGraph doit servir, materialiser ses assets mock (ecrire le PNG) ou rediriger vers generateStudioImage via le bridge.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Le bridge (content-studio-bridge.ts) importe seulement content-studio/repository (l.1-7) et ../orchestrator types (l.14) — aucune ref a generateStudioImage ni generateImagesNode (grep confirme). generateImagesNode appele uniquement par graph/builder.ts:57 (via orchestrator /api/admin/ai-engine/generate) et tests — jamais par le flux create. service.ts:308 generateVisualForDraft appelle generateStudioImage (systeme B). generate-images.ts:57-67 generateMockImage renvoie url=/_media/ai-engine/mock/${id}.png — PROBE CONFIRME 404. AI_ENGINE_DEFAULT_IMAGE_PROVIDER=openai (env + engine-config.ts:63). Deux systemes divergents confirmes. Severity major coherente.
- **Contre-preuve / nuance :** Nuance: 'generateImagesNode appele seulement par orchestrator et tests' = exact (via graph/builder.ts:57), ce qui RENFORCE le finding. Pas de contre-preuve.

> Réf. registre : `bug-register.csv` ligne `BUG-026` · matrice : `gap-matrix.csv`.
