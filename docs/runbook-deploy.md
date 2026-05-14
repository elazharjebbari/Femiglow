# Runbook — Déploiement FemiGlow

Ce runbook décrit le **flow standard** pour déployer du code en prod sans
crasher l'app.

---

## TL;DR — déploiement standard

```bash
# Depuis le serveur prod (srv983171, /var/www/femiglow), en tant que root :
sudo ./bin/deploy.sh
```

Le script enchaîne :

1. **Preflight** : git clean (stash auto), fetch `origin/master`
2. **Pull** : fast-forward (refuse si non-FF)
3. **Deps** : `pnpm install --frozen-lockfile`
4. **Validator** : `node scripts/_validate-migrations.mjs --strict`
5. **Backup DB** : `pg_dump` → `/var/backups/femiglow/pre-deploy-*.sql.gz` (rotation 7j)
6. **Migrate** : `node scripts/_migrate-safe.mjs` (hash-based, respecte `-- @no-transaction:true`)
7. **Build** : `NODE_OPTIONS=--max-old-space-size=8192 pnpm build`
8. **Restart** : `systemctl restart femiglow.service`
9. **Smoke tests** : curl `/`, `/admin/emails`, `/admin/legal`, `/api/health`
10. **Rollback automatique** si smoke fail → `git reset --hard PREV_HEAD` + rebuild + restart

---

## Variantes

| Cas | Commande |
|---|---|
| Préviz sans appliquer | `sudo ./bin/deploy.sh --dry-run` |
| Config-only (pas de build) | `sudo ./bin/deploy.sh --no-build` |
| Dev/CI (pas de backup) | `sudo ./bin/deploy.sh --skip-backup` |

---

## Que faire SI…

### …la validation migrations échoue

Le validator détecte :
- Fichier `.sql` sans entrée dans `_journal.json` → ajouter l'entrée
- Entrée fantôme (journal sans `.sql`) → retirer du journal
- `idx` non séquentiel → renuméroter
- `when` régressif → augmenter le timestamp de la migration concernée (drizzle skipe sinon)
- `CREATE INDEX CONCURRENTLY` / `ALTER TYPE ADD VALUE` / `VACUUM` sans marker

Pour autoriser les ops non-transactionnelles, **première ligne** du `.sql` :
```sql
-- @no-transaction:true
CREATE INDEX CONCURRENTLY idx_foo ON bar (col);
```

Le runner `_migrate-safe.mjs` les détectera et les exécutera hors `BEGIN`.

### …la migration plante en cours de deploy

Le runner s'arrête et affiche l'erreur. Le service N'EST PAS redémarré, donc
prod reste sur l'ancien build. Pour rejouer :

```bash
cd /var/www/femiglow/apps/web
node --env-file=.env scripts/_migrate-safe.mjs --plan   # voir ce qui manque
node --env-file=.env scripts/_migrate-safe.mjs          # appliquer
```

### …le build OOM

```bash
# Vérifier swap actif (4G prêt sur prod) :
swapon --show
# Vérifier RAM dispo :
free -h
# Augmenter heap Node :
NODE_OPTIONS="--max-old-space-size=8192" pnpm build
```

Si toujours OOM : killer les process orphelins (`pkill -f "next dev"` puis
`pkill -f "next-server"` que ne ferait pas systemctl).

### …`/api/health/full` retourne 503

```bash
curl -s http://127.0.0.1:8011/api/health/full | python3 -m json.tool
```

Le payload indique quel check fail :
- `db` → Postgres injoignable
- `migrations` → mismatch journal vs `__drizzle_migrations` (rejouer migrate)
- `tables` → tables critiques manquantes (rejouer migrate)

### …rollback manuel après deploy

```bash
# Récupérer le dernier backup :
ls -t /var/backups/femiglow/pre-deploy-*.sql.gz | head -1
# Restaurer :
gunzip < /var/backups/femiglow/pre-deploy-XXX.sql.gz | \
  PGPASSWORD='<pass>' psql -h 127.0.0.1 -U femiglow femiglow
# Revenir au commit précédent :
cd /var/www/femiglow
git log --oneline -5   # identifier
git reset --hard <SHA>
pnpm install --frozen-lockfile
NODE_OPTIONS="--max-old-space-size=8192" pnpm build
systemctl restart femiglow.service
```

---

## Pièges connus (et comment ils sont mitigés)

| Piège | Mitigation |
|---|---|
| Drizzle ignore les migrations dont `when` < dernière appliquée | `_migrate-safe.mjs` compare par HASH, pas par `when` |
| `CREATE INDEX CONCURRENTLY` plante dans la transaction drizzle | Marker `-- @no-transaction:true` + runner détecte |
| `ALTER TYPE ADD VALUE` idem | Marker `-- @no-transaction:true` + runner détecte |
| Journal corrompu (entrées fantômes après rebase) | Validator détecte au pre-commit + CI |
| Build OOM | Swap 4G permanent + `NODE_OPTIONS` dans deploy.sh |
| Pages cassées en prod | Smoke tests post-restart + rollback auto |
| CI sur branche obsolete (`main` vs `master`) | CI surveille les deux maintenant |

---

## Commandes utiles

```bash
# Voir le plan de migrations à appliquer :
pnpm --filter @femiglow/web db:migrate-safe:plan

# Valider l'état des migrations (avant commit) :
pnpm --filter @femiglow/web db:validate

# Health check étendu :
pnpm health:full

# Voir les backups :
ls -lh /var/backups/femiglow/

# Logs prod en temps réel :
journalctl -u femiglow.service -f
```
