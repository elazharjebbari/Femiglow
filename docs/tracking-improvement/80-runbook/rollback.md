# 80.2 — Procédure de rollback

## Quand rollback ?

Déclencher rollback si après déploiement :
- ❌ `/api/track` retourne > 50% d'erreurs en 5 min
- ❌ Conversions Google Ads chute > 80% en 1 h (vs baseline 7 derniers jours)
- ❌ /kit return 500 en production
- ❌ Login admin cassé
- ❌ Migration DB échoue partiellement

## Procédure A — Rollback code seul (pas de migration DB)

Si seul le code est suspect :

```bash
cd /var/www/femiglow

# Identifier le commit précédent stable
git log --oneline -10

# Reset hard sur le commit précédent
git reset --hard <commit-sha-precedent>

# Stop service
sudo systemctl stop femiglow.service

# Rebuild
rm -rf apps/web/.next
pnpm --filter @femiglow/web build

# Restart
sudo systemctl start femiglow.service
until ss -tlnp | grep -q ':8011'; do sleep 2; done

# Smoke
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8011/kit
```

## Procédure B — Rollback complet (code + DB)

Si une migration DB a corrompu des données :

```bash
# Liste backups
pnpm --filter @femiglow/web reset list-backups
# Choisir le backup le plus récent AVANT déploiement

# Stop service
sudo systemctl stop femiglow.service

# Restore depuis backup
pnpm --filter @femiglow/web reset restore --backup-id=bkp_YYYY-MM-DDTHH-MM-SS --non-interactive

# Reset code au commit pre-deploy
git reset --hard <commit-sha-pre-deploy>

# Rebuild
rm -rf apps/web/.next
pnpm --filter @femiglow/web build

# Restart
sudo systemctl start femiglow.service
```

## Procédure C — Rollback ciblé Google Ads CAPI

Si seul Google Ads CAPI rate (autres providers OK) :

```bash
# Désactive seulement le provider google_ads
psql "$DATABASE_URL" -c "
  UPDATE tracking_providers
  SET status = 'disabled', last_error = 'Manual rollback after deploy issue'
  WHERE kind = 'google_ads';
"

# Pas besoin de redéployer — le dispatcher skipera google_ads automatiquement
# Le tag client gtag.js continue de fonctionner

# Réactiver quand fix trouvé :
psql "$DATABASE_URL" -c "
  UPDATE tracking_providers SET status = 'enabled' WHERE kind = 'google_ads';
"
```

## Procédure D — Rollback partiel form_start

Si `form_start` cause problèmes (rendering, performance) :

```bash
# Solution rapide : feature flag dans tracking_settings
psql "$DATABASE_URL" -c "
  INSERT INTO tracking_settings (key, value)
  VALUES ('feature_form_start_enabled', 'false')
  ON CONFLICT (key) DO UPDATE SET value = 'false';
"

# Le hook useFormStartTracking vérifie ce flag et ne fire pas si false.
# Pas besoin de rebuild — apply via revalidate.
```

## Procédure E — Rollback complet en cas d'urgence absolue

Last resort si tout est cassé :

```bash
# Restaurer le backup le plus ancien stable (≥ 1 semaine)
sudo systemctl stop femiglow.service

# Reset code au tag pre-refactor (si on a taggé)
git checkout pre-tracking-refactor-2026-05

# Restore DB depuis backup ancien (DERNIER recours)
pnpm --filter @femiglow/web reset restore --backup-id=bkp_<oldest-stable> --non-interactive

# Rebuild + restart
rm -rf apps/web/.next
pnpm --filter @femiglow/web build
sudo systemctl start femiglow.service
```

⚠ **Conséquence** : on perd toutes les modifications faites depuis ce
backup (commandes, leads, audit). À utiliser uniquement si la DB est
corrompue de manière irréversible.

## Checklist post-rollback

- [ ] `/kit` retourne 200
- [ ] Login admin OK
- [ ] `/admin/tracking` accessible
- [ ] Tag GA4 visible dans le DOM (test page client)
- [ ] Conversion test Google Ads passe via interface admin
- [ ] Logs serveur sans erreurs critiques
- [ ] Annonce Slack "rollback effectué, raison: ..."

## Post-mortem (J+1)

Document obligatoire :
- Quoi : ce qui a déclenché le rollback
- Quand : timeline précise
- Pourquoi : root cause analysis
- Quoi maintenant : actions correctives
- Quoi à éviter : process changes (more tests, more staging time, etc.)

Stocker dans `docs/incidents/<date>-tracking-rollback.md`.
