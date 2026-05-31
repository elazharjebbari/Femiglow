# 60.3 — KPIs cibles

## KPIs business

| KPI | Définition | Cible | Source |
|---|---|---|---|
| Taux d'attribution Google Ads | % de purchases avec conversion Google Ads OK | ≥ 95% | tracking_events_log + Google Ads API |
| Coverage CAPI | % de conversions reçues côté serveur (vs client only) | ≥ 90% | tracking_events_log.providers_results |
| Latence dispatch p95 | 95e percentile latence dispatch CAPI | < 800ms | tracking_events_log |
| Conversion drop entre form_start et purchase | % de form_start qui ne deviennent pas purchase | < 70% (baseline à mesurer) | Funnel GA4 |
| Dédup ratio | Conversions reçues 2× par Google (client + serveur) puis dédup correctement | 100% | Google Ads UI |

## KPIs techniques

| KPI | Définition | Cible | Source |
|---|---|---|---|
| `/api/track` p95 | Latence ingest events | < 200ms | Server logs |
| Provider error rate 24h | % d'événements en erreur par provider | < 5% | tracking_events_log |
| Coverage tests | Coverage Jest sur `lib/tracking/` | > 80% | Vitest coverage |
| Build time | Temps `next build` | < 4 min | CI |
| Lighthouse Performance /kit | Score Lighthouse mobile | ≥ 85 | Lighthouse CI |

## KPIs admin UX

| KPI | Définition | Cible | Source |
|---|---|---|---|
| Time to create GTM version | Temps moyen wizard create | < 5 min | UX analytics |
| Bounce rate dans wizard | % d'abandon entre step 1 et review | < 20% | UX analytics |
| Error rate categorization | % d'updates qui échouent | < 1% | tracking_events_log admin events |
| Lighthouse Accessibility | Score Lighthouse a11y | ≥ 95 | Lighthouse CI |

## KPIs marketing (Google Ads spécifique)

| KPI | Définition | Cible | Source |
|---|---|---|---|
| ROAS Google Ads | Return on Ad Spend | ≥ 3x (à valider Marketing) | Google Ads UI |
| Conversions par catégorie | Nombre de conversions par catégorie (purchase, lead, contact) | À définir | Google Ads + dashboard interne |
| CPL (Cost Per Lead) | Coût par lead capturé | À définir | Google Ads UI |
| CPA (Cost Per Acquisition) | Coût par purchase | À définir | Google Ads UI |
| Smart Bidding maturity | Nombre de jours avec Smart Bidding actif sur chaque action | ≥ 30j | Google Ads UI |

## KPIs de monitoring/SRE

| KPI | Définition | Cible | Source |
|---|---|---|---|
| Uptime `/api/track` | % de disponibilité | ≥ 99.9% | Uptime monitor |
| MTTR pannes tracking | Mean Time To Recovery | < 30 min | Incidents log |
| Quota Google Ads API | % usage du quota daily | < 80% | Google Ads API metrics |
| Backup OAuth refresh tokens | Frequency of token rotation | Quarterly | Audit logs |

## Comment ces KPIs sont mesurés

### Built-in dashboards

`/admin/tracking/analytics/providers` affiche en temps réel :
- Latence p50/p95 par provider
- Success rate
- Errors 24h
- Conversions par jour (7 derniers jours)

### Audit log

`audit_events` track :
- Toute modification de config (`tracking.config.changed`)
- Création de version GTM (`tracking.gtm.version_created`)
- Activation de version (`tracking.gtm.version_activated`)
- Override de catégorie (`tracking.event.category_overridden`)

### Métriques externes

À configurer si besoin :
- Prometheus / Grafana pour les latences p95 sur 30 jours
- Sentry pour les erreurs runtime
- Google Ads API reporting pour le ROAS

## Definitions of Done par KPI

- KPI Business cible atteint pendant 30 jours consécutifs
- KPI Technique vert en CI sur 5 builds consécutifs
- KPI UX validé après onboarding interne avec marketing
