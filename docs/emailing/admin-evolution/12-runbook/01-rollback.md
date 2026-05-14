# Rollback procédure par phase

> Chaque phase doit être rollback-able. Le rollback porte sur 2 dimensions :
> code (revert git) et data (DROP TABLE / migration down).

## Principes

- **Code** rollback toujours possible via `git revert <merge-commit>`
- **Data** rollback : chaque migration UP a son DOWN documenté ; les
  données existantes survivent (les nouvelles colonnes sont droppées,
  les nouvelles tables aussi)
- **No data loss** : on n'efface pas les données utilisateur existantes
  (orders, leads, email_outbox). Seulement le scope M5 nouveau.

## Stratégie générale

```
1. Revert merge commit sur master
2. Rebuild + restart femiglow.service
3. Run migration down du scope
4. Smoke test : pages admin emails fonctionnent (mode dégradé)
5. Notifier admin
```

## Par phase

### M5.1 rollback (Cockpit transactional)

**Effet** : Page transactional revient à sa version d'avant
(tableau simple).

```bash
# 1. Git revert
git revert <merge-commit-m5.1>
git push origin master

# 2. Build + restart
cd /var/www/femiglow/apps/web
sudo -u nodeapp pnpm build
sudo systemctl restart femiglow.service

# 3. Migration down
sudo -u postgres psql femiglow -c "DROP TABLE IF EXISTS admin_email_view;"

# 4. Smoke test
curl -sS https://femiglow-maroc.com/admin/emails/transactional
```

**Données impactées** : Les saved views custom des admins sont
perdues. Pas critique (recréables).

---

### M5.2 rollback (user_event)

**Effet** : Bridges n'écrivent plus. Les requêtes audience/automation
ne pourront plus filtrer sur events.

```bash
# 1. Revert
git revert <merge-commit-m5.2>

# 2. Build + restart

# 3. Garder la table user_event (utile pour debug même rollback) OU :
sudo -u postgres psql femiglow -c "DROP TABLE IF EXISTS user_event;"
```

**Recommandation** : ne PAS dropper la table ; juste revert les bridges.
Les audiences M5.3 qui dépendent de user_event seront en mode dégradé
(returnent 0 résultat) si on rollback aussi M5.3.

---

### M5.3 rollback (Audiences)

**Effet** : Pages audiences disparaissent. Wizard campaign M5.4 cassé
si pas rollback aussi.

```bash
# 1. Revert
git revert <merge-commit-m5.3>

# 2. Build + restart

# 3. Migration down
sudo -u postgres psql femiglow <<EOF
DROP TABLE IF EXISTS email_audience_snapshot_member;
DROP TABLE IF EXISTS email_audience_snapshot;
DROP TABLE IF EXISTS email_audience;
EOF
```

**Données impactées** : Audiences créées, snapshots → perdus. 
Listes Listmonk éphémères créées → resteront sur Listmonk jusqu'à
cleanup manuel.

---

### M5.4 rollback (Campaigns intégrées)

**Effet** : Wizard campagne ne supporte plus les audiences natives ;
revient au multi-select Listmonk.

```bash
# 1. Revert
git revert <merge-commit-m5.4>

# 2. Build + restart

# 3. Migration down
sudo -u postgres psql femiglow <<EOF
ALTER TABLE email_campaign_link DROP COLUMN IF EXISTS audience_id;
ALTER TABLE email_campaign_link DROP COLUMN IF EXISTS snapshot_id;
ALTER TABLE email_campaign_link DROP COLUMN IF EXISTS snapshot_listmonk_list_id;
EOF
```

**Données impactées** : Campagnes en cours pointant audiences natives
→ status='errored'. À traiter manuellement.

---

### M5.5 rollback (Automation studio)

**Effet** : UI création/édition disparaît. Le runner V2 doit être
remplacé par le runner V1 (qui ne supporte que wait+send).

```bash
# 1. Revert (revert plusieurs commits si nécessaire)
git revert <merge-commit-m5.5>

# 2. Build + restart

# 3. Migration down
sudo -u postgres psql femiglow <<EOF
ALTER TABLE email_automation DROP COLUMN IF EXISTS cooldown_seconds;
ALTER TABLE email_automation DROP COLUMN IF EXISTS quiet_hours_enabled;
-- ... etc
DROP TABLE IF EXISTS lead_tag;
ALTER TABLE email_automation_run DROP COLUMN IF EXISTS awaiting_event_name;
-- ... etc
EOF
```

**Données impactées** : Automations qui utilisent branch/tag/webhook
→ runs en cours errored. Lead_tag → perdu.

---

### M5.6 rollback (Polish)

**Effet** : Cmd-K seulement en transactional, empty states basic, etc.

```bash
git revert <merge-commit-m5.6>
# pas de migration data
```

## Rollback partiel

Pour rollback **uniquement** un ticket d'une phase (pas toute la phase) :

```bash
git revert <commit-ticket>
```

À condition que le ticket soit isolé. Sinon, rollback la phase entière.

## Sécurité avant rollback

1. **Vérifier en local** : reproduire l'incident sur un worktree
2. **Notifier** Slack avant rollback prod
3. **Backup DB** avant migration down : `pg_dump femiglow > backup.sql`
4. **Vérifier post-rollback** : smoke test + check logs 1h

## Process recovery après rollback

1. Investigation root cause sur worktree
2. Fix sur branche de hotfix
3. Tests passent
4. Re-merge

## Checklist rollback

- [ ] Stakeholder notifié
- [ ] Backup DB
- [ ] Revert code
- [ ] Build + restart
- [ ] Migration down
- [ ] Smoke test
- [ ] Logs 1h watch
- [ ] Post-mortem prévu
