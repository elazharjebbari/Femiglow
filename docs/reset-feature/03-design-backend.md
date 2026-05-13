# 03 — Conception backend

## Arborescence

```
apps/web/src/
├── lib/reset/
│   ├── index.ts                  # API publique (start, restore)
│   ├── types.ts                  # types ResetMode, ResetPlan, PhaseEvent, …
│   ├── planner.ts                # mode → liste de phases + tables ciblées
│   ├── orchestrator.ts           # boucle phases + emit events + abort + audit
│   ├── job-store.ts              # mêmes pattern que seeders (singleton, TTL, buffer)
│   ├── lock.ts                   # mutex global (1 reset à la fois)
│   ├── config-schema.ts          # Zod schema de ResetConfig (validation)
│   ├── confirm.ts                # validation du texte typé ("RESET" / "HARD RESET")
│   ├── restore.ts                # restore depuis backup
│   └── phases/
│       ├── preflight.ts          # pré-checks, lecture seule
│       ├── backup.ts             # pg_dump + tar média + manifest
│       ├── audit-counts.ts       # snapshot row counts before
│       ├── wipe-db.ts            # DROP SCHEMA ou TRUNCATE selon mode
│       ├── wipe-media.ts         # rm -rf .media-storage/*
│       ├── wipe-cache.ts         # rm -rf .next (suite à hard)
│       ├── migrate.ts            # drizzle-kit migrate
│       ├── seed.ts               # délégué à lib/seeders/orchestrator
│       ├── verify.ts             # row count diff + HTTP smoke tests
│       └── cleanup-backups.ts    # prune old backups
├── app/api/admin/reset/
│   ├── route.ts                  # GET (liste backups), POST (run)
│   ├── preflight/route.ts        # GET (plan + impact)
│   ├── run/route.ts              # POST (start job)
│   ├── jobs/[jobId]/route.ts     # GET (snapshot)
│   ├── jobs/[jobId]/stream/route.ts  # GET (SSE)
│   ├── jobs/[jobId]/cancel/route.ts  # POST
│   ├── restore/route.ts          # POST (restore from backup)
│   └── backups/route.ts          # GET (list backups)
└── scripts/reset.ts              # CLI entry-point
```

## Types principaux (`lib/reset/types.ts`)

```typescript
export type ResetMode = 'soft' | 'medium' | 'hard' | 'custom';

export type ResetDomain =
  | 'commerce'   // products, variants, form_config, delivery_cities
  | 'content'    // site_components, media, seo, ritual_testimonials
  | 'tracking'   // tracking_*, experiments, insights
  | 'chat'       // chat_*
  | 'system';    // app_config, app_config_snapshots

export interface ResetConfig {
  mode: ResetMode;
  domains?: ResetDomain[];          // mode=custom only
  preserve: Array<                  // tables jamais touchées
    | 'admin_users'
    | 'orders'
    | 'order_items'
    | 'leads'
    | 'lead_events'
    | 'chat_lead'
    | 'audit_events'
    | 'ritual_testimonials'
  >;
  wipeMedia: boolean;
  wipeNextCache: boolean;
  withBackup: boolean;              // default true; false interdit en hard
  keepBackups: number;              // default 5
  dryRun: boolean;
  confirm: string;                  // doit valoir RESET ou HARD RESET
  actorId: string | null;
}

export type PhaseName =
  | 'preflight' | 'backup' | 'audit-counts'
  | 'wipe-db'   | 'wipe-media' | 'wipe-cache'
  | 'migrate'   | 'seed' | 'verify' | 'cleanup-backups';

export interface PhaseDescriptor {
  name: PhaseName;
  label: string;
  critical: boolean;             // si false: échec n'arrête pas la suite
  estimatedDurationMs: number;
  run: (ctx: PhaseContext) => Promise<PhaseResult>;
}

export interface PhaseContext {
  config: ResetConfig;
  plan: ResetPlan;
  backupId?: string;
  before?: RowCountsSnapshot;
  signal: AbortSignal;
  onProgress?: (label: string, fraction: number) => void;
  onLog?: (entry: LogEntry) => void;
}

export interface PhaseResult {
  stats: Record<string, unknown>;
  summary: string;
  warnings?: string[];
}
```

## Planner (`lib/reset/planner.ts`)

Transforme une `ResetConfig` en `ResetPlan` (liste ordonnée de phases) :

| Mode    | Phases                                                                      |
|---------|-----------------------------------------------------------------------------|
| soft    | preflight → audit-counts → seed → verify                                     |
| medium  | preflight → backup → audit-counts → wipe-db (TRUNCATE) → seed → verify → cleanup |
| hard    | preflight → backup → audit-counts → wipe-db (DROP) → wipe-media → wipe-cache → migrate → seed → verify → cleanup |
| custom  | preflight → backup → audit-counts → wipe-db (TRUNCATE par domaine) → [wipe-media?] → seed (filtré) → verify → cleanup |

