# 00.1 — Executive summary

## Contexte

L'audit (cf. `docs/tracking-audit/`) a identifié **4 chantiers** sur la stack
tracking actuelle. Ce dossier décrit le **plan technique pour les exécuter
en parallèle**.

## Enjeux business

| Métier | Mesure actuelle | Objectif post-refonte | Levier |
|---|---|---|---|
| Conversions Google Ads attribuées | ~70-80% | **95-99%** | Server-side CAPI (chantier 1) |
| Productivité admin GTM | ~30min / nouvelle version | **~5min** | Pré-remplissage Providers (chantier 2) |
| Couverture catalogue d'events conversion | 3/5 | **5/5** (lead_capture, begin_checkout fixé) | Fix CONVERSION_EVENTS (chantier 1) |
| Visibilité ROI tracking par provider | 0% | **100%** (dashboards) | Built-in analytics (chantier 4) |

## Architecture cible

```
                              Browser
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   gtag.js (GA4/Ads/GTM)   fbevents.js           TrackingClient
        │ event_id            │ event_id              │ event_id
        ▼                     ▼                       ▼
   Google                  Meta                  POST /api/track
   (direct)               (direct)                   │
                                                    ▼
                                          Dispatcher serveur
                                          ├ Meta CAPI ★
                                          ├ GA4 MP ★
                                          ├ Google Ads CAPI ✨ NEW
                                          ├ TikTok CAPI ★
                                          ├ Snap CAPI ★
                                          ├ Pinterest CAPI ★
                                          └ tracking_events_log
                                                    │
                                                    ▼
                                              Dashboards
                                          /admin/tracking/analytics
```

`event_id` partagé client/serveur → déduplication native côté providers.

## Effort total estimé

| Chantier | Effort | % |
|---|---|---|
| 1 — Pipeline conversion (Google Ads CAPI + form_start + bugs) | 16-24 h | 50% |
| 2 — GTM Editor UX | 8-12 h | 25% |
| 3 — Catégorisation conv. | 4-6 h | 12% |
| 4 — Observabilité | 6-8 h | 13% |
| **TOTAL** | **34-50 h** | **100%** |

Soit ~1 semaine ingé focus.

## Risques majeurs

1. **OAuth Google Ads complexe** — peut bloquer le chantier 1. Mitigation : on
   commence par Enhanced Conversions (plus simple), puis on étend si besoin.
2. **Régression checkout** — toucher au mapping events peut casser le funnel.
   Mitigation : feature flag par event, tests e2e exhaustifs.
3. **Migration data** — passer le `pixel_id` de scalaire à par-env nécessite
   migration. Mitigation : on garde scalaire en V1, refactor en V2.

## Livrables attendus

Code :
- `lib/tracking/providers/google-ads.ts` (refonte)
- `lib/tracking/server/dispatcher.ts` (event_id propagation)
- `app/api/track/route.ts` (fix CONVERSION_EVENTS)
- Nouvelle UI `/admin/tracking/events/categorization`
- Nouvelle UI `/admin/tracking/analytics/providers`
- Refonte `GtmConfigForm.tsx` (pré-remplissage + édition)

Tests :
- 30+ tests Jest unitaires
- 8 scénarios Playwright e2e
- 1 test "pipeline ultime" qui valide la chaîne complète

Documentation :
- Ce dossier
- ADR pour chaque décision majeure
- Runbook de déploiement

## Critères de succès

Voir `success-criteria.md`.
