# ADR-0011 — Stratégie de bascule incrémentale & retrait du chemin B legacy

- **Statut** : Proposé (Phase B — workstream architecture)
- **Date** : 2026-05-29
- **Opérationnalise** : ADR-0007 Option 1, ADR-0008 (façade `invokeEngine`)
- **Findings liés** : `BUG-015`, `BUG-026`, `BUG-047`, `BUG-011`, `BUG-041`
- **Tâches** : `ACT-ARC-010`, `ACT-ARC-012` ; réutilise `T-901`, `T-010`, `T-006`

## Contexte

La convergence vers A repose sur la façade `invokeEngine` (ADR-0008) et la refonte de `GenerationResult`/pont (ADR-0010) — le **point de défaillance unique** de la cible. Une bascule frontale du create-flow (B) sur A risquerait de régresser **le seul parcours qui marche aujourd'hui** : le mode mock de B (prouvé par les E2E golden-path / media-kind-toggle). Les tests verts de A donnent une fausse assurance (BUG-047 : la couverture porte sur A, l'opérateur n'utilise que B ; BUG-041 : 0/95 tests assertent un effet backend réel ; BUG-011 : live cassé non couvert).

## Décision

1. **Bascule par feature-flag, capacité par capacité** : un flag (`AI_ENGINE_CONVERGENCE_<capability>` ou table de config) route chaque capacité (`text`, `image`, `video`, `voiceover`, `music`, `subtitles`, `compose`) soit vers le chemin B legacy, soit vers `invokeEngine` (A). Jamais un big-bang.

2. **Ordre de migration** (aligné sur le séquencement P1→P5) :
   1. Contrat complet (ADR-0010, T-104) — structurel, atomique.
   2. Façade `invokeEngine` introduite, **inactive par défaut** (B appelle encore son chemin).
   3. Providers réparés derrière la frontière (image OpenAI, Higgsfield async).
   4. `text` bascule sur A (fin du fallback figé, fin de la duplication texte — BUG-015).
   5. `image` bascule sur A (fin de la duplication image — BUG-026).
   6. `voiceover`/`music`/`subtitles`/`compose` deviennent atteignables.
   7. Bascule structurelle finale (T-901) : B délègue à A pour **toutes** les capacités ; retrait du chemin B legacy.

3. **Gate de bascule par capacité** : une capacité ne peut basculer (`flag=on` en défaut) **que si** elle est prouvée par le **même** scénario opérateur en **MOCK ET LIVE** (ADR-0002/0003), via le smoke opérateur (T-010) qui asserte un **effet backend réel** (asset servi 200, `generation_run` créé). Tant que la parité n'est pas prouvée, la capacité reste sur le chemin B → **rollback trivial** = remettre le flag à `off`.

4. **Garde-fou bloquant** : le smoke opérateur (mock + live) est **bloquant en CI** sur chaque PR de bascule ; si le mock B régresse, le PR est rejeté.

5. **Retrait du chemin B legacy** : différé jusqu'à ce que **toutes** les capacités soient basculées et prouvées en parité. Le retrait supprime les générateurs B dupliqués (`generation.ts`, `image-generation.ts`, `video-generation.ts` côté logique) une fois A confirmé.

## Conséquences

- ✅ On ne casse jamais le seul parcours qui fonctionne (mock B) : chaque pas est réversible.
- ✅ La valeur arrive tôt (image+texte live via OpenAI) sans attendre la convergence complète.
- ✅ Le retrait de dette (deux moteurs) est progressif et prouvé, pas spéculatif.
- ⚠️ Période transitoire où les deux chemins coexistent derrière le flag → complexité temporaire assumée, bornée par le plan de retrait.

## Alternatives écartées

- **Big-bang** : risque de régression du parcours opérationnel ; rollback coûteux.
- **Garder les deux chemins indéfiniment** : ne ferme pas la dette de duplication (BUG-015/026/047).
