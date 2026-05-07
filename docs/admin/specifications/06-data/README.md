# 06 — Data layer

Spécification du modèle de données : schéma SQL, ERD, indexes,
relations, migrations, seeds, rétention.

## Fichiers

| Fichier | Contenu |
|---|---|
| [`schema.sql`](./schema.sql) | DDL complet annoté |
| [`schema-erd.puml`](./schema-erd.puml) | Diagramme entité-relation PlantUML |
| [`tables.csv`](./tables.csv) | Inventaire des tables (volume, criticité, conservation) |
| [`indexes.md`](./indexes.md) | Catalogue des indexes + justification |
| [`relations.md`](./relations.md) | Cardinalités, contraintes FK, cascade |
| [`migrations-strategy.md`](./migrations-strategy.md) | Workflow drizzle-kit, règles de safety |
| [`seeds.md`](./seeds.md) | Données initiales (compte admin, endpoints test) |
| [`retention-policy.md`](./retention-policy.md) | Politique de conservation par table (RGPD/loi 09-08) |

## Stack

| Couche | Technologie |
|---|---|
| Base de données | Postgres 15 (Neon) |
| ORM | Drizzle ORM (typesafe SQL) |
| Driver | `@neondatabase/serverless` (websocket) |
| Migrations | drizzle-kit (génération SQL versionnée) |
| IDs | cuid2 (24 caractères, lexicographiquement triable) |
| Encryption at-rest | `pgcrypto` (`pgp_sym_encrypt` / `pgp_sym_decrypt`) |

## Principes

1. **Soft-delete** par défaut (`deleted_at`) sur entités utilisateurs (leads, webhooks, admins).
2. **Audit immuable** : table `audit_events` append-only.
3. **Idempotence** : tout webhook delivery a un `idempotency_key` unique.
4. **Pas de cascade DELETE** : la suppression douce conserve l'historique.
5. **Time travel impossible** : pas de rollback de soft-delete par UI v1 (manuel SQL si besoin).
