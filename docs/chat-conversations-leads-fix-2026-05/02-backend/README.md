# 02 — Backend

Spécifications de toutes les modifications backend, avec code copiable.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`queries-admin.md`](./queries-admin.md) | Code complet des 7 queries admin modifiées |
| [`repos.md`](./repos.md) | Code des 2 repos modifiés + 1 nouveau (cleanup) |
| [`api-routes.md`](./api-routes.md) | Code complet du endpoint `/api/admin/chat/cleanup-ghosts` |
| [`migrations.md`](./migrations.md) | Migration Drizzle SQL + backfill historique |

## Ordre d'implémentation suggéré

1. **Migration** (`migrations.md`) — ajout colonne `kind` + index + backfill
2. **Feature flag** (extension de `src/lib/chat/feature-flag.ts`)
3. **Repos** (`repos.md`) — insert avec `kind` explicite
4. **Queries** (`queries-admin.md`) — filtres derrière flag
5. **API route** (`api-routes.md`) — cleanup endpoint
6. **Tests** (cf. dossier `05-tests/`)

## Principes

- **Backward-compat strict** : aucun changement n'a d'effet si `CHAT_ADMIN_FILTERS_V2=false`.
- **Tests d'invariant** : chaque insert vérifie `kind` valide via le test schema.
- **Logs structurés** : chaque insert log `kind` pour audit ex-post.
- **Performance** : index `chat_session_kind_status_idx` créé en `CONCURRENTLY` pour éviter lock.
