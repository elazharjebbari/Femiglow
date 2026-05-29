# ADR-0007 — Clarifier (puis converger) la frontière des deux pipelines de génération A/B

- **Statut** : Proposé (décision à arbitrer par le commanditaire)
- **Date** : 2026-05-29
- **Findings liés** : `BUG-004` (blocker), findings `voix-off`, `montage-composition`, axe `maintenabilite`/`evolutivite`

## Contexte

Il existe **deux systèmes de génération parallèles** :
- **A — AI-Engine LangGraph** (`src/lib/ai-engine/*`, 16 nœuds) : multimédia complet (script → images/vidéo → **voix-off → musique → sous-titres → compose → transcode/export**), HITL, modération, qualité. Exposé via `/admin/.../ai-engine/*`.
- **B — Content-Studio create flow** (`src/lib/content-studio/*`) : ce que **l'opérateur utilise** sur `/create` ; ne produit qu'**une image OU une vidéo** + texte, puis publication.

Le **bridge est unidirectionnel A→B** (`content-studio-bridge.ts` matérialise un résultat A en draft B) ; **B n'invoque jamais A**. Conséquence (`BUG-004`, blocker) : **voix-off, musique, sous-titres, montage/compose et export sont inatteignables depuis le parcours opérateur**. Le bridge ignore en outre les images mock, créant des **drafts sans média non approuvables**.

## Décision

Arbitrage explicite requis, deux options documentées :

- **Option 1 — Converger vers A** : faire du graphe LangGraph le moteur unique ; le create flow devient une UI au-dessus de A (l'opérateur accède réellement à voix-off/montage). Bridge bidirectionnel, B délègue à A.
- **Option 2 — Assumer la séparation** : B reste le moteur opérateur « rapide » (image/vidéo simple), A est un moteur « studio avancé » distinct avec sa propre UI ; **retirer de l'UI toute promesse de features A non atteignables via B** (pas de faux affordances).

Dans les **deux** cas : supprimer la **désynchronisation** entre ce que l'UI promet et ce que le moteur emprunté produit, et corriger le bridge (ne pas créer de draft sans média approuvable).

## Conséquences

- ✅ Fin de l'ambiguïté « fonctionnalité annoncée mais inatteignable ».
- ✅ Base claire pour l'évolutivité (nouveaux providers/réseaux).
- ⚠️ Option 1 = effort important (UI + orchestration async + HITL dans le create flow).
- ⚠️ Option 2 = renoncement (temporaire) à la voix-off/montage côté opérateur, à assumer produit.

## Alternatives écartées

- **Statu quo** : laisse un blocker (`BUG-004`) et une dette de duplication permanente.
