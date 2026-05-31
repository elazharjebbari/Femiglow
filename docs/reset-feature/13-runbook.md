# 13 — Runbook exécutable

> Ce runbook pilote l'implémentation puis l'exécution d'un reset hard.
> Chaque étape a un check explicite. L'exécution s'arrête à la moindre red-flag.

## Légende

- 🟦 **PREP** — préparation, lecture seule, jamais bloquant
- 🟨 **IMPL** — implémentation code, tests
- 🟥 **EXEC** — exécution destructive sur env, requiert go-ahead utilisateur
- ✅ check passé · ❌ check raté · ⏸ check en attente

---

## Étape 0 · Synchronisation git 🟦

```bash
cd /var/www/femiglow
git status -uno
git fetch origin master
git pull --ff-only origin master
```

✅ **CHECK** : `git status` montre working tree clean (sauf `_journal.json` fix antérieur).
✅ **CHECK** : `git rev-list --count master...origin/master` = 0 0.

**État courant (à 2026-05-13 08:00 UTC)** : DONE ✅ (fast-forward 7e0e939 → 8f2f4dc).

---

## Étape 1 · Validation du dossier de conception 🟦

L'utilisateur lit `docs/reset-feature/` et valide :

- [ ] `00-vision.md` — exigences alignées
- [ ] `03-design-backend.md` — pas de blocker architecture
- [ ] `04-design-frontend.md` — wizard cohérent
- [ ] `11-data-model.txt` — préservation par défaut OK
- [ ] `10-error-taxonomy.md` — comportements en cas d'échec OK

⏸ **GATE** : attente go-ahead utilisateur explicite (« plan validé »).

---

## Étape 2 · Réponses aux questions de préservation 🟦

L'utilisateur répond explicitement par écrit à :

- [ ] Y a-t-il des `orders` / `leads` / `chat_lead` / `ritual_testimonials` à préserver
      en prod ? (Si oui : preset preserve = défauts. Si non : on peut accepter wipe complet)
- [ ] L'admin user `elazhar.jebbari@gmail.com` peut-il être recréé via `ADMIN_BOOTSTRAP_*`
      du .env ? (test : `psql … -c "delete from admin_users where email = ...; "` puis
      `pnpm seed:admin` doit recréer)
- [ ] Y a-t-il des médias custom uploadés via l'admin (pas via seeds) à conserver ?

⏸ **GATE** : attente réponses pour calibrer la config de reset.

---

## Étape 3 · Implémentation backend lib/reset 🟨

Suivre `07-dev-plan.csv` tasks T01 → T17.

### T01 · Types + Zod schema
```bash
# Création fichiers
apps/web/src/lib/reset/types.ts
apps/web/src/lib/reset/config-schema.ts
apps/web/src/lib/reset/config-schema.test.ts
```
✅ **CHECK** : `pnpm --filter @femiglow/web test src/lib/reset/config-schema.test.ts`

### T02 · Lock + Job store
```bash
apps/web/src/lib/reset/lock.ts
apps/web/src/lib/reset/lock.test.ts
apps/web/src/lib/reset/job-store.ts
apps/web/src/lib/reset/job-store.test.ts
```
✅ **CHECK** : tests verts, lock empêche bien double acquisition.

### T03 · Phases individuelles
T05–T14 (preflight, backup, audit-counts, wipe-db, wipe-media, wipe-cache, migrate, seed,
verify, cleanup-backups).

```bash
apps/web/src/lib/reset/phases/{preflight,backup,audit-counts,wipe-db,wipe-media,
  wipe-cache,migrate,seed,verify,cleanup-backups}.ts
# + .test.ts pour chacune
```
✅ **CHECK** : chaque phase a son test, coverage > 80 %.

### T04 · Planner + Orchestrator + Restore
```bash
apps/web/src/lib/reset/planner.ts
apps/web/src/lib/reset/orchestrator.ts
apps/web/src/lib/reset/restore.ts
# + tests
```
✅ **CHECK** : orchestrator gère rollback auto sur erreur phase critique.

⏸ **POINT D'ARRÊT 1** — backend pur compile + tests verts.

---

## Étape 4 · API routes + CLI 🟨

T18 → T25.

```bash
apps/web/src/app/api/admin/reset/run/route.ts
apps/web/src/app/api/admin/reset/preflight/route.ts
apps/web/src/app/api/admin/reset/jobs/[jobId]/stream/route.ts
apps/web/src/app/api/admin/reset/jobs/[jobId]/route.ts
apps/web/src/app/api/admin/reset/jobs/[jobId]/cancel/route.ts
apps/web/src/app/api/admin/reset/restore/route.ts
apps/web/src/app/api/admin/reset/backups/route.ts
apps/web/scripts/reset.ts
```

