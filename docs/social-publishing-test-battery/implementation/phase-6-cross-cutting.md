# Phase 6 — Cross-cutting

## Specs

### a11y.spec.ts
- axe scan sur 4 pages (create, plan, library, home)
- avant et après data (8 scans)
- Focus trap dialogs
- All buttons have accessible name

### dark-mode.spec.ts
- Snapshots 4 pages en dark mode

### responsive.spec.ts
- 3 viewports × 4 pages = 12 vérifications (no horizontal overflow)

### keyboard.spec.ts
- Cmd+S flush
- Esc closes
- Tab order

## Durée
~0.5 j-p

## Acceptance
- [ ] 0 critical axe violation
- [ ] 0 overflow horizontal aux 3 viewports
- [ ] Keyboard nav fonctionnelle
