# Architecture cible — Unified Tracking System

## 1. Vue système

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                            │
│                                                                          │
│   Page web / Chat / Wizard checkout                                      │
│         │                                                                │
│         ▼                                                                │
│   trackEvent(name, payload)                                              │
│         │                                                                │
│         ▼                                                                │
│   apps/web/src/lib/tracking/client/dispatcher.client.ts                  │
│         │                                                                │
│         ├──► gtag('event', ...) ─► GTM dataLayer ─► GTM container        │
│         ├──► fbq('track', ...)  ─► Pixel Meta direct (fallback)          │
│         └──► POST /api/track    ─► Server dispatch (CAPI)                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Next.js)                            │
│                                                                          │
│   /api/track   ─►  TrackingDispatcher                                    │
│                       │                                                  │
│                       ├─► ResolveEventMapping (lit plan actif)           │
│                       ├─► EnrichWithIdentity (consent, IP, UA)           │
│                       └─► Provider Adapters (Meta CAPI, GA4 MP, ...)     │
│                                                                          │
│   /api/admin/tracking/plans/*                                            │
│                       │                                                  │
│                       └─► TrackingPlanService                            │
│                              │                                           │
│                              ├─► Repository (Postgres + JSONB)           │
│                              ├─► Validator (Zod + lint métier)           │
│                              ├─► Exporter (plan → GTM JSON)              │
│                              └─► AuditLogger                             │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              POSTGRES                                    │
│                                                                          │
│   trackingPlans          (1 table, JSONB plan, status, bundleId)         │
│   trackingPlanAudit      (qui/quoi/quand/diff)                           │
│   trackingDefaults       (key-value pour autocomplete)                   │
│   gtmSentinelPings       (drift — inchangé)                              │
│   gtmDriftState          (drift — inchangé)                              │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          GTM (Google Tag Manager)                        │
│                                                                          │
│   Container GTM-M8K7V88D (importé depuis JSON unique)                    │
│         │                                                                │
│         ├─► GA4 Config Tag (variable {{CONST - GA4 Measurement ID}})     │
│         ├─► GA4 Event Tags (1 par event mappé)                           │
│         ├─► Google Ads Conversion Tags                                   │
│         └─► HTML Tags (Pixel snippets si non-CAPI)                       │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Couches logicielles

### 2.1 Domain layer (`apps/web/src/lib/tracking/plan/`)

- `schema.ts` — Zod canonique de `TrackingPlan` (la source de vérité du modèle).
- `service.ts` — opérations métier (create, update, activate, validate).
- `repository.ts` — accès Postgres, transactions.
- `exporter.ts` — projection `plan → GtmContainerJson`.
- `validator.ts` — Zod + règles métier (placeholders interdits, cohérence env).
- `bundle-id.ts` — hash déterministe du plan.

### 2.2 API layer (`apps/web/src/app/api/admin/tracking/plans/`)

- `route.ts` — `GET` (list), `POST` (create)
- `[id]/route.ts` — `GET`, `PATCH`, `DELETE`
- `[id]/activate/route.ts` — `POST`
- `[id]/validate/route.ts` — `POST`
- `[id]/export/route.ts` — `GET` (env query param)
- `[id]/sync-status/route.ts` — `GET`

### 2.3 Client layer (`apps/web/src/lib/tracking/client/`)

- `dispatcher.client.ts` — entry point côté browser
- `gtag.client.ts` — wrapper dataLayer
- `pixel-fallback.client.ts` — fallback Pixel Meta si GTM indisponible
- `consent.client.ts` — lecture Consent Mode

### 2.4 Admin UI (`apps/web/src/components/admin/tracking/plan/`)

- `TrackingPlanWizard.tsx` — wizard 5 étapes
- `TrackingPlanExpert.tsx` — éditeur 3 colonnes
- `sections/` — un composant par section (Providers, Events, Envs, etc.)
- `preview/` — preview JSON, diff viewer
- `store.ts` — Zustand store local de l'édition

### 2.5 Runtime resolver (`apps/web/src/lib/tracking/runtime/`)

- `resolver.ts` — lit plan actif, retourne mapping pour un event/provider
- `cache.ts` — cache RAM 30s avec invalidation explicite à l'activation
- `consent.ts` — applique règles consent côté serveur

## 3. Frontières et invariants

| Invariant | Garantie |
|---|---|
| Un seul plan actif à la fois | Index unique partial Postgres |
| `bundleId` déterministe | Hash SHA-256 sur JSON canonical (champs triés) |
| Pas de placeholder en plan actif | Validator côté serveur refuse activation |
| Export reproductible | Snapshot tests Vitest sur `exporter.ts` |
| Mapping resolver ne falls back jamais sur code legacy | Plan actif toujours présent (init seeded) |
| Audit log immutable | INSERT-only, pas d'UPDATE |

## 4. Stratégie de migration

Cf. [12-action-plan/action-plan.md](../12-action-plan/action-plan.md) pour le détail séquencé. Vue d'ensemble :

```
T0 : Phase 0 — Préparation (schéma + script migration)
T+2j : Phase 1 — Backend unifié (endpoints en lecture seule)
T+7j : Phase 2 — Frontend wizard
T+14j : Phase 3 — Mode expert + activation
T+74j : Phase 4 — Cleanup anciennes structures
```

## 5. Observability

- **Logs structurés** sur toutes les transitions de plan (`activated`, `archived`, `validation_failed`).
- **Metric Prometheus** : `tracking_plan_active_age_seconds` (alerte si > 30 jours sans rotation = signal stale).
- **Metric** : `tracking_event_dispatch_duration_ms` par provider.
- **Alert** : `tracking_drift_state_changed_to_critical`.

## 6. Sécurité

- Tokens (CAPI, GA4 MP API secret) chiffrés au repos (KMS-backed).
- Seuls champs lecture-seule renvoyés côté client (jamais le token brut).
- CSRF token sur tous les POST/PATCH/DELETE admin.
- Audit log capture user agent + IP source des changements admin.

## 7. Performance

- Plan actif caché en RAM 30s côté serveur.
- Export GTM regénéré à la demande, jamais cached (déterministe → idempotent).
- Validation Zod < 5ms même sur plan complet.
- Drift snapshot inséré async (non-bloquant pour le ping client).
