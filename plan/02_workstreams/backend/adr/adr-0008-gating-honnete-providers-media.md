# ADR-0008 — Gating honnête des providers média & propagation des échecs dans `state.errors`

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Workstream** : backend (ACT-BE)
- **Findings liés** : `BUG-049`, `BUG-050`, `BUG-066`, `MISS-011`, `MISS-020`, `MISS-021`
- **Actions liées** : ACT-BE-015, ACT-BE-030, ACT-BE-004
- **Décisions parentes** : ADR-0002 (vérité = comportement réel), ADR-0007 (convergence vers A)

## Contexte

Les nodes média du graphe A (`generate-voiceover.ts`, `generate-music.ts`, `generate-images.ts`, `generate-video.ts`, `compose.ts`) **avalent silencieusement leurs échecs** :

- leurs `catch` retournent un `MediaAsset` avec `url=''`, `provider='fallback'`/`'compose:empty'`, `costCents=0`, **sans jamais ajouter d'entrée dans `state.errors`** ;
- `routeAfterQuality` (`routing.ts:41-63`) ne regarde que les `qualityScores` texte (≥ 0.65 → `pass`) ;
- résultat **vérifié par probe** : un job se termine `completed quality 0.91` avec une voix-off vide, une image fantôme servie en **404**, un export passthrough non transcodé, et un coût `0` trompeur.

C'est la classe de bug la plus dangereuse pour la cible (convergence vers A) : quand l'opérateur atteindra réellement A via le pont, un échec provider passera pour un succès. La voix-off/musique deviennent « disponibles » sans être fiables.

## Décision

1. **Aucun node média ne retourne un asset non servable comme succès.** Tout asset `url=''`, 404, ou < 100 octets est un échec, pas un fallback silencieux.
2. **Tout échec provider pousse une entrée structurée dans `state.errors`** (node, raison, retryable) et **dégrade le statut du job** (`degraded` ou `failed`), jamais `completed`.
3. **Flag `degraded` + raison** porté par l'asset/job dégradé, propagé jusqu'à l'UI (via le pont A→B, T-104).
4. **Gating provider explicite** : un provider média non configuré (TTS=`mock`, ElevenLabs sans clé, musique sans provider) est un état **déclaré et visible**, pas un succès muet. La voix-off n'est jamais marquée `works` tant qu'elle n'est pas prouvée en live (mp3 réel, durée > 0).
5. **Garde côté service** : ne jamais servir un `<video src=''>` ; le backend refuse de présenter un asset vide.

## Conséquences

- ✅ Un échec média devient visible (status + `state.errors`) au lieu d'un faux succès — pré-condition de la confiance dans A.
- ✅ Le quality-gate cesse de certifier un job dont les assets média sont vides.
- ✅ Débloque le diagnostic de BUG-012/013 : un job avec voix-off/vidéo vide échoue explicitement au lieu de logguer « generated (1ms) ».
- ⚠️ Des jobs aujourd'hui « verts » deviendront `degraded`/`failed` — c'est le comportement correct, mais il faut communiquer la bascule.

## Alternatives écartées

- **Garder le fallback silencieux + log `warn`** : laisse le statut trompeur et le coût `0` ; viole ADR-0002 (vérité).
- **Échouer dur (throw) au premier échec média** : trop rigide pour un pipeline multi-asset ; `degraded` + `state.errors` préserve les assets réussis tout en signalant la dégradation.
