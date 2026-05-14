# Deployment runbook

**Version** : 1.0  
**Dernière mise à jour** : 2026-05-14  
**Responsable** : Younes (exécution), Lead dev (supervision)

## Objectif

Déployer une nouvelle version du module Tracking Plan v2 en production sans interruption de service.

## Préconditions

- [ ] `release/tracking-plan-v2` branch mergée dans `master` (PR finale validée).
- [ ] Tous les tests CI passent sur le commit à déployer.
- [ ] Migration DB déjà appliquée (cf. migration-runbook.md).
- [ ] Tag git créé : `tracking-plan-v2.0.0`.
- [ ] Communication T-3 jours envoyée.
- [ ] Backup DB récent (< 24h).
- [ ] Lead dev et Younes disponibles.

## Fenêtre recommandée

Mardi, mercredi ou jeudi, 10h-12h ou 14h-16h. **Pas le vendredi**.

## Étapes

### 1. Pré-déploiement (T-30 min)

#### 1.1 Vérification du build CI
```bash
# Vérifier sur GitHub Actions / CircleCI :
# Status du dernier commit sur master = green ✓
```

#### 1.2 Vérification de l'environnement cible
```bash
# Variables d'env en prod actuellement :
# - TRACKING_PLAN_V2_ENABLED=false  (correct : on déploie le code, on n'active pas encore)
# - TRACKING_PLAN_V2_LEGACY_ROUTES_ENABLED=true  (correct : legacy actif)
```

Si l'une de ces variables n'est pas comme attendu : **STOP**, communiquer, comprendre pourquoi.

#### 1.3 Backup ad-hoc
```bash
# Lancer un backup manuel pour être sûr
pg_dump $DATABASE_URL > backup-pre-deploy-$(date +%Y%m%d-%H%M).sql
```

Vérifier la taille du fichier > 0.

#### 1.4 Notification équipe
Slack `#tech-tracking-plan` :
> 🚀 Déploiement Tracking Plan v2 dans 30 minutes. Monitoring actif. Feature flag reste OFF.

### 2. Déploiement (T+0)

#### 2.1 Trigger du déploiement
```bash
# Selon infra (Vercel, Kubernetes, etc.)
# Exemple Vercel :
vercel --prod

# Ou via CI/CD pipeline :
# Action manuelle "Deploy to production" sur GitHub Actions
```

#### 2.2 Attendre fin de build & deploy
Suivre les logs en temps réel. Durée typique : 5-10 min.

Critère : "Deployment success" + URL accessible.

#### 2.3 Smoke test santé
```bash
# Endpoint healthcheck
curl -sf https://app.femiglow.ma/api/healthz
# Attendu : { "status": "ok", "version": "tracking-plan-v2.0.0" }
```

Si KO : voir Plan B.

### 3. Post-déploiement (T+10 min)

#### 3.1 Smoke tests fonctionnels

##### 3.1.1 Routes legacy toujours accessibles
```bash
# Sans login (juste pour vérifier que la route ne 404 pas)
curl -sf -o /dev/null -w "%{http_code}\n" https://app.femiglow.ma/admin/tracking
# Attendu : 200 ou 302 (vers login)

curl -sf -o /dev/null -w "%{http_code}\n" https://app.femiglow.ma/admin/tracking/pixels
# Attendu : 200 ou 302
```

##### 3.1.2 Nouvelles routes accessibles (mais non actives)
```bash
curl -sf -o /dev/null -w "%{http_code}\n" https://app.femiglow.ma/admin/tracking/plans
# Si flag OFF + legacy ON : devrait 302 vers /admin/tracking/pixels (le legacy)
# Ou 200 avec page lecture-seule basique selon impl middleware

curl -sf -o /dev/null -w "%{http_code}\n" https://app.femiglow.ma/api/admin/tracking/plans
# Attendu : 401 sans auth, mais la route doit exister (pas 404)
```

