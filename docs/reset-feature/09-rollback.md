# 09 — Rollback & reversibilité

## Principes

Tout reset destructif (mode = `medium` ou `hard` ou `custom` avec wipe) crée
**obligatoirement** un backup. Le backup contient :

- `db.sql.gz` — dump SQL complet, format plain, gzippé
- `media.tar.gz` — archive du dossier média (`/var/www/femiglow/.media-storage/`)
  (seulement si `wipeMedia=true`)
- `manifest.json` — métadonnées + sha256 de chaque archive
- `pre-reset-counts.json` — row counts par table avant le reset

## Localisation

```
/var/backups/femiglow/
├── bkp_2026-05-13T08-15-22-345Z/
│   ├── db.sql.gz
│   ├── media.tar.gz
│   ├── manifest.json
│   └── pre-reset-counts.json
└── bkp_2026-05-13T09-42-11-783Z/
    └── ...
```

Permissions : `0700` (root only). Rétention : `keepBackups` (default 5) backups les plus
récents ; les plus anciens sont supprimés par la phase `cleanup-backups`.

## Format manifest.json

```json
{
  "backupId": "bkp_2026-05-13T08-15-22-345Z",
  "version": "1.0.0",
  "takenAt": "2026-05-13T08:15:22.345Z",
  "mode": "hard",
  "actorId": "adm_xxxxxxxxxxxxxxxx",
  "actorEmail": "elazhar.jebbari@gmail.com",
  "gitCommit": "8f2f4dc",
  "gitBranch": "master",
  "db": {
    "size": 47284921,
    "sha256": "5a8f3e1b9c2d7f8e6a4b1c3d5e7f9a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f",
    "path": "db.sql.gz",
    "dumpedFrom": "femiglow"
  },
  "media": {
    "size": 158234567,
    "sha256": "1b3d5e7f9a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f5a8f3e1b9c2d7f8e6a4b",
    "path": "media.tar.gz",
    "dirCount": 596,
    "fileCount": 4823
  },
  "preReset": {
    "tables": 67,
    "rows": {
      "products": 1,
      "product_variants": 2,
      "media": 48,
      "delivery_cities": 430,
      "ritual_testimonials": 52,
      "admin_users": 1,
      "audit_events": 47
    }
  },
  "envSnapshot": {
    "NODE_ENV": "production",
    "DATABASE_URL_hash": "sha256-of-url",
    "MEDIA_LOCAL_DIR": "/var/www/femiglow/.media-storage"
  }
}
```

## Procédure de rollback automatique (déclenchée par orchestrator)

L'orchestrator déclenche rollback si une phase critique échoue APRÈS la phase `backup` :

```
Phase échouée    → Rollback action
────────────────────────────────────────────────────
preflight        → aucun (rien n'a été modifié)
backup           → aucun (rien n'a été modifié)
audit-counts     → aucun (lecture seule)
wipe-db          → restore DB depuis db.sql.gz
wipe-media       → restore média depuis media.tar.gz
wipe-cache       → rien (rebuild Next à l'étape suivante)
migrate          → restore DB
seed             → restore DB (les médias seedés restent mais c'est OK)
verify           → aucun (rapport seul, pas critique)
cleanup-backups  → aucun (le reset en cours n'est pas affecté)
```

### Pseudo-code

```typescript
try {
  await phase.run(ctx);
} catch (err) {
  if (phase.critical && hasReachedDestructivePhase) {
    emit('rollback.start', { backupId });
    await restoreFromBackup(backupId, {
      restoreDb: hasWipedDb,
      restoreMedia: hasWipedMedia,
      onProgress: (p) => emit('rollback.progress', { fraction: p }),
    });
    emit('rollback.complete', { backupId });
  }
  emit('job.failed', { error: classifyError(err), rolledBack: ... });
  return { status: 'failed', ... };
}
```

## Procédure de rollback manuel (CLI)

### Lister les backups disponibles

```bash
pnpm --filter @femiglow/web reset list-backups
```

