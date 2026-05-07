# 10 — Plan d'action

## Vue d'ensemble

Découpage en **7 phases**, environ **98 tâches atomiques**
(`TRK-001` → `TRK-098`).

| Phase | Thème | Livrable | Durée estimée |
|---|---|---|---|
| 1 | Inventaire + data | scanner, schéma BDD, seed | 5 j |
| 2 | DataLayer + client core | TrackingProvider, useTracking, dedup | 6 j |
| 3 | API ingestion + persist | /api/track, validator, retention | 4 j |
| 4 | Providers : Meta, Google, TikTok | adapters + CAPI + mapping | 7 j |
| 5 | Providers : Snap, Pinterest, GTM, custom | adapters + sandbox | 4 j |
| 6 | Console admin | dashboard, inventory, providers, test, logs | 10 j |
| 7 | Polish + tests + go-live | E2E, a11y, perfs, doc, instrumentation site | 7 j |

Total : ~43 j, soit **6–7 semaines** à plein temps.

Préfixe ticket : `TRK-XXX`. Critères d'acceptation à la fin de
chaque tâche : `pnpm typecheck` + `pnpm lint` + tests verts.

---

## Phase 1 — Inventaire + data (TRK-001 → TRK-015)

### TRK-001 — Enums Drizzle
Ajouter les 6 `pgEnum` listés dans [02-data.md §3](02-data.md).
**Critère** : `pnpm typecheck` passe.

### TRK-002 — Tables `tracking_pages` + `tracking_components`
Créer les deux tables avec colonnes définies, index, contraintes
FK. **Critère** : migration générée + appliquée en local.

### TRK-003 — Tables `tracking_pages_components` + `tracking_event_definitions`
Idem.

### TRK-004 — Tables `tracking_component_events` + `tracking_providers`
Idem. Colonnes `capi_token*` (chiffrement).

### TRK-005 — Tables `tracking_events_log` + `tracking_consent_snapshots`
Idem. Index BRIN sur `received_at`.

### TRK-006 — Memory store fallback
Étendre `MemoryStore` avec les 7 maps tracking + LRU pour `eventsLog`.

### TRK-007 — Types TS dérivés
`src/lib/db/types.ts` : exports `TrackingPage`, etc.

### TRK-008 — Queries CRUD `pages` + `components`
`src/lib/db/queries/tracking/{pages,components}.ts`.
Fonctions `findById`, `list`, `upsert`, `delete`.

### TRK-009 — Queries CRUD `event-definitions` + `component-events`
Idem.

### TRK-010 — Queries CRUD `providers`
Avec helpers `decryptCapiToken`, `encryptCapiToken`.

### TRK-011 — Queries `events-log`
`logEvent`, `listEvents` (pagination, filtres).

### TRK-012 — Queries `consent-snapshots`
`upsertSnapshot` (dédup par `state_hash`).

### TRK-013 — Scanner inventaire
`src/lib/tracking/inventory/scanner.ts` + tests fixtures.
Sortie : `inventory.generated.json`.

### TRK-014 — Script `seed-tracking.ts`
Idempotent. UPSERT pages, components, event_definitions (depuis
catalogue TS), providers (rows désactivées).

### TRK-015 — Inventory diff
`src/lib/tracking/inventory/diff.ts` + test contract.

---

## Phase 2 — DataLayer + client core (TRK-016 → TRK-035)

### TRK-016 — Catalogue events TS
`src/lib/tracking/event-catalog.ts` — 36 events listés
[07-events-catalog.md](07-events-catalog.md). Constante typée
exhaustive.

### TRK-017 — Schémas Zod events
`src/lib/tracking/schemas.ts` — 36 schémas.

### TRK-018 — `datalayer.ts` (client)
Push, alias GTM, MAX_BUFFER, getDataLayer.

### TRK-019 — UUID v7
Ajouter dépendance `uuidv7` (npm). Wrapper
`src/lib/tracking/uuid.ts`.

### TRK-020 — `TrackingClient` core
Classe avec emit, queue, flush, dedup LRU. Tests unit.

### TRK-021 — `TrackingProvider` (React)
Context + Pixels loader (placeholder, providers Phase 4+).

### TRK-022 — `useTracking()` hook
Avec types `EmitFn` génériques.

### TRK-023 — Composant `<Track>` déclaratif
Modes `mount`, `visible`, `click`, `submit`, `play`.

### TRK-024 — `<AutoEvent>` SSR helper
Pour events Server Components.

### TRK-025 — Listener global `data-track-*`
Click + submit + IO + media events delegation.

### TRK-026 — `consent.ts` (client)
Load/save, sync server, gtag consent update.

### TRK-027 — `<ConsentBanner>` composant
Layout sobre, 3 boutons, modal préférences.

### TRK-028 — `<DebugOverlay>` composant
Affichage events, surlignage composants instrumentés.

### TRK-029 — Type-safe `EventParams` map
Génération via reflection sur le catalogue.

