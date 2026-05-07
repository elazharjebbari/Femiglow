# Neon Postgres

## Plan

| Plan | Choix | Coût |
|---|---|---|
| Neon Pro | obligatoire (PITR 7j, branches illimitées) | ~19 USD/mois |
| Compute | autoscale 0.25-1 vCPU | suffisant volume FemiGlow |
| Storage | facturé à l'usage | < 1 GB an 1 |
| Régions | `eu-central-1` (Francfort) | UE, proche Maroc |

## Architecture des branches

```
main (production)
├── dev (branche partagée pour staging interne — optionnel)
├── pr-42 (auto par PR)
├── pr-43 (auto par PR)
└── e2e (branche persistante pour tests CI)
```

| Branche | Source | Reset |
|---|---|---|
| `main` | n/a | jamais |
| `dev` | snapshot de main | manuel hebdomadaire |
| `pr-{n}` | snapshot de main | auto à chaque push (par GH integration) |
| `e2e` | snapshot de main | reset avant chaque suite E2E |

## Connexion

Deux URLs selon usage :

| URL | Pooler | Usage |
|---|---|---|
| `DATABASE_URL` | oui (PgBouncer transaction mode) | requêtes runtime applicatif |
| `DIRECT_DATABASE_URL` | non | migrations drizzle-kit (DDL) |

Le pooler est nécessaire pour serverless (Vercel functions) — chaque
invocation ouvre une nouvelle connexion sinon.

## Driver

```ts
// apps/web/src/lib/db/client.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

`@neondatabase/serverless` utilise HTTP fetch (pas WebSocket) — compatible
edge & serverless, latence ~100ms cold.

## Migrations

```bash
# Génération depuis schema.ts
pnpm drizzle-kit generate

# Application sur DATABASE_URL courante
pnpm drizzle-kit migrate

# Ou directement (preview/test) :
pnpm drizzle-kit push
```

Sur Neon branches preview, les migrations sont appliquées
automatiquement par un step CI :

```yaml
- name: Apply migrations on preview branch
  run: pnpm drizzle-kit migrate
  env:
    DIRECT_DATABASE_URL: ${{ secrets.NEON_PREVIEW_DIRECT_URL }}
```

## PITR (Point-In-Time Recovery)

Plan Pro : 7 jours. Couvre la majorité des incidents (suppression
accidentelle, migration cassée).

Procédure :
1. Dashboard Neon → Restore.
2. Sélectionner timestamp.
3. Crée une nouvelle branche depuis ce point.
4. Promouvoir cette branche en `main` via switch.

## Backups manuels

Au-delà de PITR 7j :

```bash
pg_dump $DATABASE_URL --format=custom --no-owner --no-privileges \
  > backups/femiglow-$(date +%Y%m%d).dump

aws s3 cp backups/femiglow-*.dump \
  s3://femiglow-backups/$(date +%Y/%m)/ \
  --sse aws:kms --sse-kms-key-id alias/femiglow-backups
```

À automatiser via GitHub Action mensuelle (1er du mois) :

```yaml
on:
  schedule:
    - cron: '0 4 1 * *'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps: …
```

## Surveillance Neon

| Métrique | Seuil alerte |
|---|---|
| Storage size | warning 5 GB, critique 10 GB |
| Compute hours | warning 80 % du quota |
| Connections actives | warning > 50 |
| Replication lag | warning > 10s (non applicable v1, pas de réplica) |
| Slow queries (>1s) | warning > 5/heure |

Alerts via Neon dashboard (Settings → Alerting).

## Sécurité Neon

- TLS obligatoire (sslmode=require).
- IP allowlist : non v1 (Vercel utilise IPs dynamiques).
- Auth : credentials chiffrés en variables Vercel.
- 2FA Neon : activé pour le compte propriétaire.
- API keys : un seul key par environnement, rotation annuelle.

## Optimisations

### Index covering

Quand une requête lit toujours les mêmes colonnes, ajouter `INCLUDE`
clause si volume justifie. Pas v1.

### Vacuum

Géré par autovacuum Postgres (paramètres par défaut Neon adéquats).
Surveillance via `pg_stat_user_tables.last_autovacuum`.

### Connection limits

Neon Pro : 100 connections par compute. Pooler PgBouncer : multiplexe.
Vercel serverless = ~1 conn/invocation, donc largement sous le plafond.

## Tests

| Type | Vérification |
|---|---|
| Smoke | `pnpm db:ping` (script trivial qui SELECT 1) |
| Migration | CI applique migrations sur Neon branch sans erreur |
| Backup | restauration test trimestrielle (PITR) |