Le planner produit aussi la liste des tables impactées et la liste des seeders qui vont
tourner (basée sur `SEEDERS_REGISTRY` filtrée par domaine).

## Orchestrator (`lib/reset/orchestrator.ts`)

Inspiré de `lib/seeders/orchestrator.ts` :

```typescript
export async function runReset(
  config: ResetConfig,
  job: ResetJob,
): Promise<ResetReport> {
  const plan = makePlan(config);
  emit('job.start', { plan });
  let backupId: string | undefined;
  const ctx: PhaseContext = { config, plan, signal: job.abort.signal, ... };

  for (const phase of plan.phases) {
    if (job.abort.signal.aborted) break;
    try {
      emit('phase.start', { phase: phase.name });
      const t0 = Date.now();
      const result = await phase.run({ ...ctx, backupId });
      if (phase.name === 'backup') backupId = result.stats.backupId;
      emit('phase.complete', { phase: phase.name, durationMs: Date.now() - t0, ...result });
      await logAuditEvent({ action: `reset.${phase.name}`, meta: result });
    } catch (err) {
      const classified = classifyError(err);
      emit('phase.error', { phase: phase.name, error: classified });
      if (phase.critical) {
        if (backupId && phaseHadDestructiveStarted(phase.name)) {
          emit('rollback.start', { backupId });
          await restoreFromBackup(backupId);
          emit('rollback.complete', { backupId });
        }
        emit('job.failed', { error: classified });
        return { status: 'failed', error: classified };
      }
      // non critique: continue
    }
  }
  emit('job.complete', { summary });
  return { status: 'completed', summary };
}
```

## Backup (`lib/reset/phases/backup.ts`)

```typescript
export async function runBackup(ctx: PhaseContext): Promise<PhaseResult> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `bkp_${ts}`;
  const dir = path.join(BACKUP_ROOT, backupId);
  await fs.mkdir(dir, { recursive: true });

  // 1. pg_dump
  ctx.onProgress?.('Dump SQL', 0.1);
  await exec(
    `pg_dump --no-owner --no-acl --format=plain --file=${dir}/db.sql ${process.env.DATABASE_URL}`,
    { signal: ctx.signal },
  );
  await exec(`gzip -9 ${dir}/db.sql`);

  // 2. tar média (seulement si wipeMedia)
  if (ctx.config.wipeMedia) {
    ctx.onProgress?.('Archive média', 0.4);
    await exec(
      `tar -czf ${dir}/media.tar.gz -C ${path.dirname(MEDIA_LOCAL_DIR)} ${path.basename(MEDIA_LOCAL_DIR)}`,
      { signal: ctx.signal },
    );
  }

  // 3. manifest avec sha256
  ctx.onProgress?.('Manifest', 0.9);
  const dbSize = (await fs.stat(`${dir}/db.sql.gz`)).size;
  const mediaSize = ctx.config.wipeMedia
    ? (await fs.stat(`${dir}/media.tar.gz`)).size
    : 0;
  const dbSha = await sha256(`${dir}/db.sql.gz`);
  const mediaSha = ctx.config.wipeMedia ? await sha256(`${dir}/media.tar.gz`) : null;

  const manifest = {
    backupId, takenAt: new Date().toISOString(),
    mode: ctx.config.mode, actorId: ctx.config.actorId,
    db: { size: dbSize, sha256: dbSha, path: 'db.sql.gz' },
    media: ctx.config.wipeMedia
      ? { size: mediaSize, sha256: mediaSha, path: 'media.tar.gz' }
      : null,
    gitCommit: getCurrentGitCommit(),
  };
  await fs.writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));

  // 4. validation taille
  if (dbSize < MIN_DB_SIZE_BYTES) {
    throw new BackupValidationError(`DB dump trop petit (${dbSize} < ${MIN_DB_SIZE_BYTES})`);
  }

  return {
    stats: { backupId, dbSize, mediaSize, path: dir },
    summary: `Backup ${backupId} · ${formatBytes(dbSize + mediaSize)}`,
  };
}
```

## Wipe DB (`lib/reset/phases/wipe-db.ts`)

Deux stratégies selon `plan.dbStrategy` :

### `drop-schema` (hard)
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
DROP SCHEMA IF EXISTS drizzle CASCADE;
GRANT ALL ON SCHEMA public TO femiglow;
```

### `truncate` (medium / custom)
```sql
-- Pour chaque table du plan, sauf les tables préservées
TRUNCATE products, product_variants, product_snapshots, product_stock,
         form_config, form_config_history, ...