### TRK-030 — Anti-redondance avancée
Règles par event (table dans [04-frontend.md §9](04-frontend.md)).

### TRK-031 — Queue offline (localStorage)
Replay au retour réseau, max 100 events stockés.

### TRK-032 — Visibilitychange + pagehide flush
sendBeacon avec fallback fetch keepalive.

### TRK-033 — Bundle budget
Script `scripts/check-bundle-size.ts`. Fail si > 8 KB gzip.

### TRK-034 — Mount dans `app/layout.tsx`
Wrap children dans `<TrackingProvider>`.

### TRK-035 — Tests unit Phase 2
≥ 30 tests. Coverage ≥ 90 % `src/lib/tracking/client/**`.

---

## Phase 3 — API ingestion + persist (TRK-036 → TRK-050)

### TRK-036 — Route `POST /api/track`
Squelette : zod validate, rate-limit, 202.

### TRK-037 — Validator runtime
`getValidator(eventName)` avec cache LRU.

### TRK-038 — Enricher
IP anonym, UA hash, geo CF header, device parsing.

### TRK-039 — Dedup serveur
LRU 50k × 60 s.

### TRK-040 — Persistence events-log
INSERT … ON CONFLICT DO NOTHING.

### TRK-041 — Audit log mutations admin
Helper `auditTrackingChange(action, payload)`.

### TRK-042 — Route `POST /api/track/consent`
Snapshot consent.

### TRK-043 — Cron purge
`/api/cron/tracking-purge` + Vercel cron config.

### TRK-044 — Logger namespace `tracking.*`
Niveaux info/warn/error standardisés.

### TRK-045 — Rate-limit ingest
60 req/min/IP, dédié à `/api/track`.

### TRK-046 — Test handler MSW providers
Setup pour intégration tests.

### TRK-047 — Tests intégration `/api/track`
≥ 15 tests. Couverture cas valid/invalid/dedup/rate-limit/consent.

### TRK-048 — Tests intégration consent
3+ tests.

### TRK-049 — Métriques (logger structuré)
Compte events ingérés, dédupliqués, en erreur.

### TRK-050 — Doc Swagger/OpenAPI minimaliste
Fichier `docs/tracking/api.openapi.yaml` (optionnel).

---

## Phase 4 — Providers Meta + Google + TikTok (TRK-051 → TRK-067)

### TRK-051 — Interface `ProviderAdapter`
`src/lib/tracking/providers/types.ts`.

### TRK-052 — Registry providers
Lookup par kind, helpers `enabledProviders()`, etc.

### TRK-053 — Mapping events table
`event-mapping.ts` complet pour 5 providers.

### TRK-054 — Adapter Meta : map + buildClient
Pixel snippet + fbq wrapper.

### TRK-055 — Adapter Meta : CAPI dispatch
POST graph.facebook.com avec retry exponentiel (3 tries).

### TRK-056 — Adapter Meta : hashing user data
SHA-256 lowercase trim. Tests fixtures officiels Meta.

### TRK-057 — Adapter Google : gtag client init
Consent default denied, config GA4 + Ads.

### TRK-058 — Adapter Google : gtag client track
Mapping native, conversion labels.

### TRK-059 — Adapter Google : MP server
POST /mp/collect, payload + consent block.

### TRK-060 — Adapter TikTok : pixel client
ttq init + track.

### TRK-061 — Adapter TikTok : Events API server
POST business-api.tiktok.com.

### TRK-062 — Dispatcher (server)
`Promise.allSettled` parallèle sur enabled providers.

### TRK-063 — Pixel loader (client)
Charge dynamiquement pixels après consent + idle.

### TRK-064 — CSP middleware update
Whitelist hosts pixels + endpoints CAPI.

### TRK-065 — Chiffrement tokens CAPI
AES-256-GCM, réutilise `webhooks/secrets.ts`.

### TRK-066 — Test events (TestEventCode)
Wired dans payload Meta + TikTok.

### TRK-067 — Tests Phase 4
≥ 25 tests, MSW handlers réalistes.

---

## Phase 5 — Providers Snap + Pinterest + GTM + Custom (TRK-068 → TRK-076)

### TRK-068 — Adapter Snap : pixel
snaptr init/track.

### TRK-069 — Adapter Snap : CAPI
OAuth2 token refresh logic.

### TRK-070 — Adapter Pinterest : pixel
pintrk + line_items mapping.

### TRK-071 — Adapter Pinterest : CAPI
POST api.pinterest.com.

### TRK-072 — Adapter GTM : injection
`<Script>` avec gtm.js, dataLayer alias.

### TRK-073 — Adapter Custom : sandbox HTML
Validation regex stricte, CSP nonce.

### TRK-074 — Audit injection custom code
Log + rate-limit modifications.

### TRK-075 — CSP update Snap + Pinterest
Whitelist domains.

### TRK-076 — Tests Phase 5
≥ 15 tests.

---

