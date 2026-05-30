# Phase 2 — Component tests

## Objectif
Tester chaque composant publish à ≥ 85% lines, ≥ 75% branches.

## Composants × livrables

### PublishActionGroup.test.tsx (extend)
- 12 tests existants → 18 (ajouter G12 preview, error mapping, mockMode badge)
- Coverage 85%+ pour PublishActionGroup.tsx

### JobQueue.test.tsx (NEW)
- 16 tests
- Empty, rendered jobs, badge colors, retry, cancel, polling (fake timers), filters

### QuickEditDrawer.test.tsx (NEW)
- 12 tests
- Open on dblclick, pre-fill, save, cancel, Esc, click outside

### Calendar.test.tsx (NEW)
- 14 tests
- 3 views, filters URL-synced, navigation, drag-drop simulation

### CalendarCard.test.tsx (NEW)
- 10 tests
- Badges, pillar dots, thumbnails, drag handle

### AccountHealthCard.test.tsx (NEW)
- 8 tests
- Empty, accounts list, sync button, badge colors

### LibraryClient.test.tsx (extend)
- +4 tests sur status badges

## Durée
~2 j-p

## Commande
```bash
pnpm vitest run src/components/admin/content-studio-v2 --reporter=verbose
```

## Acceptance
- [ ] 98 tests passent
- [ ] Coverage ≥ 85% pour tous les composants publish
- [ ] 0 régression sur tests existants
