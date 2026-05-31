# Frontend - State management

## Principes
- Un seul store pour le drawer (éviter états éclatés).
- Garder état de filtre + scroll position pour retour depuis product modal.

## State minimal
- isOpen
- view
- roomSlug
- contextProductKey
- filters
- sort
- cursor
- items
- total
- summary
- ui: loading flags

## Persist (session)
- lastFiltersByRoom
- lastScrollPositionByRoom
