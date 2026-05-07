# Stratégie de migrations

## Outil

`drizzle-kit` (génération SQL versionnée à partir du schéma TS).

## Workflow

```
┌─────────────────────┐
│ 1. Modifier schema.ts│
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 2. drizzle-kit generate │
│    → drizzle/0042_xxx.sql │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 3. Relire le SQL    │
│    (humain obligatoire) │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. Tester en local  │
│    pnpm db:migrate  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 5. Commit & PR      │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 6. CI applique sur preview │
│    (Neon branch éphémère)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 7. Merge → prod auto │
└─────────────────────┘
```

## Règles de safety

### NEVER en prod

| Opération | Pourquoi |
|---|---|
| `DROP TABLE` | perte de données, irréversible |
| `DROP COLUMN` | perte de données |
| `ALTER COLUMN ... TYPE ...` (incompatible) | risque de cast échoué |
| `RENAME COLUMN` (sans déploiement deux phases) | ancienne version du code peut écrire sur l'ancienne colonne |

### Toujours en deux phases

Pour un renommage/retrait :

1. **Phase 1** (déploiement N) : ajouter la nouvelle colonne, écrire dans les deux, lire depuis les deux (préférer la nouvelle).
2. **Phase 2** (déploiement N+1, après backfill et stabilisation ≥ 24h) : supprimer l'ancienne colonne.

Documenté inline dans la PR avec checkbox "Phase 2 planifiée pour le _____".

### Toujours testé sur Neon branch

Chaque PR crée automatiquement une Neon branch (preview) sur laquelle :
1. Les migrations sont appliquées.
2. Les tests d'intégration tournent.
3. Un seed minimal est chargé.

Si la migration échoue → CI rouge → pas de merge.

## Convention de nommage

`drizzle/{numero}_{verbe}_{table}_{detail}.sql`

| Exemple |
|---|
| `0001_create_admin_users.sql` |
| `0002_create_leads.sql` |
| `0014_add_lead_events_meta_index.sql` |
| `0023_alter_webhook_endpoints_add_description.sql` |

Le numéro est attribué par drizzle-kit séquentiellement.

## Migrations data-only

Quand on doit transformer des données existantes (ex: backfill d'une
nouvelle colonne), créer un fichier séparé :

`apps/web/scripts/data-migrations/{numero}_{description}.ts`

```ts
// 003_backfill_lead_source.ts
import { db } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';

(async () => {
  const updated = await db
    .update(leads)
    .set({ source: 'form:contact' })
    .where(isNull(leads.source));
  console.log(`Backfilled ${updated.rowCount} rows.`);
})();
```

Exécuté manuellement, **après** le déploiement de la migration de schéma.

## Rollback

| Cas | Procédure |
|---|---|
| Migration cassée à l'application | Neon PITR (point-in-time restore) sur le moment précédant la migration |
| Migration appliquée mais bug applicatif | revert le code via PR, garder la migration de schéma (additive) |
| Données corrompues | Neon PITR + replay des écritures depuis logs si possible |

Documenté dans [`../09-environnement/runbook-incident.md`](../09-environnement/runbook-incident.md).

## Migration de l'enum

Postgres ne permet pas `DROP VALUE` sur un type ENUM. Stratégie :

1. **Ajouter une valeur** : `ALTER TYPE lead_status ADD VALUE 'archived';` (sûr).
2. **Renommer une valeur** : `ALTER TYPE lead_status RENAME VALUE 'old' TO 'new';` (Postgres 10+).
3. **Retirer une valeur** : nécessite recréation du type — éviter, ou planifier en migration majeure.

## Tests

| Type | Fichier |
|---|---|
| CI | step `pnpm db:migrate:check` (drizzle vérifie schema vs migrations) |
| Integration | tests `vitest` exécutés contre la Neon branch preview |
