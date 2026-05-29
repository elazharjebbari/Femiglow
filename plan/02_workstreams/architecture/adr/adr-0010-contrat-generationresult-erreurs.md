# ADR-0010 — Contrat `GenerationResult` complet & taxonomie d'erreurs du graphe

- **Statut** : Proposé (Phase B — workstream architecture)
- **Date** : 2026-05-29
- **Pré-requis structurel de** : ADR-0008 (façade `invokeEngine`)
- **Findings liés** : `BUG-004`, `BUG-034`, `MISS-005`, `BUG-052`, `BUG-069`
- **Tâches** : `ACT-ARC-001`, `ACT-ARC-011` ; réutilise `T-104`, `T-412`

## Contexte

`GenerationResult` (`orchestrator.ts:30-45`) et `buildResultFromState` (116-131) ne propagent que `script, caption, hashtags, images, videos (bruts), qualityScores, moderationResult, costTracking, errors`. **Aucune clé `voiceover / music / subtitles / composition / exports / thumbnails`** : tout le travail audio/sous-titres/composition/export est produit dans le `finalState` interne puis **jeté avant le bridge** (MISS-005, racine structurelle de BUG-004). Le bridge (`content-studio-bridge.ts`) ne lit donc jamais ces champs (BUG-034). Même si on câble demain un TTS/montage réel dans A, l'opérateur ne le recevra jamais : le DTO est un goulot, pas une couture extensible.

Par ailleurs, deux problèmes de contrat aggravent la situation :
- **Erreurs avalées** : aucun nœud média ne pousse dans `state.errors` (MISS-011) ; le quality-gate peut certifier `completed quality 0.91` sur un asset absent → faux succès silencieux.
- **Taxonomies incompatibles** : `parse-brief.ts` attend `{awareness,engagement,conversion,education,entertainment}` ; Content-Studio utilise `{notoriete,consideration,conversion,reassurance,fidelisation}`. Une idée opérateur passée à A jetterait une `ZodError` (BUG-052). Et `meta_graph` est déclaré provider mais `adapter=null` → `invalid_state` si sélectionné (BUG-069).

## Décision

1. **Contrat de sortie complet** : étendre l'interface `GenerationResult` et `buildResultFromState` pour propager **toutes** les capacités produites : `voiceover`, `music`, `subtitles`, **`composition`, `exports`, `thumbnails`** (avec leurs `assetId` réels). C'est le **pré-requis absolu** de toute convergence (T-104) : sans lui le pont bidirectionnel (ADR-0008) lit `undefined`.

2. **Contrat d'erreur honnête** : tout nœud (en particulier les nœuds média) **doit** pousser ses échecs/dégradations dans `state.errors` avec un code structuré. Le quality-gate ne peut **pas** certifier `completed` sur un média absent. Un asset dégradé est marqué `degraded` avec raison (jamais `<video src=''>` ni image 404 servis comme succès).

3. **Taxonomie d'erreurs unifiée** : un type d'erreur partagé (`EngineErrorCode`) entre A, B, le pont et la publication, mappé sur des libellés humains stables. Pas de message serveur utile écrasé par un libellé générique.

4. **Taxonomies de domaine unifiées** : une table de correspondance unique des enums `objective`/`pillar`/`tone` entre A et B (T-412, T-203), avec mapping inverse B→A pour que le pont bidirectionnel ne jette pas de `ZodError` (BUG-052).

5. **Registre de providers honnête** : un provider déclaré sans adapter (`meta_graph: null`) est soit retiré du registre exposé, soit explicitement marqué `réservé/non disponible` et **non sélectionnable** dans l'UI (BUG-069).

## Conséquences

- ✅ Toute capacité produite par A devient exposable sans refonte du pont.
- ✅ Fin des faux succès silencieux : un média absent fait échouer/dégrader explicitement.
- ✅ Le pont bidirectionnel B↔A ne crashe plus sur une taxonomie divergente.
- ⚠️ Étendre `GenerationResult` touche l'orchestrateur, le bridge et l'UI `GenerationResult.tsx` (changement transverse, mais atomique et structurel) → fait **avant** les correctifs providers.

## Alternatives écartées

- **Mapper les assets uniquement dans le bridge** : insuffisant, la perte se produit **en amont** dans `buildResult` (MISS-005) ; le bridge lirait toujours `undefined`.
- **Garder les taxonomies divergentes avec un mapping ad-hoc dans le bridge** : reproduit la dette ; on unifie à la source (T-412).
