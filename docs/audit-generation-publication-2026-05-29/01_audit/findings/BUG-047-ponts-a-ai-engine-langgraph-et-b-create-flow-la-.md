# BUG-047 — Ponts (A) AI-Engine LangGraph et (B) create-flow : la couverture porte sur (A) tandis que l'opérateur n'utilise que (B) — voix-off/musique/sous-titres jamais atteints

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `src/lib/ai-engine/nodes/* (16 nœuds) vs src/lib/content-studio/* + bridge/content-studio-bridge.ts` |
| **Mode mock** | `partial` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le pipeline complet (script→caption→variants→images→video→voiceover→music→subtitles→compose→transcode→moderate→quality→human-review) est testé et accessible à l'opérateur.

## État réel vérifié
Le parcours opérateur réel (/admin/content-studio-v2/create, prouvé par les E2E qui passent: golden-path, media-kind-toggle) n'appelle que (B) content-studio (ideas→generate→drafts→review→generate-visual→publish). Les nœuds voiceover/music/subtitles/compose de (A) ont des tests unitaires verts isolés (ex. human-review.test.ts dans le log) mais ne sont pas exercés par un parcours opérateur E2E. Le coverage AI-Engine n'est même pas instrumenté (cf finding-8).

## Écart
Des dizaines de tests verts sur (A) donnent l'illusion d'un pipeline média complet, alors que l'opérateur sur (B) n'atteint jamais voix-off/musique/sous-titres/compose. Tests verts ≠ fonctionnalité atteignable.

## Cause racine
Deux systèmes parallèles ; les tests unitaires de (A) passent en isolation (mocks de nœuds) mais aucun test ne prouve que (B) route vers (A) via le bridge pour ces étapes. Pas de test E2E couvrant compose/voiceover depuis l'UI create.

## Preuves
- E2E qui passent (/tmp/audit-playwright.log) couvrent uniquement ideas/generate/review/generate-visual/publish (B) — pas voiceover/music/subtitles/compose
- Log vitest: nodes/human-review.test.ts (8 tests) passe en isolation
- Existence bridge/content-studio-bridge.ts (périmètre fourni) — aucun E2E ne prouve l'enchaînement (B)→(A) pour compose/voiceover
- vitest.config.ts coverage n'inclut pas src/lib/ai-engine/nodes

## Reproduction
Suivre les appels réseau des E2E create (golden-path) : aucun n'appelle /api/admin/ai-engine/* ni n'atteint voiceover/music/compose. Lire bridge et chercher un E2E qui l'exerce → absent.

## Piste de correction
Ajouter un E2E opérateur qui, depuis /create, déclenche le pipeline complet via le bridge (au moins en mock) et assert la présence d'assets voiceover/music/subtitles/compose ; instrumenter le coverage AI-Engine pour révéler le code mort côté opérateur.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Confirme: le pont bridge/content-studio-bridge.ts n est importe QUE par l AI-Engine lui-meme (bridge/index.ts, bridge/content-studio-bridge.test.ts, integration/db-transaction.test.ts) — grep dans src/app/api/admin/content-studio et src/lib/content-studio = AUCUN import du bridge. La route generate-visual ne reference ni voiceover/music/subtitles/compose ni ai-engine. Les 16 noeuds (compose/generate-music/generate-voiceover/generate-subtitles) ont chacun un .test.ts isole et vert mais sont inatteignables depuis le flux operateur (B). Le coverage n instrumente pas ai-engine. Donc des dizaines de tests verts sur (A) donnent l illusion d un pipeline media complet que l operateur n atteint jamais.
- **Contre-preuve / nuance :** Aucune contre-preuve. Le bridge importe DEPUIS content-studio (repository, updateDraft) — c est (A)->(B), jamais (B)->(A) declenche par l UI create. Aucun E2E create n appelle /api/admin/ai-engine/* (golden-path/media-kind-toggle restent dans /api/admin/content-studio/*).

> Réf. registre : `bug-register.csv` ligne `BUG-047` · matrice : `gap-matrix.csv`.
