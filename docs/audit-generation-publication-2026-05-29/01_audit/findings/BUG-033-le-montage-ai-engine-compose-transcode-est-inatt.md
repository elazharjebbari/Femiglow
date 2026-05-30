# BUG-033 — Le montage AI-Engine (compose/transcode) est inatteignable par l'opérateur du create flow

| | |
|---|---|
| **Sévérité** | `major` (ajustée depuis critical) |
| **Domaine** | montage-composition |
| **Composant** | `src/lib/ai-engine/nodes/compose.ts, src/lib/ai-engine/nodes/transcode-export.ts, src/components/admin/content-studio-v2/create/MediaStudio.tsx` |
| **Mode mock** | `partial` |
| **Mode live** | `broken` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
L'opérateur génère du contenu et obtient un média composé (overlay caption, mux audio) puis transcodé/exporté au format plateforme.

## État réel vérifié
Le create flow (/admin/content-studio-v2/create -> MediaStudio) appelle generate-visual -> generateVisualForDraft (Systeme B) qui n'invoque jamais compose/transcode: aucune feature de MONTAGE (mux voix-off/musique, overlay caption, burn-in sous-titres, transcode au spec plateforme) n'est exercee dans ce parcours; l'operateur obtient une image generee ou un MP4 mock statique sans montage. compose/transcodeExport ne tournent que dans le graphe LangGraph, atteignable via une UI distincte (/ai-engine/create) — ils ne sont donc pas du code mort, mais leur sortie n'est de toute facon ni surfacee ni persistee (cf montage-composition-2). Deux pipelines paralleles non fusionnes.

## Écart
Tout le code de composition/mux/transcodage réel (voix-off+musique amix, overlay, H.264) est mort pour l'opérateur. Le montage promis n'existe pas dans le parcours réel.

## Cause racine
Deux systèmes de génération parallèles non fusionnés. Le create flow est câblé sur le système B (content-studio/service.ts) tandis que compose/transcode appartiennent au système A (ai-engine/graph/builder.ts).

## Preuves
- grep MediaStudio.tsx → fetch '/api/admin/content-studio/drafts/[id]/generate-visual' (pas /ai-engine/generate)
- generate-visual/route.ts importe generateVisualForDraft de '@/lib/content-studio/service' — aucun import compose/transcode
- builder.ts:117-149 compose/transcodeExport ne sont reliés QUE dans le graphe LangGraph
- curl GET /api/admin/ai-engine/generate → 405 (route existe mais POST-only, hors create flow)

## Reproduction
1. Ouvrir /admin/content-studio-v2/create. 2. Cliquer Générer un visuel IA. 3. Observer l'appel réseau → /drafts/<id>/generate-visual. 4. Constater qu'aucun composeNode/transcodeExportNode n'est exécuté (grep service.ts: aucun compose).

## Piste de correction
Soit router le create flow vers /api/admin/ai-engine/generate (système A), soit porter la composition/mux/transcodage dans content-studio/service.ts (système B). Décider d'UN pipeline canonique.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le coeur du finding est verifie: le create flow (MediaStudio.tsx:96 fetch '/api/admin/content-studio/drafts/<id>/generate-visual') appelle generateVisualForDraft dans content-studio/service.ts (Systeme B) qui n'importe ni n'invoque jamais composeNode/transcodeExportNode (grep service.ts compose/transcode/ai-engine = vide). composeNode/transcodeExport sont cables UNIQUEMENT dans graph/builder.ts (compose -> transcodeExport -> qualityCheck). GET /api/admin/ai-engine/generate = 405 (POST-only, route distincte). MAIS deux nuances corrigent la PORTEE: (a) compose/transcode ne sont PAS du 'code mort' — ils s'executent reellement via la page /admin/content-studio-v2/ai-engine/create qui POST sur /api/admin/ai-engine/generate (page.tsx:657). (b) Le create flow produit quand meme un media utilisable (image via sharp+worker reel, ou MP4 mock statique pre-rendu) publiable — ce n'est donc pas un blocage total de fonction, mais l'ABSENCE des features de montage. 'critical' surevalue: la generation visuelle de base marche; seul le montage est absent du parcours create.
- **Contre-preuve / nuance :** src/app/admin/content-studio-v2/ai-engine/create/page.tsx:657 fetch('/api/admin/ai-engine/generate') => compose/transcode SONT atteignables par un operateur (pas du code mort). src/lib/content-studio/service.ts:386-490 generateVideoForDraft sert un MP4 mock statique reel (video-generation.ts:71 '/_media/content-studio/mock/reel-9x16.mp4'). grep 'compose|transcode|ai-engine' service.ts et generate-visual/route.ts = vide.

> Réf. registre : `bug-register.csv` ligne `BUG-033` · matrice : `gap-matrix.csv`.
