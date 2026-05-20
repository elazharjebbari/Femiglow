# 04 — Frontend

Composants React, state Zustand, routing Next.js App Router.

## Contenu

| Fichier | Contenu |
|---|---|
| [component-tree.md](./component-tree.md) | Arborescence des composants + props |
| [state-management.md](./state-management.md) | Store Zustand + invariants |
| [routing.md](./routing.md) | Routes admin + redirections legacy |
| [component-architecture.puml](./component-architecture.puml) | Diagramme composants |

## Stack

- React 18 (déjà en place).
- Next.js 14 App Router.
- Zustand (déjà standard projet, ex: `useWizardStore`, `useChatStore`).
- TanStack Query côté admin (pour fetch + cache + retry) — à ajouter si pas déjà.
- Tailwind CSS pour le styling (déjà standard).
- `framer-motion` pour transitions wizard (optionnel).

## Principe

- **Un seul store** d'édition (`useTrackingPlanStore`). Source de vérité du draft client.
- **Persistence** : `localStorage` clé `femiglow.tracking-plan-draft.v1` (similaire au wizard checkout).
- **Auto-save** : PATCH server toutes les 5s si `isDirty` (silencieux, sans toast).
- **Optimistic UI** : les mutations affichent le résultat avant la confirmation server.