✅ **CHECK** : `curl -sS http://127.0.0.1:8011/api/admin/reset/preflight` retourne 401
sans cookie.
✅ **CHECK** : `pnpm --filter @femiglow/web reset run --dry-run --mode=soft --confirm=RESET`
n'affecte pas la DB (preflight + plan + audit seulement).

⏸ **POINT D'ARRÊT 2** — CLI dry-run fonctionnel sans destruction.

---

## Étape 5 · Frontend wizard 🟨

T26 → T39.

```bash
apps/web/src/app/admin/settings/reset/page.tsx
apps/web/src/app/admin/settings/reset/loading.tsx
apps/web/src/components/admin/settings/reset/
  ResetWizard.tsx + tous les composants steps + widgets + hooks
```

✅ **CHECK** : page rendue sans erreur (HTTP 200 sur /admin/settings/reset auth).
✅ **CHECK** : wizard navigable au clavier (Tab, Enter, Esc).
✅ **CHECK** : axe-core a11y report sans critique.

⏸ **POINT D'ARRÊT 3** — wizard rendu, dry-run e2e OK.

---

## Étape 6 · Tests intégration 🟨

T40 → T46.

```bash
apps/web/src/lib/reset/__fixtures__/    # data mocks
apps/web/src/test/msw/handlers/reset.ts # MSW
apps/web/e2e/reset-wizard.spec.ts       # Playwright happy path (soft dry-run)
apps/web/e2e/reset-wizard-hard.spec.ts  # Playwright hard avec rollback
apps/web/e2e/reset-wizard-a11y.spec.ts  # axe
```

```bash
pnpm --filter @femiglow/web test           # unit + integration
pnpm --filter @femiglow/web test:e2e -- --grep="reset-wizard"
```

✅ **CHECK** : tous les specs verts.
✅ **CHECK** : coverage unitaire ≥ 80 % sur `lib/reset/`.

⏸ **POINT D'ARRÊT 4** — tests verts, prêt pour exécution réelle.

---

## Étape 7 · Smoke test serveur (avant reset réel) 🟦

Sur env actuel :

```bash
# Build & restart
rm -rf apps/web/.next
pnpm --filter @femiglow/web build 2>&1 | tail -20
sudo systemctl restart femiglow.service

# Curl /admin/settings auth
EMAIL=$(grep ^ADMIN_BOOTSTRAP_EMAIL apps/web/.env | head -1 | cut -d= -f2-)
PASS=$(grep ^ADMIN_BOOTSTRAP_PASSWORD apps/web/.env | head -1 | cut -d= -f2-)
JAR=$(mktemp)
curl -sS -c "$JAR" -X POST http://127.0.0.1:8011/api/admin/login \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null
curl -sSL -b "$JAR" http://127.0.0.1:8011/admin/settings/reset | grep -c 'wizard'
```

✅ **CHECK** : carte "Reset" visible dans /admin/settings.
✅ **CHECK** : page wizard accessible.

---

## Étape 8 · Dry-run sur env actuel 🟦

```bash
pnpm --filter @femiglow/web reset run --dry-run --mode=hard --confirm='HARD RESET'
```

Sortie attendue :
```
[preflight] OK · disk free 12.3 GB · DB reachable
[plan]      hard · 10 phases · ETA ~ 90 s
[audit-counts] products=1 variants=2 media=48 delivery_cities=430 …
[dry-run]   STOP. No destructive action performed.
```

✅ **CHECK** : exit code 0.
✅ **CHECK** : aucune écriture sur DB ou disk hors lecture.

---

## Étape 9 · Backup manuel de validation 🟦

Validation que la phase backup fonctionne isolément :

```bash
pnpm --filter @femiglow/web reset run --dry-run=false --mode=soft \
  --confirm=RESET --skip-after=backup
```

(`--skip-after=backup` est un flag de runbook qui arrête après la phase backup).

✅ **CHECK** : `/var/backups/femiglow/bkp_…/` créé avec `db.sql.gz`, `manifest.json`.
✅ **CHECK** : `gunzip -t db.sql.gz` valide.
✅ **CHECK** : sha256 du manifest matche.

---

## Étape 10 · EXÉCUTION RESET HARD 🟥

⏸ **GATE FINAL** — utilisateur tape « GO » par écrit après revue de :

- Réponses étape 2 enregistrées
- Tests verts étape 6
- Smoke test OK étape 7
- Dry-run OK étape 8
- Backup manuel OK étape 9

### Exécution

Option A — via CLI (recommandé, plus contrôlé) :