Output :
```
backupId                              takenAt              mode    size       commit
bkp_2026-05-13T08-15-22-345Z          2026-05-13 08:15:22  hard    158 MB     8f2f4dc
bkp_2026-05-12T22-03-44-119Z          2026-05-12 22:03:44  medium  47 MB      7e0e939
...
```

### Restaurer un backup

```bash
pnpm --filter @femiglow/web reset restore --backup-id=bkp_2026-05-13T08-15-22-345Z
```

L'opération :
1. Demande confirmation (tape « RESTORE »).
2. Valide le manifest (sha256 des archives).
3. Arrête le service web (`systemctl stop femiglow.service`) — optionnel, prompté.
4. DROP SCHEMA public CASCADE.
5. `gunzip -c db.sql.gz | psql $DATABASE_URL`.
6. Si `media.tar.gz` présent : `rm -rf .media-storage/* && tar -xzf media.tar.gz -C ...`
7. Restart service web.
8. Smoke test (HTTP /kit, /admin/login).
9. Log audit `reset.restore` avec backup id + actor.

### Procédure via UI

Step Report → bouton « Restaurer cet état » → ouvre un mini-wizard restore :

```
╔══════════════════════════════════════════════════════════════════╗
║  Restaurer le backup bkp_2026-05-13T08-15-22-345Z ?              ║
║                                                                   ║
║  Pris le 2026-05-13 à 08:15:22                                    ║
║  Mode original : hard                                             ║
║  Taille : 158 MB                                                  ║
║  Validité sha256 : ✅                                              ║
║                                                                   ║
║  ⚠ Cela écrasera l'état actuel.                                   ║
║                                                                   ║
║  Tape RESTORE pour confirmer :                                    ║
║  ┌──────────────────────────────────────────┐                    ║
║  │ RESTORE█                                 │                    ║
║  └──────────────────────────────────────────┘                    ║
║                                                                   ║
║                                  [ Annuler ]  [ Restaurer ]      ║
╚══════════════════════════════════════════════════════════════════╝
```

## Cas critique : rollback échoue

Si le restore lui-même crashe (par exemple : DB inaccessible) :

1. Le job termine en `status=failed` avec `recoveryRequired=true`.
2. Exit code CLI = **91** (l'humain doit intervenir).
3. Audit log entry `reset.recovery_required` avec le contexte complet.
4. UI affiche bloc rouge :
   ```
   ❌ INTERVENTION HUMAINE REQUISE
   
   Le rollback a échoué. L'état actuel est INDÉTERMINÉ.
   
   Commande manuelle pour restaurer :
   $ sudo systemctl stop femiglow.service
   $ psql $DATABASE_URL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   $ gunzip -c /var/backups/femiglow/bkp_…/db.sql.gz | psql $DATABASE_URL
   $ rm -rf /var/www/femiglow/.media-storage/*
   $ tar -xzf /var/backups/femiglow/bkp_…/media.tar.gz -C /var/www/femiglow
   $ sudo systemctl start femiglow.service
   ```
5. Pas de retry auto — risque d'aggraver.

## Tests de la procédure rollback

Couverts par :
- `lib/reset/restore.test.ts` — unit : restore DB + média à partir d'un backup mock.
- `lib/reset/orchestrator.test.ts` — auto-rollback après échec phase wipe/migrate.
- `e2e/reset-wizard-hard-rollback.spec.ts` — Playwright : simule échec migrate, vérifie
  UI rollback flow + état app post-rollback.

## Garanties

- **Atomicité par phase** : la transaction DB de `wipe-db` est tout-ou-rien.
- **Validation backup** : on ne passe la phase 4 (wipe) que si le manifest est valide.
- **Idempotence restore** : restore deux fois → état identique.
- **Pas de partial state** : à la fin du reset (succès OU échec), l'app est dans un état
  cohérent (canonique ou pre-reset).

## Limitations connues

- Si la machine crashe (kernel panic) entre la phase 4 (wipe) et 6 (migrate), au redémarrage
  l'app sera cassée. Mitigation : un job systemd post-restart qui détecte un état
  « DB vide + backup récent » et propose un restore.
- Si le `db.sql.gz` est corrompu (rare car sha256 vérifié au backup), le restore échouera.
  Mitigation : pas de wipe sans backup validé.
