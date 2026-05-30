# F12 — Autosave & Versions

## Objectif
Persister automatiquement les changements de draft sans perte de données, et permettre la récupération d'une version précédente (backlog).

## Phase actuelle
**Autosave fonctionne**. **Versioning = backlog (Phase 9+)**.

## Comportement attendu autosave
- Debounce 1500ms
- PATCH `/drafts/:id` avec uniquement les champs modifiés
- Statut visible : idle | saving | saved | error | session_expired
- Conflict (409) : afficher banner + bouton "Recharger"

## Comportement attendu versioning (futur)
- Nouvelle table `content_draft_versions`
- Snapshot JSONB à chaque PATCH significatif
- UI : timeline + bouton "Restaurer cette version"

## Comportement actuel
Autosave OK. Pas de versioning.

## Gaps
- G09 : pas de versioning (backlog)
- F12-LOCAL-1 : la flush sur unmount n'est pas garantie (à vérifier)

## Propositions
### A — Statu quo + flush sur unmount
Minimal. Garantir un flush() au unmount du composant.

### B — Versioning soft (memory only)
Stack en mémoire React, perdu au reload. Léger.

### C — Versioning complet DB
Voir G09. Lourd.

## Recommandation
**A** pour cette phase. C planifié pour Phase 9 (hors scope actuel).

## Implementation A
- Vérifier dans StudioContext que `flush()` est appelé au unmount
- Si pas le cas, ajouter `useEffect` cleanup qui appelle flush

## Tests
Voir `test-scenarios.yaml`.
