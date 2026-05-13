# Quick Wins — Plan d'action

> Cible : 17h d'effort pour transformer le V1 "fonctionnel" en V1.1
> "agréable à utiliser quotidiennement". Pas de breaking change, additif.

## Vagues d'exécution

### Vague A — Composants UI partagés (3h)

- **A1** `ConfirmDialog.tsx` — modal de confirm réutilisable (remplace `confirm()` natif)
- **A2** `Toast` infra — affichage notifs cohérent
- **A3** Hook `useConfirm` (API ergonomique)

### Vague B — Audit timeline + Diff viewer (5h)

- **B1** Route API `GET /api/admin/tracking/events/mappings/[id]/audit`
- **B2** Composant `MappingAuditTimeline`
- **B3** Page `/admin/tracking/events/mappings/[id]/audit`
- **B4** Composant `MappingDiffViewer` (consomme route diff existante)
- **B5** Page `/admin/tracking/events/mappings/compare/[a]/[b]`

### Vague C — Ergonomie liste + édition (4h)

- **C1** Indicateur "active depuis X jours" sur la liste
- **C2** Validation pré-création (warning si events sans aucun provider)
- **C3** Liens cross-modules (depuis `/admin/tracking/gtm` et `/categorization`)
- **C4** Auto-save draft localStorage dans l'éditeur

### Vague D — Bulk + édition avancée (5h)

- **D1** Bouton "Copier ce mapping vers tous les events" (matrix bulk)
- **D2** Bouton "Désactiver tous les events pour ce provider" (matrix bulk)
- **D3** Undo/Redo Ctrl+Z dans l'éditeur (stack d'états)

## Runbook d'exécution (au worktree)

```bash
cd /Users/elazhar/PycharmProjects/template-femiglow-tracking

# Vague par vague
# 1. Tag baseline
git tag pre-quick-wins-$(date +%F)

# 2. Vague A
# Créer ConfirmDialog + hook + intégrer dans MappingVersionsList
# pnpm typecheck (./node_modules/.bin/tsc --noEmit)
# pnpm test --filter mappings

# 3. Vague B
# Route API audit + composants + 2 pages
# pnpm typecheck
# pnpm test

# 4. Vague C
# Indicateur âge + warning + liens + auto-save
# pnpm typecheck

# 5. Vague D
# Bulk actions + undo/redo
# pnpm typecheck + pnpm test full suite

# 6. Build + redémarrage serveur
cd apps/web && rm -rf .next && ./node_modules/.bin/next build
./node_modules/.bin/next start -p 8011 &

# 7. Smoke
bash apps/web/scripts/smoke-event-mappings.sh

# 8. Commit + récap
git add -A && git commit -m "feat(event-mappings): quick wins V1.1"
```

## Critères Go/No-Go par vague

| Vague | Gate |
|---|---|
| A | `ConfirmDialog` utilisé par MappingVersionsList sans régression |
| B | Page `/audit` charge + Page `/compare` rend diff |
| C | localStorage auto-save fonctionnel + indicateur âge visible |
| D | Ctrl+Z undo dans la matrice fonctionne (max 20 niveaux) |

## Rollback

`git reset --hard pre-quick-wins-2026-05-13` si problème détecté.

## Sortie attendue

- ~10 fichiers nouveaux/modifiés
- ~20 tests Vitest supplémentaires
- Build OK, smoke 5/5 verts
- Commit propre sur `feat/tracking-improvement`
