# 80.2 — Rollback

## Stratégies par scénario

### Scénario A — Bug applicatif (UI cassée)

**Symptôme** : `/admin/legal` ou `/legal/[slug]` ne s'affiche pas, erreur console, layout cassé.

**Procédure** :
```bash
# Revert le commit
git log --oneline | head -5
git revert <SHA>
git push production master
```

Vercel re-deploie automatiquement la version précédente.

**Durée** : 3-5 minutes.

### Scénario B — Régression en publication (contenu erroné)

**Symptôme** : Une page publiée a un contenu juridiquement incorrect.

**Procédure A — Restore version précédente** (préféré) :
1. `/admin/legal/[slug]/edit`
2. Tab Historique
3. Cliquer "Restaurer cette version" sur v-1
4. La page revient en draft avec l'ancien contenu
5. Publier ce draft → version est incrémentée mais contenu identique au précédent

**Procédure B — Dépublier d'urgence** :
1. `/admin/legal/[slug]/edit`
2. Tab "Zone danger"
3. "Dépublier" + confirmation
4. La page redevient un draft (404 publique)

Le lien dans le footer / cookie banner / checkout est automatiquement retiré.

**Durée** : 1-2 minutes.

### Scénario C — Migration DB cassée

**Symptôme** : déploiement échoue à l'étape `drizzle-kit migrate`.

**Procédure** :
```bash
# 1. Stop deploy
# 2. Connect to DB
psql $DATABASE_URL

# 3. Vérifier l'état des migrations
SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5;

# 4. Rollback la migration partielle (s'il y a lieu)
DROP TABLE IF EXISTS legal_pages_history CASCADE;
DROP TABLE IF EXISTS legal_pages CASCADE;
# (ATTENTION : irréversible — pas d'historique disponible)

# 5. Restaurer depuis backup
psql $DATABASE_URL < /backups/pre-legal-2026-05-13.sql

# 6. Re-run migrations corrigées
```

**Durée** : 15-30 minutes selon backup.

### Scénario D — Données légales corrompues / supprimées

**Symptôme** : la table `legal_pages` est vide ou incohérente.

**Procédure A — Restore git** (si feature activée) :
```bash
# Clone branche legal-versions
git clone --branch legal-versions $REPO /tmp/legal-recovery

# Run le restore script
pnpm tsx scripts/restore-legal-from-git.ts /tmp/legal-recovery
```

Le script reconstruit :
- `legal_pages` (latest version → status='published')
- `legal_pages_history` (toutes versions)

**Procédure B — Restore DB backup** :
```bash
# Sauvegarder l'état actuel d'abord
pg_dump $DATABASE_URL -t legal_pages -t legal_pages_history > current.sql

# Restaurer
psql $DATABASE_URL -c "TRUNCATE legal_pages CASCADE"
psql $DATABASE_URL < /backups/legal-yesterday.sql
```

**Durée** : 5-15 minutes.

### Scénario E — Cron en boucle / charge anormale

**Symptôme** : Sentry alerte sur le cron `legal-link-health`, jobs queue saturée.

**Procédure** :
```bash
# 1. Désactiver le cron (Vercel dashboard ou env)
LEGAL_HEALTH_CRON_ENABLED=false

# 2. Vider la queue si BullMQ / equivalent
pnpm tsx scripts/clear-job-queue.ts legal-health

# 3. Investiguer : logs + dernière exécution
SELECT * FROM legal_link_health_snapshot ORDER BY created_at DESC LIMIT 5;

# 4. Patch le code
# 5. Re-déployer
# 6. Re-activer le cron
```

### Scénario F — Git sync échoue de manière persistante

**Symptôme** : la branche `legal-versions` n'est pas mise à jour, alertes répétées.

**Procédure** :
```bash
# 1. Désactiver le sync immédiatement
LEGAL_GIT_SYNC_ENABLED=false

# Re-deploy
```

Les publications continuent normalement (DB seule). Le sync git peut être réparé hors urgence :
- SSH key expirée ? Régénérer.
- Repo full ? Cleanup historique ou branche.
- Network policy ? Vérifier outbound github.com:22.

### Scénario G — Page publique 500

**Symptôme** : `/legal/cgv` retourne 500.

**Procédure** :
1. **Check Sentry** : trace de l'erreur
2. Causes typiques :
   - MD parsing crash (caractère invalide) → fallback : afficher MD raw
   - Variable non substituée + condition stricte → mode permissif temporaire
   - Cache corrompu → `revalidatePath('/legal/[slug]')`
3. Patch + deploy

**Mitigation immédiate** : dépublier la page incriminée le temps du fix.

## Communication

### Statut interne

Slack `#tech-femiglow` :
```
🚨 ROLLBACK déclenché — legal pages
Scénario : [A/B/C/...]
Action prise : [...]
Impact public : [oui/non]
ETA fix : [...]
```

### Statut public

Si impact > 30 min sur des pages légales :
- Bandeau site : "Maintenance en cours sur les pages d'aide. Service support disponible : hello@femiglow.ma"
- Email équipe support : "Pas de réception d'erreur côté legal"

## Post-mortem

Pour tout rollback déclenché :
1. Document `postmortems/YYYY-MM-DD-legal-rollback.md`
2. Sections : Timeline · Root cause · Impact · Action items
3. Review dans 1 semaine avec équipe
4. Suivi des action items

## Préparation

Pour limiter les rollbacks :
- Pre-deploy : run `pnpm test:e2e:ultimate` en staging
- Pre-publish (contenu) : 4-yeux principle (V2)
- Snapshots DB toutes les 6h
- Feature flag `legal-pages-enabled` (en V2)