```bash
# Optionnel: stopper le service pour éviter le trafic pendant le reset
# (laisse une page maintenance via nginx si en place)
sudo systemctl stop femiglow.service

pnpm --filter @femiglow/web reset run \
  --mode=hard \
  --preserve=admin_users,audit_events \
  --wipe-media \
  --wipe-cache \
  --confirm='HARD RESET' \
  --non-interactive \
  2>&1 | tee /var/log/femiglow-reset-$(date +%F-%H%M).log
```

Sortie attendue (~ 90 s) :
```
[preflight]      OK 1.2s
[backup]         OK bkp_2026-05-13T… 14.8s · 158 MB
[audit-counts]   OK 0.4s
[wipe-db]        OK 27 tables dropped 3.1s
[wipe-media]     OK 596 dirs removed 8.2s
[wipe-cache]     OK 1.4s
[migrate]        OK 27 migrations applied 4.1s
[seed]           OK 16/16 seeders 58.3s
[verify]         OK 9/9 critical 0/0 errors 2.4s
[cleanup]        OK 1 backup pruned 0.2s

✅ Reset terminé en 1m32s
```

Exit code 0.

### Restart service + smoke

```bash
sudo systemctl start femiglow.service
sleep 3

# Smoke /kit
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/kit
curl -sSL http://127.0.0.1:8011/kit | grep -E '(199.*MAD|MAD.*199)' | head -1

# Smoke admin
curl -sSL http://127.0.0.1:8011/admin/login | grep -c 'Connexion'
```

✅ **CHECK** : /kit retourne 200 et contient « 199 MAD ».
✅ **CHECK** : /admin/login retourne 200.

### En cas d'échec

Si le CLI exit code ≠ 0 :

1. Capturer le log complet (`/var/log/femiglow-reset-….log`).
2. Vérifier si rollback a tourné (rechercher `rollback.complete` dans log).
3. Si rollback OK : exit 90 ; service redémarre depuis état pré-reset.
4. Si rollback KO : exit 91 ; suivre la procédure manuelle dans `09-rollback.md` §
   "Cas critique : rollback échoue".

---

## Étape 11 · Vérifications post-reset 🟦

```bash
# DB row counts
export $(grep ^DATABASE_URL apps/web/.env | xargs)
psql "$DATABASE_URL" -c "
  SELECT 'products' as t, count(*) FROM products
  UNION ALL SELECT 'product_variants', count(*) FROM product_variants
  UNION ALL SELECT 'media', count(*) FROM media
  UNION ALL SELECT 'delivery_cities', count(*) FROM delivery_cities
  UNION ALL SELECT 'admin_users', count(*) FROM admin_users
  UNION ALL SELECT 'audit_events', count(*) FROM audit_events;"

# Variant prix
psql "$DATABASE_URL" -c "
  SELECT sku, price_cents, promo_price_cents, currency
  FROM product_variants WHERE sku = 'FEMI-KIT-100';"

# Image kit existe
ls -la /var/www/femiglow/.media-storage/media/ | head -10

# Audit log reset entries
psql "$DATABASE_URL" -c "
  SELECT action, created_at, meta->>'mode' as mode
  FROM audit_events WHERE action LIKE 'reset.%' ORDER BY created_at DESC LIMIT 15;"
```

Critères attendus :
- products=1, product_variants=1 (plus de FEMI-KIT-30 stale), media≥1, delivery_cities≈430
- admin_users≥1, audit_events≥1
- FEMI-KIT-100 : price_cents=39000, promo_price_cents=19900
- ≥ 11 entrées `reset.*` dans audit_events

---

## Étape 12 · Bilan & nettoyage 🟦

```bash
# Liste des backups après cleanup
ls -la /var/backups/femiglow/

# Mettre à jour le runbook avec timings observés
# Mettre à jour post-mortem.md
```

✅ **CHECK** : 1 backup récent dans `/var/backups/femiglow/`.
✅ **CHECK** : commit + push si modifications de fichiers.

---

## Annexe · Commandes de récupération d'urgence

```bash
# Lister backups
ls -lh /var/backups/femiglow/

# Restore depuis CLI
pnpm --filter @femiglow/web reset restore \
  --backup-id=bkp_YYYY-MM-DDTHH-MM-SS-mmmZ

# Restore manuel (si CLI cassée)
BACKUP=/var/backups/femiglow/bkp_YYYY-…
sudo systemctl stop femiglow.service
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
psql "$DATABASE_URL" -c 'DROP SCHEMA IF EXISTS drizzle CASCADE;'
gunzip -c "$BACKUP/db.sql.gz" | psql "$DATABASE_URL"
rm -rf /var/www/femiglow/.media-storage/*
tar -xzf "$BACKUP/media.tar.gz" -C /var/www/femiglow
sudo systemctl start femiglow.service
```
