# 10 — Taxonomie des erreurs & tolérance à l'échec

## Convention

Chaque erreur a :
- **Code** : `UPPER_SNAKE_CASE` stable
- **HTTP** : code statut côté API
- **Exit** : code de sortie CLI (0=success, 1-91 reserved)
- **Critique** : `true` = stop le reset (déclenche rollback si applicable), `false` = continue
- **User-facing** : message simple pour l'admin
- **Diagnostic** : ce qu'on affiche en plus dans le panneau erreur

## Classes d'erreurs

### A — Erreurs préfight (avant tout impact)

| Code                       | HTTP | Exit | Critique | Phase     | User-facing                                    | Action UI               |
|----------------------------|------|------|----------|-----------|------------------------------------------------|-------------------------|
| `AUTH_REQUIRED`            | 401  | 3    | ✅       | n/a       | Connexion admin requise                         | Redirect login          |
| `AUTH_INSUFFICIENT`        | 403  | 3    | ✅       | n/a       | Vous n'avez pas la permission de reset          | Blocage écran           |
| `LOCK_HELD`                | 409  | 5    | ✅       | n/a       | Un reset est déjà en cours                       | Lien voir le job actif  |
| `RATE_LIMIT_EXCEEDED`      | 429  | 5    | ✅       | n/a       | Trop de tentatives, ressayez dans X minutes      | Compte à rebours        |
| `CONFIRM_TEXT_MISMATCH`    | 400  | 4    | ✅       | n/a       | Le texte de confirmation ne correspond pas       | Inline error sur input  |
| `CONFIG_INVALID`           | 400  | 2    | ✅       | n/a       | Configuration invalide                          | Détail Zod errors       |
| `DB_UNREACHABLE`           | 503  | 10   | ✅       | preflight | Base de données inaccessible                     | Diagnostic + retry      |
| `DB_LOCKS_HELD`            | 503  | 10   | ⚠       | preflight | Sessions SQL bloquantes — réessayer dans 30 s    | Liste sessions          |
| `DISK_LOW`                 | 507  | 10   | ✅       | preflight | Espace disque insuffisant pour backup            | Affiche df -h           |
| `BOOTSTRAP_ENV_MISSING`    | 500  | 10   | ✅       | preflight | ADMIN_BOOTSTRAP_EMAIL ou PASSWORD manquant       | Lien doc setup          |
| `MEDIA_DIR_NOT_WRITABLE`   | 500  | 10   | ✅       | preflight | MEDIA_LOCAL_DIR non writable                     | Affiche path + perms    |
| `GIT_DIRTY`                | 400  | 10   | ⚠       | preflight | Working tree git modifié — risque incohérence    | Bouton "ignorer"        |

### B — Erreurs backup (avant destructif)

| Code                       | HTTP | Exit | Critique | Phase  | User-facing                                | Action                |
|----------------------------|------|------|----------|--------|--------------------------------------------|-----------------------|
| `BACKUP_PG_DUMP_FAILED`    | 500  | 11   | ✅       | backup | pg_dump a échoué — voir logs               | Stop, pas de rollback |
| `BACKUP_TAR_FAILED`        | 500  | 11   | ✅       | backup | tar des médias a échoué                    | Stop, pas de rollback |
| `BACKUP_TOO_SMALL`         | 500  | 11   | ✅       | backup | Backup trop petit (< 1 MB) — suspect       | Stop                  |
| `BACKUP_SHA256_FAILED`     | 500  | 11   | ✅       | backup | Validation sha256 du backup échouée        | Stop                  |

### C — Erreurs destructives (post-backup, déclenchent rollback)

| Code                          | HTTP | Exit | Critique | Phase       | User-facing                                       | Action                       |
|-------------------------------|------|------|----------|-------------|---------------------------------------------------|------------------------------|
| `WIPE_DB_TRANSACTION_FAILED`  | 500  | 12   | ✅       | wipe-db     | Transaction wipe DB a échoué                       | Rollback DB depuis backup    |
| `WIPE_MEDIA_FAILED`           | 500  | 13   | ⚠       | wipe-media  | Suppression média partielle                        | Continue, warn dans rapport  |
| `MIGRATE_FAILED`              | 500  | 14   | ✅       | migrate     | drizzle-kit migrate a planté                        | Rollback DB                  |
| `MIGRATE_TIMEOUT`             | 504  | 14   | ✅       | migrate     | Timeout sur migrate                                 | Rollback DB                  |
| `SEED_FAILED`                 | 500  | 15   | ⚠       | seed        | Un ou plusieurs seeders ont échoué                  | Continue, rapport détail     |
| `SEED_CONTRACT_BROKEN`        | 500  | 15   | ✅       | seed        | Un seeder critique (admin/branding) a planté        | Rollback DB                  |
| `VERIFY_FAILED`               | 500  | 16   | ⚠       | verify      | Vérifications post-reset KO                         | Continue, rapport            |

### D — Erreurs rollback (état critique)

