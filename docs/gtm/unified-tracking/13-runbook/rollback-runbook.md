# Rollback runbook

**Version** : 1.0  
**Dernière mise à jour** : 2026-05-14  
**Responsable** : Younes (exécution), Lead dev (décision)

## Objectif

Revenir à l'ancien système en cas de problème critique avec le nouveau, **sans perte de données**.

## Niveaux de rollback

| Niveau | Action | Réversibilité | Quand |
|---|---|---|---|
| L1 | Désactiver flag pour user X | Instant | Bug pour un user spécifique |
| L2 | Désactiver flag global | < 1 min | Bug observé chez plusieurs users |
| L3 | Restore code (revert deploy) | 5-10 min | Code v2 défectueux côté serveur |
| L4 | Restore DB depuis backup | 1-2h | Corruption DB (cas exceptionnel) |

Toujours commencer par **L1/L2** avant L3, et **L3** avant L4. Backup tables legacy intactes permettent toujours un retour.

---

## Niveau 1 — Désactiver flag pour 1 user

### Quand utiliser
- Amal rapporte un bug.
- Younes ne rapporte rien.
- Les autres admins n'ont pas accès.
- → Le bug est localisé sur le user. On le sort temporairement.

### Étapes

#### 1. Identifier l'utilisateur affecté
```
Bug rapporté par : amal@femiglow.ma
```

#### 2. Mettre à jour la variable d'environnement
```bash
# Avant :
TRACKING_PLAN_V2_ENABLED_USERS=younes@femiglow.ma,amal@femiglow.ma

# Après :
TRACKING_PLAN_V2_ENABLED_USERS=younes@femiglow.ma
```

#### 3. Redéployer / hot-reload l'env
```bash
# Vercel
vercel env rm TRACKING_PLAN_V2_ENABLED_USERS production
vercel env add TRACKING_PLAN_V2_ENABLED_USERS production
# Saisir nouvelle valeur

# Puis redéploiement automatique
```

#### 4. Confirmer
- Amal recharge sa page.
- Elle voit l'ancien admin.
- Younes voit toujours le nouveau.

#### 5. Communication
> Slack DM Amal : "Tu es repassée temporairement sur l'ancien tracking. On investigue le bug et on te repasse au nouveau dès que c'est fixé."

#### 6. Investigation
- Reproduire le bug avec le compte Younes ou un compte test.
- Fix.
- Réactivation du flag pour Amal.

---

## Niveau 2 — Désactiver flag global

### Quand utiliser
- Bug critique observé sur plusieurs users.
- Régression non spécifique.
- → On suspend pour tout le monde.

### Étapes

#### 1. Décision GO rollback
Lead dev confirme : "On rollback L2."

#### 2. Communication immédiate
Slack `#general` :
> ⚠️ Nous repassons temporairement à l'ancien système de tracking. Aucune action requise. On investigue.

#### 3. Désactiver le flag global
```bash
# Vercel ou autre infra :
vercel env rm TRACKING_PLAN_V2_ENABLED production
vercel env add TRACKING_PLAN_V2_ENABLED production
# Valeur : false
```

#### 4. Hot-reload
```bash
# Vercel redéploie automatiquement
# OU
# kubectl rollout restart deployment/web (si k8s)
```

Attendu : < 60 secondes pour appliquer.

#### 5. Vérifier
- Login admin avec un compte quelconque.
- Doit voir l'ancien admin (le legacy).
- Aucune erreur 500.

#### 6. Investigation
- Logs Sentry / Datadog.
- Reproduire le bug.
- Fix sur une branche.
- PR + review + merge.
- Re-tenter rollout (cf. rollout-strategy.md).

### Communication post-rollback
Slack `#general` (après stabilisation 1h) :
> ✅ Retour à l'ancien tracking effectué. Tout est stable. On planifie le re-rollout après correction.

---

## Niveau 3 — Restore code (revert deploy)

### Quand utiliser
- Le déploiement de code lui-même a introduit des erreurs (pas seulement le flag).
- Le code v2 a un bug même quand le flag est OFF (régression sur ancien admin).
- → On revient à la version précédente du code complet.

### Étapes

#### 1. Identifier la version précédente
```bash
# Lister les tags git
git tag --list 'tracking-plan-*' | tail -5

# Identifier le tag précédent : par exemple tracking-plan-v1.9.x
```

#### 2. Revert via plateforme
##### Vercel
```bash
# Listing des deployments
vercel ls

# Promote une version précédente
vercel promote <previous-deployment-url>
```

