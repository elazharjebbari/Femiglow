# ADR-0008 — Façade `invokeEngine` & pont bidirectionnel idempotent

- **Statut** : Proposé (Phase B — workstream architecture)
- **Date** : 2026-05-29
- **Décide le COMMENT de** : ADR-0007 Option 1 (convergence vers A)
- **Findings liés** : `BUG-015`, `BUG-026`, `BUG-004`, `BUG-034`, `MISS-005`
- **Tâches** : `ACT-ARC-002`, `ACT-ARC-003`, `ACT-ARC-010` ; réutilise `T-104`, `T-901`

## Contexte

Deux moteurs de génération coexistent : **A** (AI-Engine LangGraph, riche, 16/17 nœuds) et **B** (create-flow opérateur, pauvre, routing par préfixe d'id en dur). Le pont actuel est **unidirectionnel A→B** (`content-studio-bridge.ts`) et **B n'invoque jamais A** : le create-flow appelle `generateForIdea`/`generateStudioImage` (système B) sans aucun import de `ai-engine/*` (`grep -rln "ai-engine" lib/content-studio/` → vide). Conséquence : duplication de logique (texte 211 l. B vs 393+193 l. A ; image 272 vs 202 ; vidéo 261 vs 250) et capacités A (voix-off/montage/export) **inatteignables** par l'opérateur (BUG-004, BUG-015, BUG-026).

ADR-0007 Option 1 décide que A devient le moteur unique et que B devient une UI/façade au-dessus de A. Cet ADR définit **comment** : la frontière de service que B appelle.

## Décision

1. **Une frontière de service unique** : `invokeEngine(brief, { capabilities, mode, flags }) → GenerationResult`, exposée par `src/lib/ai-engine/` (façade au-dessus de l'orchestrateur). C'est le **seul** point d'entrée de génération que B (create-flow) et les routes `/api/admin/content-studio/*` appellent une fois la bascule effectuée. La frontière accepte un sous-ensemble de capacités (`text`, `image`, `video`, `voiceover`, `music`, `subtitles`, `compose`, `export`) pour ne pas imposer le poids complet de A à un usage rapide.

2. **Pont bidirectionnel** :
   - **B→A** : l'opérateur déclenche une génération via `invokeEngine` (remplace `generateForIdea`/`generateStudioImage` derrière le flag de bascille).
   - **A→B** : le `GenerationResult` est matérialisé en draft B persisté (table `media` + `content_post`), avec **tous** ses assets approuvables (BUG-034). Le bridge ne crée **jamais** de draft sans média approuvable.

3. **Idempotence de matérialisation** : une clé déterministe (par `briefId`/`runId`) garantit qu'un même résultat matérialisé deux fois (retry, double soumission) produit **un seul** ensemble de drafts/médias. Réutilise la même propriété d'idempotence que la file de jobs (ADR-0009).

4. **Async-aware** : `invokeEngine` peut retourner un résultat partiel + un `jobId` quand des capacités longues (Higgsfield async, compose) sont en cours ; la matérialisation A→B est complétée par le worker (ADR-0009), pas dans la requête HTTP opérateur.

5. **Pré-requis structurel** : `GenerationResult` doit propager **toutes** les capacités produites par le graphe (ADR-0010). Sans cela, le pont — même bidirectionnel — lit `undefined` (MISS-005, BUG-004).

## Conséquences

- ✅ Un seul endroit où réparer un provider (dans A), B en bénéficie par délégation → fin de la double maintenance.
- ✅ Voix-off/montage/export deviennent atteignables par l'opérateur via la même couture.
- ✅ Ajouter une capacité = l'exposer dans `GenerationResult` + la rendre dans l'UI ; pas de refonte du pont.
- ⚠️ La façade est le **point de défaillance unique** de la cible → bascule incrémentale par flag (ADR-0011), gardée par le smoke opérateur.
- ⚠️ La matérialisation async exige la file de jobs (ADR-0009) opérationnelle.

## Alternatives écartées

- **Garder deux moteurs et router côté UI** : conserve la duplication et la divergence, ne ferme pas BUG-004/015/026.
- **Big-bang (remplacer B d'un coup)** : risque de régresser le seul parcours qui marche (mock B) → rejeté au profit de l'incrémental (ADR-0011).