RESTART IDENTITY CASCADE;
```

Encapsulé dans **une seule transaction** ; en cas d'échec partiel,
`ROLLBACK` automatique (rien n'est wipé si la liste est invalide).

## Verify (`lib/reset/phases/verify.ts`)

Check list post-reset, chacun produit un `VerificationCheck` :

| Check                                        | Action                                      | Critique |
|----------------------------------------------|---------------------------------------------|----------|
| DB tables présentes                          | `SELECT COUNT FROM information_schema.tables` | ✅       |
| Migrations appliquées                        | `SELECT COUNT FROM drizzle.__drizzle_migrations` ≥ 27 | ✅       |
| Produits seedés                              | `products` ≥ 1                              | ✅       |
| Variante FEMI-KIT-100 prix 199 dh            | `SELECT promo_price_cents FROM product_variants WHERE sku='FEMI-KIT-100'` = 19900 | ✅ |
| Image kit principale présente               | fs.exists(.media-storage/media/<id>/jpeg/2xl.jpeg) | ✅ |
| HTTP GET /kit → 200, contient "199"          | curl                                       | ✅       |
| HTTP GET /admin/login → 200                  | curl                                       | ✅       |
| Admin bootstrap recréé                       | `admin_users` ≥ 1 avec email bootstrap     | ✅       |
| Pas de média orphelin                        | join media table ↔ FS                       | ⚠ warn   |

Le rapport de verify est inclus dans `job.complete` event et persisté en audit.

## Lock global (`lib/reset/lock.ts`)

```typescript
let activeJobId: string | null = null;

export function acquireLock(jobId: string): boolean {
  if (activeJobId) return false;
  activeJobId = jobId;
  return true;
}

export function releaseLock(jobId: string): void {
  if (activeJobId === jobId) activeJobId = null;
}

export function isLocked(): boolean { return activeJobId !== null; }
```

Vérifie également qu'aucun job seeders n'est en cours via
`seedersJobStore.hasRunningJob()` (cross-feature lock).

## CLI (`scripts/reset.ts`)

```typescript
#!/usr/bin/env tsx
import { Command } from 'commander';
const program = new Command();

program
  .name('reset')
  .description('FemiGlow reset CLI')
  .version('1.0.0');

program.command('run')
  .option('--mode <mode>', 'soft|medium|hard|custom', 'soft')
  .option('--domains <list>', 'comma-separated for custom mode')
  .option('--preserve <list>', 'tables to preserve', 'admin_users,audit_events')
  .option('--no-backup', 'skip backup (refused for hard)')
  .option('--keep-backups <n>', 'backups to retain', '5')
  .option('--dry-run', 'plan only, no destructive action')
  .option('--non-interactive', 'skip typed confirmation')
  .option('--confirm <text>', 'confirmation text')
  .action(async (opts) => { /* ... */ });

program.command('restore')
  .requiredOption('--backup-id <id>')
  .option('--non-interactive')
  .action(async (opts) => { /* ... */ });

program.command('list-backups')
  .action(async () => { /* ... */ });

program.parse();
```

Exit codes :
- `0` : succès
- `1` : erreur générique
- `2` : usage invalide (CLI args)
- `3` : auth/preflight échouée
- `4` : confirmation manquante/invalide
- `5` : verrou pris (autre reset en cours)
- `10..19` : échec d'une phase (10+index)
- `90` : rollback réussi après échec
- `91` : rollback échoué (état critique, intervention humaine requise)

## Concurrence & idempotence

- **Lock fichier** en plus du lock mémoire : `/var/run/femiglow-reset.lock`
  (pour CLI parallèle au serveur ; le serveur reset via API met aussi le lock fichier).
- **Phase seed** déjà idempotente (chaque seeder l'est par contrat).
- **Phase backup** non rejouable sur même `backupId` (timestamp).

## Sécurité

- Tous les endpoints `/api/admin/reset/*` derrière `requireAdmin()`.
- Rate limit : 1 reset / 5 min / admin (clé : `reset.run.<adminId>`), via une map mémoire
  (ou table `admin_action_throttle` si on veut persistant).
- Vérification que `confirm` correspond au mode (`RESET` pour soft/medium/custom, `HARD RESET`
  pour hard).
- Headers `Cache-Control: no-store, X-Frame-Options: DENY` sur tous les endpoints.

## Audit

Une entrée par phase + une entrée job-level (`reset.run.start`, `reset.run.complete`,
`reset.run.failed`). Payload meta inclut `{ mode, plan, durationMs, summary, backupId }`.