#### 3.2 Vérification base de données
```bash
# Connexion DB
psql $DATABASE_URL

# Vérifier que les tables nouvelles existent
\dt tracking_plans
\dt tracking_plan_audit
\dt tracking_defaults

# Vérifier que les tables legacy existent encore
\dt _legacy_v1_tracking_providers
\dt _legacy_v1_event_mapping_versions
\dt _legacy_v1_tracking_settings
```

Attendu : toutes les tables présentes.

#### 3.3 Vérification métriques Grafana
- Erreur rate API : doit rester < 0.1%.
- Latence p95 : pas de dégradation.
- Drift status : pas d'alerte.

### 4. Validation finale

#### 4.1 Test admin manuel (Lead dev)
1. Login en admin sur prod (compte test).
2. Aller sur `/admin/tracking` → ancien admin doit s'afficher (flag OFF).
3. Vérifier que toutes les fonctions existantes marchent encore.

#### 4.2 Sign-off

Lead dev confirme dans Slack :
> ✅ Déploiement Tracking Plan v2 validé. Code en prod, flag toujours OFF. Activation user-by-user demain (cf. rollout-strategy.md).

### 5. Suivi 24h

#### 5.1 Monitoring continu
- Vérifier Sentry / Datadog toutes les 2h pendant 24h.
- Vérifier Grafana toutes les 4h.
- Pas de bug remonté côté users (canal Slack support).

#### 5.2 Recap J+1
Lead dev poste un recap dans Slack après 24h.

## Critères de succès

- [ ] Build CI vert.
- [ ] Deploy success sans erreur.
- [ ] Healthcheck OK.
- [ ] Routes legacy accessibles.
- [ ] Nouvelles routes accessibles (mais redirigent vers legacy si flag OFF).
- [ ] DB tables nouvelles + legacy présentes.
- [ ] 0 alerte SRE pendant la fenêtre.
- [ ] 0 spike d'erreurs prod.

## Plan B si échec

### Cas 1 : Build CI fail
- Ne pas déployer.
- Fix sur branche feature.
- Re-tenter quand vert.

### Cas 2 : Deploy fail (infra)
- Vérifier les logs du provider (Vercel, k8s, etc.).
- Si rollback auto disponible : laisser faire.
- Sinon : déclencher rollback manuel.

### Cas 3 : Healthcheck KO après deploy
- Vérifier logs serveur (erreurs runtime).
- Si erreur évidente (migration manquante) : appliquer fix.
- Si pas évident : **rollback immédiat** (cf. rollback-runbook.md).

### Cas 4 : Smoke tests fonctionnels KO
- Identifier la route impactée.
- Si critique (login KO) : **rollback immédiat**.
- Si secondaire : fix urgent + redéploiement.

## Communication

| Moment | Audience | Message |
|---|---|---|
| T-30 min | `#tech-tracking-plan` | Annonce début deploy |
| T+0 | `#tech-tracking-plan` | "Deploy en cours" |
| T+15 min | `#tech-tracking-plan` | "Deploy terminé, smoke tests en cours" |
| T+30 min | `#tech-tracking-plan` + `#general` (si OK) | "Deploy validé, prochaine étape : rollout admin J+1" |
| T+24h | `#tech-tracking-plan` | Recap stabilité 24h |

## Annexes

### Variables d'env de référence (prod)
```bash
# Tracking
TRACKING_PLAN_V2_ENABLED=false              # restera false jusqu'à rollout
TRACKING_PLAN_V2_ENABLED_USERS=             # restera vide jusqu'à J+0 du rollout
TRACKING_PLAN_V2_LEGACY_ROUTES_ENABLED=true # restera true jusqu'à T+30j
TRACKING_PLAN_CACHE_TTL_MS=30000
TRACKING_PLAN_STRICT_PLACEHOLDERS=true

# DB
DATABASE_URL=postgresql://...
```

### Contacts urgence
- Lead dev : DM Slack
- DBA : email + Slack
- SRE on-call : pager