## Phase 6 — Console admin (TRK-077 → TRK-090)

### TRK-077 — `<TrackingShell>` + nav
Layout avec sidebar, breadcrumbs, sub-nav.

### TRK-078 — Page dashboard
KPI tiles + sparklines + activity feed.

### TRK-079 — API admin : `inventory`
GET diff + manifest current.

### TRK-080 — Page inventory (TreeView)
Tree virtualisé, filtres, recherche, drag-drop.

### TRK-081 — API admin : pages CRUD
GET, PATCH (enabled, metadata).

### TRK-082 — API admin : components CRUD
GET, PATCH (enabled, defaultParams), delete (soft).

### TRK-083 — Drawer detail composant
Form events configurés, override params, providers select.

### TRK-084 — API admin : component-events CRUD
Toggle event×composant, override.

### TRK-085 — Page event catalogue
Lecture seule, modal détail event.

### TRK-086 — Page providers
Cartes empilées, modal édit.

### TRK-087 — API admin : providers CRUD
GET, PATCH (config, enable/disable, test).

### TRK-088 — Page test
Form event + providers, mode dry-run/real, résultats temps réel.

### TRK-089 — Page logs (timeline)
Polling 5s ou SSE, filtres, drawer detail.

### TRK-090 — Page settings
Texte consent, env, alias, debug global.

---

## Phase 7 — Polish + tests + go-live (TRK-091 → TRK-098)

### TRK-091 — Instrumenter le funnel commerce
View_item, add_to_cart, begin_checkout, add_shipping_info,
add_payment_info, purchase. Tous les composants P0 du funnel.

### TRK-092 — Instrumenter les engagements P1
Scroll depth, video progress, fg_journal_read_75, view_promotion.

### TRK-093 — Instrumenter les leads
Newsletter, contact form, sign_up éventuel.

### TRK-094 — Tests E2E Playwright
12 scénarios listés [09-tests.md §5](09-tests.md).

### TRK-095 — A11y audit complet
jest-axe sur toutes les pages admin tracking + Playwright manuel.

### TRK-096 — Performance audit
Lighthouse, bundle analyze, LCP delta < 50 ms.

### TRK-097 — Doc fondatrice
`docs/admin/tracking-quickstart.md` : "Configurer ton premier
pixel" + "Lire le tableau de bord" + glossaire métier.

### TRK-098 — Runbook + go-live
Voir [11-runbook.md](11-runbook.md). Validation interne, Meta CAPI
match rate vérifié sur 7 j de données.

---

## Critères de complétion par phase

| Phase | DoD |
|---|---|
| 1 | Migrations OK + scanner produit JSON valide + seed idempotent. |
| 2 | DataLayer + emit + dedup fonctionnels en dev local (devtools). |
| 3 | `/api/track` accepte/persistance/dedup/rate-limit OK + cron purge. |
| 4 | Meta + Google + TikTok dispatch OK contre stubs MSW + dedup match > 90 % en test. |
| 5 | Snap + Pinterest + GTM + custom OK + CSP cohérente. |
| 6 | Console fonctionnelle bout-en-bout (config + test + logs visibles). |
| 7 | E2E vert, doc lue par fondatrice, prod stable 7 jours. |

## Dépendances (graph)

```
Phase 1 → Phase 2
Phase 2 → Phase 3
Phase 3 → Phase 4 → Phase 5
Phase 3 → Phase 6 (peut commencer en parallèle après TRK-040)
Phase 6 → Phase 7
Phase 4–5 → Phase 7 (instrumentation a besoin des providers)
```

## Tickets connexes (hors scope strict)

- `OPS-XXX` : observabilité Sentry pour erreurs tracking
  (scope ops).
- `LEGAL-XXX` : revue RGPD du banner consent + DPA Meta/TikTok
  (scope juridique).
- `MKT-XXX` : configuration Meta Business + TikTok Business + GA4
  property + pixels IDs (scope marketing, prérequis pour go-live).

## Risques d'estimation

- Phase 6 (console admin) peut déraper si on cherche la perfection
  visuelle Phase 1. Limiter au scope défini, polish en Phase 7.
- Phase 4 dépend des prérequis MKT (avoir un pixel ID pour tester en
  vrai). Mitigé par les test event codes / Test Events Manager.
- Phase 7 a un budget perfs serré : si LCP régresse, on déplace les
  pixels en defer + interaction-load (pas de blocage perçu).

## Quick wins potentiels (prioriser si pression go-live)

Si le go-live commerce arrive vite, prioriser :

- TRK-001 → TRK-015 (data foundation)
- TRK-016 → TRK-022 (datalayer minimal)
- TRK-036 → TRK-040 (ingestion minimal)
- TRK-051 → TRK-061 (Meta + Google + TikTok seulement)
- TRK-091 (instrumenter funnel commerce uniquement)

= MVP commerce-ready en ~3 semaines, sans la console admin.
La console arrive en Phase 6.
