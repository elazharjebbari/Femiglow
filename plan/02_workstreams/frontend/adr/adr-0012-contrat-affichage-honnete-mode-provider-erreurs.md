# ADR-0012 — Contrat d'affichage honnête : mode, provenance, état et erreurs (UI create-flow)

- **Statut** : Proposé (Phase B — workstream frontend)
- **Date** : 2026-05-29
- **Opérationnalise** : ADR-0007 Option 1 (convergence vers A), en aval de ADR-0008 (façade `invokeEngine`), ADR-0010 (contrat `GenerationResult`/erreurs), ADR-0011 (bascule incrémentale par flag).
- **Findings liés** : `BUG-020`, `BUG-033`, `BUG-039`, `BUG-048`, `BUG-061`
- **Tâches** : `ACT-FE-001`, `ACT-FE-002`, `ACT-FE-003`, `ACT-FE-006`, `ACT-FE-008`, `ACT-FE-009` ; réutilise `T-201`, `T-413`, `T-414`, `T-104`.

## Contexte

L'audit montre que la couche opérateur **affiche un état qu'elle n'a pas reçu** :

- `CreateWorkspace.tsx` (l.221-223) **assume `provider:'openai'`** quand un modèle a été passé, alors que le serveur a pu dégrader en `fallback` (template déterministe) — BUG-020. Le badge « Généré par {model} · {provider} » ment.
- Le toggle `cs_generation_mode` ne pilote que le visuel ; le texte est **mode-agnostique** et dégrade en silence — BUG-020.
- `PublishActionGroup.executePublish` envoie `{}` sans `accountId` ; l'UI laisse le serveur **deviner** le compte (premier actif) — BUG-039, le seul risque irréversible.
- `MediaStudio` lit `json.media.*` ad hoc et, après convergence vers A (async), risque d'afficher un **stub/partiel comme final** ou de **doublonner** un média à la re-matérialisation A→B — BUG-033, BUG-048.
- `MediaStudio` jette `new Error(message)` en **perdant le `code` typé** ; `ERROR_MESSAGES` est incomplet → toasts génériques ou `HTTP 5xx` brut.

La cause commune est l'absence d'un **contrat d'affichage** : l'UI fabrique de l'information (provenance, mode, succès) au lieu de la **refléter**. C'est exactement le pattern « voyant vert au-dessus d'un process en échec » dénoncé par l'audit, transposé à l'écran de l'opérateur.

## Décision

**Invariant d'affichage honnête** : l'UI du create-flow n'affiche **jamais** une provenance, un mode, un statut ou un succès qu'elle n'a pas **reçu du serveur ou explicitement choisi par l'opérateur**.

Quatre règles dérivées :

1. **Provenance reçue, jamais devinée.** Le badge de génération affiche le `provider`/`model` **renvoyés par la réponse**. Si `provider==='fallback'`, l'UI rend un état distinct (« Template » / « dégradé »), et en mode `live` surface un avertissement non bloquant. Interdit : substituer `'openai'` par défaut.

2. **Mode unique, propagé partout, observable.** Une source de vérité client (`getClientGenerationMode`) lit le cookie et est attachée à **toutes** les requêtes de génération (texte ET visuel). Le badge de mode reflète le mode **envoyé**, pas l'env global. Le toggle a un effet observable sur **chaque** capacité.

3. **Cible explicite avant action irréversible.** Toute action de publication en `live` exige une **cible désambiguïsée** : `accountId` choisi par l'opérateur (bouton désactivé tant qu'absent quand plusieurs comptes existent), compte affiché dans le récapitulatif de confirmation. L'UI ne délègue jamais le choix du compte à un fallback serveur en live.

4. **État reflété, erreurs typées préservées.** (a) Aucun asset n'est affiché « prêt » tant qu'il n'est pas servi `200` ; les jobs async (Higgsfield/compose) ont un statut `pending|partial|completed|degraded` réconcilié depuis le serveur, idempotent à la re-matérialisation A→B. (b) Le parsing d'erreur (`parseHttpError`) préserve `{ code, message, details }` de l'enveloppe `HttpError` ; `formatError` mappe tous les `ErrorCode` et **n'écrase jamais** un message serveur utile par un libellé générique.

## Conséquences

- ✅ Le toggle Mock/Live devient **prouvable** sur tout le parcours (BUG-020) ; la confiance opérateur n'est plus trompée.
- ✅ Plus de publication sur le mauvais compte client : l'UI **force** la désambiguïsation (BUG-039).
- ✅ La convergence async vers A (BUG-033/048) ne peut pas afficher un faux « prêt » : l'écran reflète l'état réel du job.
- ✅ Les erreurs métier remontent lisibles, le `code` typé survit de bout en bout (T-414).
- ⚠️ Couple l'UI au contrat serveur (`provider` dans la réponse, `code` dans l'erreur, statut de job) → dépend de T-104 (contrat enrichi) et de la fidélité des codes `HttpError` côté backend. Découplage : les règles 1-3 sont testables en mock sans la façade ; la règle 4(a) bloque sur T-104.
- ⚠️ Période transitoire (flag B/A) : l'UI doit gérer les deux formes de réponse ; l'adaptateur unique (`mapEngineAssetToMediaItem`) absorbe la différence.

## Alternatives écartées

- **Garder l'optimisme « provider deviné »** : conserve le mensonge d'affichage (BUG-020) ; rejeté — viole le principe de vérité du plan.
- **Laisser le serveur choisir le compte en live** : conserve le risque irréversible (BUG-039) ; rejeté — garde-fou anti-incident non négociable du macro-plan.
- **Mapper les erreurs uniquement par message texte** : fragile et non i18n-able ; rejeté au profit du `code` typé préservé.
