# Animations & Motion

Objectif : donner du "life" sans créer de latence ni gêner l'accessibilité.

## Principes
- Animation doit clarifier un changement d'état.
- Courte, cohérente, GPU-friendly (transform/opacity).
- Respect `prefers-reduced-motion`.

## Durées recommandées
- Desktop : 150-220ms pour transitions UI simples.
- Mobile : 225-300ms.

## Éléments animés

### 1) Ouverture/fermeture drawer
- transform: translateX / translateY
- opacity overlay
- easing standard

### 2) Chips
- micro transition sur active state (bg/scale léger)

### 3) Skeleton loader
- shimmer doux, ou pulse léger (option)

### 4) Vote "utile" (si activé plus tard)
- micro bounce très léger

### 5) Photo lightbox
- zoom-in/out 180-240ms

## Motion tokens (proposition)
- --motion-fast: 150ms
- --motion-medium: 220ms
- --motion-slow: 300ms
- --ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1)
- --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1)

## Accessibilité motion
- Si `prefers-reduced-motion: reduce`:
  - supprimer translations, garder fade 80-120ms
  - désactiver shimmer
