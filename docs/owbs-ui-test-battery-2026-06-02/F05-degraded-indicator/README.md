# F05 — Indicateur de sync dégradée (FR-11)

**Surface :** `wizard-store.syncDegraded` + `markSyncDegraded` (signal posé par
`lead-sync-singleton.onDrop`). **Public :** acheteuse.

## ⚠️ GAP identifié (élément non testé / incomplet)
Le **signal** `syncDegraded` existe et est câblé (P7), **mais aucun composant UI
ne le consomme encore**. F05 **spécifie** le composant indicateur à construire,
puis le teste. C'est exactement le type d'élément « peu/non testé » visé.

## 1. Fonctionnement optimal (cible)
- Quand une envelope est **abandonnée** (4xx ou après `maxAttempts`), `onDrop` appelle
  `markSyncDegraded()` → `syncDegraded=true`.
- Un **indicateur discret, non bloquant** apparaît (ex. bandeau/badge `role="status"`,
  `aria-live="polite"`, message « Une donnée n'a pas pu être enregistrée, vous pouvez
  continuer ») avec, idéalement, une action **« réessayer »** (re-flush).
- La **navigation reste totalement libre** : l'utilisatrice peut continuer le parcours.
- Faux positif **interdit** : pas d'indicateur si tout va bien.

## 2. Points à vérifier (tous angles)
### UI/UX
- Discret (pas une modale bloquante), `role=status`/`aria-live=polite`, dismissible.
- Pas de blocage : tous les boutons/champs restent utilisables.
- Cohérent en FR/AR (RTL) et accessible (axe).
### Frontend
- `markSyncDegraded` appelé **uniquement** sur un vrai drop (pas sur retry).
- L'indicateur réagit au flag store (apparition/disparition).
- Une action « réessayer » re-déclenche `getLeadSyncQueue().flush()` et, en cas de succès, **efface** l'indicateur (nécessite une action `clearSyncDegraded` à ajouter — sous-gap).
### Data
- Aucun impact sur la persistance ; purement signalétique.

## 3. Oracle principal
> Après un drop simulé, un élément `role="status"` discret apparaît, la navigation
> entre étapes **reste possible**, et **aucun** indicateur n'apparaît si la sync réussit.

## 4. Livrables de build (spécifiés par cette batterie)
- Composant `WizardSyncIndicator` (consomme `syncDegraded`), monté dans `WizardShell`.
- (option) action `clearSyncDegraded` + bouton « réessayer ».

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
