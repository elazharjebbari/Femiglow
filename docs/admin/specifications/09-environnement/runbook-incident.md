# Runbook incident — environnement & déploiement

Ce runbook couvre les incidents **opérationnels** (Vercel down, Neon
down, déploiement cassé). Pour les incidents de **sécurité** voir
[`../07-securite/incident-response.md`](../07-securite/incident-response.md).

## Sévérités

| Niveau | Définition | SLA réponse |
|---|---|---|
| P0 | site totalement down (5xx > 50 % sur 5 min) | 15 min |
| P1 | fonctionnalité critique dégradée (login, leads, webhooks) | 1h |
| P2 | bug visible mais contournable | 24h |
| P3 | bug mineur, lent, cosmétique | 1 semaine |

## Détection

| Source | Signal |
|---|---|
| UptimeRobot | `/healthz` 503 ou timeout 2 fois de suite |
| Sentry | spike erreurs > 50/min |
| Logtail | absence de `cron.tick.completed` > 5 min |
| Utilisateur | rapport via email/SMS |

## Procédure générale

```
1. ACK l'alerte (Slack / SMS) — réponse < 15 min sur P0
2. Évaluer (sévérité, périmètre, depuis quand)
3. Communiquer (Slack #incidents — message initial)
4. Mitiger (rollback, toggle, scale)
5. Résoudre (root cause)
6. Notifier la fondatrice (si P0/P1, par SMS si urgent)
7. Post-mortem (P0/P1 obligatoire, sous 72h)
```

## Scénario 1 : déploiement cassé en production

**Symptôme** : 5xx massifs après merge sur `main`, ou erreur build.

```bash
# 1. Vérifier les déploiements récents
vercel deployments --prod | head

# 2. Identifier le précédent stable
LAST_GOOD=https://femiglow-xxxxxxxx.vercel.app

# 3. Rollback immédiat
vercel rollback "$LAST_GOOD" --scope=femiglow

# OU via dashboard : Deployments → […] → Promote to Production

# 4. Vérifier
curl -I https://femiglow.ma   # 200
```

**Délai** : ~30 secondes pour la propagation Vercel.

Ensuite, sur `main` :
- soit `git revert <bad-commit>` puis re-merge propre,
- soit `git reset --hard <last-good-sha>` + force-push (déconseillé sauf
  urgence absolue, prévenir l'équipe).

## Scénario 2 : Neon Postgres indisponible

**Symptôme** : `ECONNREFUSED` ou timeout connexion DB. `/healthz` 503.

1. Vérifier le statut Neon : https://neon.tech/status
2. Si incident Neon confirmé : afficher la page de maintenance
   (`maintenance-mode.ts` flag → `MAINTENANCE_MODE=true` dans Vercel
   env, redéployer ou bien servi par middleware si flag déjà présent).
3. Notifier sur Twitter / page d'accueil.
4. Attendre la résolution Neon. Pas de bascule vers une réplique en v1.

```bash
# Activer le mode maintenance
vercel env add MAINTENANCE_MODE production "true"
vercel deploy --prod --force
```

Le middleware lit `MAINTENANCE_MODE` ; si `true`, retourne 503 avec une
page statique sauf pour `/healthz` et `/api/csp-report`.

## Scénario 3 : Vercel indisponible

**Symptôme** : pages ne se chargent pas, dashboard Vercel inaccessible.

1. Confirmer sur https://www.vercel-status.com
2. Si incident Vercel global : rien à faire à part attendre. Domaine
   personnalisé reste pointé vers Vercel — redirection DNS de secours
   non configurée en v1.
3. Communication publique : tweet, page statique d'incident hébergée
   ailleurs si l'incident dure > 30 min.

Plan d'évolution : héberger une page d'incident statique sur S3+
CloudFront, basculer le DNS via Cloudflare en cas de panne longue (pas
v1, à étudier post-launch).

## Scénario 4 : cron qui ne tourne plus

**Symptôme** : queue webhooks grandit, audit events `system.cron_tick`
absents depuis > 5 min.

```bash
# 1. Vérifier la config cron
vercel project inspect femiglow | grep -A2 cron

# 2. Vérifier les logs Vercel
vercel logs --follow | grep cron

# 3. Tester manuellement
curl -X POST https://femiglow.ma/api/cron/tick \
  -H "Authorization: Bearer $CRON_SECRET"
# 200 attendu
```

Causes fréquentes :
- `CRON_SECRET` mal mis à jour après rotation → 401.
- Erreur dans le handler qui jette tout → vérifier Sentry.
- Migration cassée (table `webhook_deliveries` indisponible).

Si bloqué, désactiver temporairement via `vercel.json` (commit + deploy)
puis revenir avec un fix.

## Scénario 5 : storage Neon proche du quota

**Symptôme** : alerte Neon "Storage > 5 GB".

```bash
# 1. Identifier les tables volumineuses
psql $DATABASE_URL -c "
  SELECT relname, pg_size_pretty(pg_relation_size(relid))
  FROM pg_stat_user_tables
  ORDER BY pg_relation_size(relid) DESC
  LIMIT 10;"

# 2. Probable cause v1 : webhook_deliveries
# Lancer la purge anticipée
psql $DATABASE_URL -c "
  DELETE FROM webhook_deliveries
  WHERE created_at < NOW() - INTERVAL '60 days'
    AND status IN ('succeeded', 'permanent');"

# 3. VACUUM FULL si nécessaire (lock — fenêtre de maintenance)
psql $DATABASE_URL -c "VACUUM FULL webhook_deliveries;"
```

Voir [`../06-data/retention-policy.md`](../06-data/retention-policy.md)
pour les durées de rétention de référence.

## Scénario 6 : pic de trafic / DDoS

**Symptôme** : 429 ou 5xx en masse, latence p95 explose.

1. Vercel a un WAF basique sur Pro — vérifier s'il bloque déjà.
2. Activer Vercel Firewall (Pro) avec règle de rate-limit IP
   (1000 req/min) :
   ```
   Vercel dashboard → Firewall → Add rule
   ```
3. Si le trafic est ciblé (URL spécifique) : règle de blocage URL.
4. Activer Cloudflare en proxy si l'attaque persiste (DNS switch, ~1h
   de propagation TTL).

