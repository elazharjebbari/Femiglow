# 04 — Frontend

> Spécifications d'implémentation côté client. Routes, composants,
> hooks, gestion d'état, formulaires, fetching. Aligné sur Next.js 14
> App Router et la philosophie Server Components définie en
> [ADR-005](../01-architecture/adr/adr-005-server-components.md).

---

## Contenu

| Fichier | Rôle |
|---|---|
| [`structure-fichiers.txt`](./structure-fichiers.txt) | Arborescence des fichiers à créer |
| [`routing.md`](./routing.md) | Routes, layouts, params, search params |
| [`components-tree.puml`](./components-tree.puml) | Arbre de composition |
| [`state-management.md`](./state-management.md) | Quand utiliser quoi (Server vs Client, URL vs state) |
| [`form-handling.md`](./form-handling.md) | Pattern react-hook-form + Zod |
| [`data-fetching.md`](./data-fetching.md) | Reads (Drizzle direct), writes (route handlers) |
| [`rendering-strategy.md`](./rendering-strategy.md) | SSR, ISR, dynamic, Suspense, streaming |
| [`error-boundaries.md`](./error-boundaries.md) | error.tsx, not-found.tsx, fallback |
| [`pages/`](./pages/) | Spec détaillée de chaque page |
