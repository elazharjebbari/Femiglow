# S08 — Concurrent Edits

> Valide la gestion d'un conflit d'édition concurrent (deux utilisateurs ou deux onglets).

## Setup

- 2 onglets ouverts sur le même draft
- Tab A modifie la caption à T+0
- Tab B modifie la caption à T+1 (sans avoir reçu la modification de A)

## Comportement attendu

- Tab A : autosave → 200 succès
- Tab B : autosave → 409 conflict { error: { code: 'version_conflict', currentVersion: N } }
- Tab B :
  - AutosaveIndicator passe à 'error'
  - Banner "Conflit détecté — un autre éditeur a modifié ce draft"
  - Bouton "Recharger" : fetch GET /drafts/:id → upsert local

## Cas limite : conflit récurrent
- Si Tab B retente immédiatement sans recharger, 409 à nouveau
- Le banner doit persister

## Implementation note

Le backend doit gérer la version (etag ou updated_at check) :
- PATCH `/drafts/:id` accepte `If-Match: <updatedAt>` header
- Si la version courante DB > celle envoyée → 409

## Spec Playwright
`e2e/content-studio-v2/create-concurrent-edits.spec.ts`

⚠ Si l'implémentation du versioning optimiste n'est pas dans cette phase, ce scénario est skipped (xfail) avec issue tracking.