| Code                       | HTTP | Exit | Critique | User-facing                                              | Action                            |
|----------------------------|------|------|----------|----------------------------------------------------------|-----------------------------------|
| `ROLLBACK_DB_FAILED`       | 500  | 91   | ✅       | ROLLBACK DB A ÉCHOUÉ — état indéterminé                  | Bloc rouge + commandes manuelles  |
| `ROLLBACK_MEDIA_FAILED`    | 500  | 91   | ✅       | ROLLBACK MÉDIAS A ÉCHOUÉ                                  | Bloc rouge + commandes            |
| `ROLLBACK_BACKUP_MISSING`  | 500  | 91   | ✅       | Backup référencé introuvable                              | Bloc rouge                        |
| `ROLLBACK_SHA256_MISMATCH` | 500  | 91   | ✅       | Backup corrompu (sha256 mismatch)                         | Bloc rouge                        |

### E — Erreurs UI (côté client)

| Code                       | User-facing                                                    | Action                          |
|----------------------------|----------------------------------------------------------------|---------------------------------|
| `SSE_DISCONNECTED`         | Connexion temps réel perdue                                     | Fallback polling automatique    |
| `SSE_REPLAY_FAILED`        | Impossible de récupérer l'historique du job                     | Affiche snapshot via GET /jobs/[id] |
| `FETCH_NETWORK_ERROR`      | Erreur réseau                                                  | Retry button                    |
| `FETCH_TIMEOUT`            | Délai dépassé                                                  | Retry                           |

## Tolérance à l'échec — décisions par phase

### Phase 1 — Preflight
- **Toute erreur** = stop avant tout impact. Pas de rollback nécessaire.

### Phase 2 — Backup
- **Toute erreur** = stop. Pas de rollback (rien n'est touché).
- Diagnostics : afficher la commande pg_dump qui a planté, stderr, df -h actuel.

### Phase 3 — Audit counts
- **Erreur non critique** = continue (le diff post sera incomplet, c'est tout).

### Phase 4 — Wipe DB
- **Erreur** = ROLLBACK DB (depuis backup). Phase critique car post-destruction.

### Phase 5 — Wipe média
- **Erreur** = continue avec warning. Pourquoi : un fichier média impossible à supprimer
  (read-only flag, NFS down) ne doit pas bloquer le reset DB.
- Listé dans le rapport final comme warning.

### Phase 6 — Wipe cache
- **Erreur** = continue. Le cache se reconstruira au prochain build.

### Phase 7 — Migrate
- **Erreur** = ROLLBACK DB. Phase critique.

### Phase 8 — Seed
- **Erreur sur seeder non critique** (chat, tracking, rituals) = continue, rapport.
- **Erreur sur seeder critique** (admin, branding, products) = ROLLBACK DB.

### Phase 9 — Verify
- **Erreur** = continue, rapport montre quels checks ont échoué.
- Pas de rollback (le reset s'est fait, c'est la verify qui rate).
- Si verify détecte état totalement cassé (HTTP 500 sur /kit) : recommande explicitement
  un restore manuel.

### Phase 10 — Cleanup backups
- **Erreur** = continue. Vieux backups qui restent ne sont pas critiques.

## Classification d'une erreur runtime

`lib/reset/errors.ts` :

```typescript
export class ResetError extends Error {
  constructor(
    public readonly code: ResetErrorCode,
    public readonly phase: PhaseName | 'pre',
    message: string,
    public readonly cause?: unknown,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ResetError';
  }
}

export function classifyError(err: unknown, phase: PhaseName): ClassifiedError {
  if (err instanceof ResetError) return { code: err.code, phase, message: err.message, ...};

  // Patterns connus
  if (err && typeof err === 'object' && 'code' in err) {
    if (err.code === 'ECONNREFUSED' && phase === 'migrate') {
      return { code: 'DB_UNREACHABLE', phase, message: 'PostgreSQL injoignable', critical: true };
    }
    if (err.code === 'ENOSPC') {
      return { code: 'DISK_LOW', phase, message: 'Disque plein', critical: true };
    }
    if (err.code === 'EACCES') {
      return { code: 'MEDIA_DIR_NOT_WRITABLE', phase, message: 'Permission refusée', critical: true };
    }
  }

  // Fallback
  return {
    code: 'UNKNOWN',
    phase,
    message: err instanceof Error ? err.message : String(err),
    critical: true,
    stack: err instanceof Error ? err.stack : undefined,
  };
}
```

## Format SSE de l'erreur

```json
{
  "type": "phase.error",
  "phase": "migrate",
  "ts": "2026-05-13T08:17:43.298Z",
  "error": {
    "code": "MIGRATE_FAILED",
    "message": "drizzle-kit migrate exited with code 1",
    "critical": true,
    "cause": "duplicate key value violates unique constraint",
    "meta": {
      "stderr": "<200 chars max>",
      "exitCode": 1
    }
  }
}
```

## Couverture tests

Chaque code d'erreur doit avoir au moins **un test** qui :
1. Reproduit la condition.
2. Vérifie que `classifyError` retourne le bon code.
3. Vérifie que l'orchestrator réagit selon la table (rollback ou continue).
