# 02 — Backend

Spécifications backend détaillées avec code copiable.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`migrations.md`](./migrations.md) | Migration SQL `0075_legal_vars_rename_and_add.sql` + scripts |
| [`helpers.md`](./helpers.md) | `presetVarsForPage`, feature flag, cleanup logic |
| [`api-routes.md`](./api-routes.md) | POST `/api/admin/legal/template-vars` + DELETE cleanup-e2e |
| [`templates-refonte.md`](./templates-refonte.md) | Nouvelle version 4 templates avec anonymisation |

## Ordre d'implémentation suggéré

1. **Feature flag** : `legal/feature-flag.ts` + env var
2. **Helpers** : `presetVarsForPage` + `cleanupLegalE2E`
3. **API routes** : POST template-vars + DELETE cleanup-e2e
4. **Migration** : SQL `0075` (rename + insert)
5. **Templates** : refonte 4 fichiers source + republish

## Principes

- **Backward-compat** : feature flag off → comportement strictement identique à l'avant
- **Idempotent** : migration ré-exécutable sans effet (`ON CONFLICT DO NOTHING`, `WHERE` conditions)
- **Auditable** : chaque mutation logguée avec acteur
- **Sécurité** : endpoints admin-only avec validation Zod stricte
