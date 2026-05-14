# Monitoring runbook

**Version** : 1.0  
**Dernière mise à jour** : 2026-05-14

## Vue d'ensemble

Surveillance du module Tracking Plan v2 en production via :
- **Grafana dashboard** (custom).
- **Sentry** (erreurs).
- **Datadog APM** (latence, traces).
- **Drift detector** (interne).
- **Logs serveur Next.js**.

## Grafana dashboard

URL : `https://grafana.internal.femiglow.ma/d/tracking-plan-v2`

### Panneaux

#### 1. Active plan
- Affichage : plan ID actuel, bundle hash, depuis quand actif.
- Source : query DB `SELECT id, bundle_id, activated_at FROM tracking_plans WHERE status='active'`.
- Refresh : 30s.

#### 2. Drift status
- Affichage : OK / Warning / Critical avec couleur.
- Source : query `gtm_drift_state` table.
- Alerte : critical → notif Slack + email.

#### 3. Latence endpoints
- 4 panels : `GET /plans`, `POST /validate`, `POST /export`, `POST /activate`.
- Affichage : p50, p95, p99.
- Source : Datadog APM.
- Alerte : p95 > cible × 2 pendant 5 min.

#### 4. Erreurs 5xx
- Affichage : count par minute.
- Breakdown par endpoint.
- Alerte : > 10/min → SEV-2.

#### 5. Events GA4 received
- Affichage : count par heure.
- Comparaison vs J-1 même heure.
- Alerte : delta < -20% → SEV-2 (perte de tracking).

#### 6. Plans by status
- Affichage : pie chart (active, draft, archived).
- Source : `SELECT status, count(*) FROM tracking_plans GROUP BY status`.

#### 7. Activations (24h)
- Affichage : timeline.
- Source : `tracking_plan_audit` table avec action='activate'.

#### 8. Top errors
- Affichage : liste des messages d'erreur les plus fréquents.
- Source : Sentry.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Tracking Plan v2 — Production Health                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Active plan      │  │ Drift status     │             │
│  │ Production v8    │  │ ✓ OK             │             │
│  │ Bundle abc123    │  │                  │             │
│  │ Active 2j        │  │ Last critical:   │             │
│  │                  │  │ never            │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌─────────────────────────────────────────┐            │
│  │ Endpoint latency (p95)   [5min/30min]   │            │
│  │                                          │            │
│  │ GET /plans      ┌──────┐  48ms ✓        │            │
│  │ POST /validate  ┌────────┐  142ms ✓     │            │
│  │ POST /export    ┌─────┐  98ms ✓         │            │
│  │ POST /activate  ┌──────────┐  876ms ✓   │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Errors 5xx (5m)  │  │ GA4 events (1h)  │             │
│  │ 0  ✓             │  │ 89               │             │
│  │                  │  │ Δ +2% (stable)   │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Plans by status  │  │ Activations 24h  │             │
│  │ ●● active: 1     │  │ 0                │             │
│  │ ●● draft: 2      │  │                  │             │
│  │ ●● archived: 12  │  │                  │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌─────────────────────────────────────────┐            │
│  │ Top errors (24h)                         │            │
│  │ 1. (none)                                │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Alerting

### Règles

| Alerte | Condition | Action |
|---|---|---|
| Drift critical | drift_state = 'critical' pendant 3 min | Slack `#tech-tracking-plan` + email Younes |
| Latence dégradée | p95 endpoint > cible × 2 pendant 5 min | Slack |
| Erreurs 5xx burst | > 10 erreurs/min pendant 2 min | Slack + Sentry tag |
| Perte tracking | GA4 events reçus < 80% baseline pendant 1h | Slack + email Lead |
| DB connection fail | Connection pool exhausted | Pager |
| Memory leak | RSS > 1GB sur instance | Slack |
| Activations failed | 3 échecs consécutifs activate | Slack |

### Canaux

- **Slack `#tech-tracking-plan`** : alertes routine.
- **Slack `#alerts-prod`** : alertes critiques (SEV-1).
- **Email Younes + Lead** : alertes nécessitant action.
- **Pager** : SEV-1 uniquement (DB down, secret leak).

### Mute / acknowledge

Tout dev peut **acknowledge** une alerte (clic dans Slack thread). Cela mute pour 30 min.

**Mute long** (> 1h) : nécessite raison + approbation Lead.

## Logs

### Localisation

- **Serveur Next.js** : Datadog Logs ou équivalent.
- **DB** : Postgres logs accessibles via dashboard provider.
- **Frontend** : Sentry (erreurs JS) + Datadog RUM (perf).

### Query utiles

#### Erreurs récentes sur module tracking
```
service:web AND module:tracking-plan AND level:error
```

#### Activations
```
service:web AND module:tracking-plan AND event:plan-activated
```

#### Drift events
```
service:web AND module:drift-detector AND severity:critical
```

#### Slow queries DB
```
service:postgres AND duration:>1s AND query:*tracking_plans*
```

## Métriques business hebdo

À examiner chaque lundi (rituel équipe) :

### Métriques quantitatives
- Nombre de plans activés cette semaine.
- Nombre de drift incidents.
- Latence moyenne et p95.
- Erreurs cumulées.
- Adoption mode wizard vs expert.

### Métriques qualitatives
- Feedback users (collecté dans canal dédié).
- Bugs reportés.
- Demandes de feature.

## Dashboards externes

| Dashboard | URL | Utilité |
|---|---|---|
| Google Analytics 4 | `analytics.google.com/...` | Vérifier events réels reçus |
| Meta Events Manager | `business.facebook.com/...` | Vérifier events Meta |
| Google Ads | `ads.google.com/...` | Vérifier conversions Ads |
| GTM Container | `tagmanager.google.com/...` | État du container actif |
| Drizzle Studio (local) | `localhost:4983` | Inspection DB |

## Capacité

### Limites actuelles
- 50 plans actifs simultanés OK (testé).
- 30 events par plan OK.
- 1000 req/s sur `/plans` OK (lecture cached).
- 100 activations/jour OK.

### Scaling
- Si > 1000 plans : index sur `created_at` pour pagination.
- Si > 100 req/s lecture : Redis cache (au-delà du `PlanCache` mémoire).
- Si > 10 activations/min : queue async (BullMQ ?).

Actuellement aucun besoin de scaler. À revoir si volume change.

## Astreinte

### Horaires
- 9h-18h jours ouvrés : couvert par équipe normale.
- Hors heures : pas d'astreinte formelle pour MVP.
- V2 : si volume / criticité augmente, mise en place rotation oncall.

### Procédure hors heures
- Pas d'astreinte officielle, mais Younes et Lead peuvent être contactés en urgence par DM Slack.
- Si réception alerte hors heures : ack et investigation si critique. Sinon J+1.

## Reporting mensuel

Chaque 1er du mois, Lead dev rédige un mini-rapport :
- Uptime mensuel.
- Incidents (SEV-1, SEV-2).
- Adoption (% wizard vs expert).
- Top 3 bugs reportés.
- Roadmap mois suivant.

Partagé sur canal `#tech-tracking-plan` + email équipe.