Pas de protection DDoS niveau infra en v1 ; on s'appuie sur Vercel.

## Scénario 7 : fuite de secret

Voir [`../07-securite/incident-response.md`](../07-securite/incident-response.md#fuite-de-secret).

Brutal résumé : rotation immédiate via les procédures de
[`secrets-rotation.md`](secrets-rotation.md), force-push pour purger
git si nécessaire (`git filter-repo` + invalidation des caches).

## Communication d'incident

### Template message Slack initial

```
🚨 INCIDENT P{0|1|2} — {titre court}
Détecté : {timestamp UTC}
Impact : {description fonctionnelle utilisateur-visible}
Statut : INVESTIGATION EN COURS
Owner : {nom}
Update dans 15 min.
```

### Template update

```
🛠 UPDATE INCIDENT P{n} — {titre}
Statut : MITIGÉ | RÉSOLU
Cause : {root cause si connue}
Action : {ce qui a été fait}
Prochaine étape : {monitoring | post-mortem}
```

### Template clôture

```
✅ RÉSOLU P{n} — {titre}
Durée totale : {durée}
Cause : {root cause finale}
Action corrective : {ce qui empêchera la récidive}
Post-mortem : {lien doc} (sous 72h pour P0/P1)
```

## Post-mortem

Template dans [`../07-securite/incident-response.md#template-post-mortem`](../07-securite/incident-response.md#template-post-mortem).

Sections : timeline, impact, root cause, contributing factors, what went
well, what went wrong, action items (avec owner + deadline).

## Numéros & accès d'urgence

| Ressource | Accès |
|---|---|
| Vercel support | dashboard → Help → Contact (Pro plan response < 24h) |
| Neon support | neon.tech/contact (Pro plan response < 24h) |
| Sentry | sentry.io/support |
| Registrar (DNS) | identifiants dans 1Password / coffre fondatrice |

## Tests du runbook

Trimestriel, en preview :

1. Simuler un déploiement cassé → exécuter rollback.
2. Tuer la branche Neon dev → vérifier comportement maintenance mode.
3. Désactiver le cron → vérifier alerte sous 5 min.

À documenter dans `operations/runbook-tests.md` après chaque exercice.