##### Kubernetes
```bash
kubectl rollout undo deployment/web -n production
```

#### 3. Vérifier
- Healthcheck OK.
- Routes accessibles.
- Pas d'erreur 500.
- DB intacte (les tables tracking_plans, tracking_plan_audit, tracking_defaults existent mais le code legacy ne les utilise pas → OK).

#### 4. Communication
Slack `#general` :
> ⚠️ Restore de l'ancien code effectué suite à un bug critique. Service stabilisé. Investigation en cours.

#### 5. Post-mortem
- Document détaillé sous 48h.
- Root cause analysis.
- Plan de prévention.

---

## Niveau 4 — Restore DB depuis backup

### Quand utiliser
- Corruption de données détectée.
- Tables nouvelles inutilisables.
- **Très rare** : ne pas paniquer, c'est toujours un dernier recours.

### Préconditions
- Backup récent (< 24h) accessible.
- DBA disponible.
- Lead dev sign-off explicite.

### Étapes

#### 1. STOP : Geler les écritures
```bash
# Mode maintenance via env var ou middleware
MAINTENANCE_MODE=true
```

#### 2. Backup actuel (pour preuve forensic)
```bash
pg_dump $DATABASE_URL > backup-pre-rollback-$(date +%Y%m%d-%H%M).sql
```

#### 3. Restore
```bash
# Drop les tables nouvelles
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS tracking_plans CASCADE;
DROP TABLE IF EXISTS tracking_plan_audit CASCADE;
DROP TABLE IF EXISTS tracking_defaults CASCADE;
EOF

# Renommer les legacy tables back to original names
psql $DATABASE_URL <<EOF
ALTER TABLE _legacy_v1_tracking_providers RENAME TO tracking_providers;
ALTER TABLE _legacy_v1_event_mapping_versions RENAME TO event_mapping_versions;
ALTER TABLE _legacy_v1_tracking_settings RENAME TO tracking_settings;
EOF
```

#### 4. Restore code legacy (si pas déjà fait via L3)
Cf. niveau 3.

#### 5. Retirer mode maintenance
```bash
MAINTENANCE_MODE=false
```

#### 6. Vérifier
- Healthcheck OK.
- Admin legacy fonctionne.
- Tracking client continue.

#### 7. Communication crise
Slack `#general` + email aux stakeholders :
> 🚨 Incident majeur résolu. Restore de la base de données effectué. Tout est stable. Post-mortem dans 24h.

#### 8. Post-mortem obligatoire
- Document complet.
- Direction informée.
- Plan d'action de prévention.

---

## Vérification post-rollback (tous niveaux)

Après n'importe quel rollback :

```bash
# 1. Healthcheck
curl -sf https://app.femiglow.ma/api/healthz

# 2. Login admin et navigation
# Manuel : tester quelques flows critiques

# 3. Métriques Grafana
# Erreur rate doit redescendre à baseline

# 4. Tracking client (events GA4)
# Vérifier que les events continuent d'arriver normalement
```

## Drill obligatoire

Avant la mise en production (sprint 6) :
- [ ] Drill L1 sur staging : OK
- [ ] Drill L2 sur staging : OK
- [ ] Drill L3 sur staging : OK
- [ ] Drill L4 sur copie de prod (pas la prod elle-même !) : OK

Chaque drill timed → permet d'estimer le temps réel de chaque opération.

## Templates communication

### Slack — Rollback L2 immediate
```
:rotating_light: Rollback du nouveau tracking en cours.

Action : flag global OFF, retour à l'ancien admin.
Impact : aucun pour le tracking côté client.
Investigation : en cours.

Vous voyez de nouveau l'ancien interface dans /admin/tracking.
Updates dans 30 min.
```

### Slack — Stabilisation post-rollback
```
:white_check_mark: Rollback terminé. Service stable.

Root cause : {short description}
Fix : en cours sur branch {name}
Re-rollout planifié : {date}

Post-mortem partagé dans 48h.
```

### Email — Incident majeur (L4)
```
Subject: [INCIDENT] Tracking — service stabilisé

Bonjour,

Un incident technique sur le tracking a nécessité un rollback complet.

✅ Statut actuel : service stabilisé, ancien admin actif.
⏱ Durée incident : {N minutes}
🔍 Investigation : post-mortem dans 24h.

Aucun impact sur le tracking côté visiteurs (events continuent à remonter).

Pour toute question, contactez {lead dev}.

Merci pour votre patience.
```
