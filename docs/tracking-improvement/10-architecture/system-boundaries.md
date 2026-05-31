# 10.4 — Périmètre & frontières système

## In scope

- Refonte `lib/tracking/providers/google-ads.ts` pour CAPI server-side
- Modifications de `lib/tracking/server/dispatcher.ts` (event_id, retry)
- Fix bug `CONVERSION_EVENTS` dans `/api/track/route.ts`
- Ajout custom event `form_start`, refonte mapping `begin_checkout`
- Nouveau composant `GtmConfigForm` avec pré-remplissage + édition
- Nouvelle UI `/admin/tracking/events/categorization`
- Nouvelle UI `/admin/tracking/analytics/providers`
- Nouvelle table `tracking_event_overrides`
- Migrations DB associées
- Documentation, ADRs, runbook
- Tests Jest + MSW + Playwright (suite complète)

## Out of scope

- Refonte du wizard de checkout `/kit` (composants UI inchangés sauf
  émission `form_start`)
- Refonte de la table `tracking_providers` (pas de migration vers per-env IDs en V1)
- Google Ads Offline Conversions API (réservé pour V2)
- Migration vers Vercel ou autre infra (reste sur le serveur actuel)
- Refonte du consent banner (reste désactivé, defaultGranted=true)

## Intégrations externes

| Service | Endpoint utilisé | Auth | Version API |
|---|---|---|---|
| Google Ads | googleads.googleapis.com v17 | OAuth refresh token + Developer Token | v17 |
| Meta CAPI | graph.facebook.com/v22.0 | Access Token | v22.0 |
| GA4 Measurement Protocol | google-analytics.com/mp/collect | api_secret | v1 |
| TikTok | business-api.tiktok.com/open_api/v1.3 | access_token | v1.3 |
| Snap | tr.snapchat.com/v3/conversions | bearer | v3 |
| Pinterest | api.pinterest.com/v5/ad_accounts | bearer | v5 |

## Frontières admin

| Page admin | Existant | Nouveau / refactor |
|---|---|---|
| /admin/tracking | ✅ existante | refresh KPIs |
| /admin/tracking/providers | ✅ existante | inchangé en V1 |
| /admin/tracking/gtm | ✅ existante | refactor form (préremplissage + édition) |
| /admin/tracking/pixels | ✅ existante | inchangé |
| /admin/tracking/events | ✅ existante | sub-route /categorization NEW |
| /admin/tracking/analytics | ⚠ partielle | sub-route /providers NEW |
| /admin/tracking/inventory | ✅ existante | inchangé |
| /admin/tracking/settings | ✅ existante | inchangé |

## Frontières DB

| Table | Action |
|---|---|
| tracking_providers | inchangée (V1) |
| tracking_settings | nouvelle clé `gtm.config_versions` (déjà là), reuse |
| tracking_events_log | + colonne `event_id` |
| tracking_event_overrides | NOUVELLE |
| tracking_event_definitions | inchangée |

## Hors champs (à NE PAS toucher)

- Le wizard de checkout `/kit` (au-delà de l'émission form_start)
- L'API publique `/api/checkout/*`
- Le module chat
- Le module products / SEO / rituals
- Le module admin auth / RBAC

## Risques d'adhérence

- **Tests `chat-lead-capture.spec.ts`** : dépendent du mapping
  `chat_lead_form_submit → generate_lead`. Vérifier non-régression.
- **Tests `checkout-wizard-kit.spec.ts`** : dépendent de l'émission
  `begin_checkout` au mount. À mettre à jour pour vérifier `form_start`.
- **Composants admin** : `TrackingClient` et `PixelLoader` mocks utilisés
  dans plusieurs tests. Garder API stable.
