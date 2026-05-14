# Runbook — Rollback

## Scenarios

### S1 — Bug bloquant côté API
**Symptôme** : 5xx en boucle sur `/api/track/sentinel`, alerte Sentry.

**Action** :
1. Revert le commit fautif sur master :
   ```bash
   git revert <sha> --no-edit
   git push origin master
   ```
2. Vercel redéploie automatiquement.
3. Vérifier le endpoint redevient 2xx.

**Pas besoin de toucher à GTM** : les pings échouent en silence (sendBeacon ignore les erreurs), pas d'impact utilisateur.

---

### S2 — Migration DB cassée
**Symptôme** : `SELECT` sur les tables fail.

**Action** :
1. Appliquer le rollback SQL :
   ```sql
   BEGIN;
   DROP TABLE IF EXISTS "gtm_sentinel_daily_aggregates";
   DROP TABLE IF EXISTS "gtm_drift_history";
   DROP TABLE IF EXISTS "gtm_drift_state";
   DROP TABLE IF EXISTS "gtm_sentinel_pings";
   COMMIT;
   ```
2. Revert le commit code.
3. Vercel redéploie automatiquement.

---

### S3 — Faux positifs en masse (drift critique partout)
**Symptôme** : Tous les admins reçoivent un email "drift critique" mais en réalité tout va bien.

**Cause probable** : Bug dans `driftDetector` qui classifie tout en `critical`.

**Action** :
1. **Sans toucher au code** : marquer tous les drifts comme résolus en force :
   ```sql
   UPDATE gtm_drift_state SET status = 'ok', since = now(), reasons_json = '[]'::jsonb WHERE id = 'singleton';
   ```
2. Désactiver temporairement les emails de notification :
   ```sql
   -- Via une feature flag si en place, sinon :
   UPDATE feature_flags SET enabled = false WHERE key = 'gtm.drift.email_notifications';
   ```
3. Identifier la cause root dans le code, corriger, redéployer.

---

### S4 — Endpoint sentinel sature DB
**Symptôme** : Trop de pings, latence DB en hausse.

**Action immédiate** :
1. Augmenter le rate limit côté API (de 60 à 10/min) :
   ```ts
   // apps/web/src/app/api/track/sentinel/route.ts
   const rate = await checkRateLimit({ ... limit: 10 ... });
   ```
2. Ou désactiver complètement le ping côté GTM :
   - Aller dans GTM
   - Pause le tag "FG Sentinel Ping"
   - Submit & Publish
3. Investiguer (sampling client ? bot trafic ?).

**Action moyen terme** : sampling côté GTM (envoyer 1 ping sur 10 sessions).

---

### S5 — Rollback GTM workspace

Si l'import GTM s'est mal passé (mauvais workspace, contenu pollué) :

1. Aller dans GTM > Versions.
2. Trouver la dernière version stable.
3. Cliquer "Set as Latest".
4. Submit & Publish.

Les nouveaux pings se conformeront automatiquement à la nouvelle config.

---

## Tableau de décision

| Symptôme | Action immédiate | Action moyen terme |
|---|---|---|
| 5xx sentinel | revert commit | fix + redeploy |
| 5xx sync-status | revert commit | idem |
| Faux positifs | force status='ok' | fix driftDetector |
| Drift permanent | check GTM, importer la version manquante | renforcer couche A |
| DB saturée | rate limit ↑ | sampling client |
| Email spam | désactiver notifications | revoir hystérésis |

## Contacts

- **Sentry** : alertes auto sur `gtm.drift.*`, `gtm.sentinel.*`
- **Astreinte** : Sara (admin principal), Karim (backup)
- **Doc complète** : `docs/gtm-poka-yoke/`
