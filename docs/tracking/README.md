# Système de tracking d'événements FemiGlow — Spécification

Spécification complète d'un module **Tracking & Analytics Console**
intégré à l'application FemiGlow (Next.js 14, App Router) qui couvre :

- **inventaire** complet des pages et composants du site, catégorisés
  par type d'interaction,
- **catalogue d'événements** aligné sur la nomenclature
  [data.ga4spy.com](https://data.ga4spy.com/ga4-events-parameters)
  (GA4) avec extensions e-commerce et engagement,
- **mappings** vers les pixels publicitaires (Meta, TikTok, Google
  Ads, Snap, Pinterest) avec déduplication CAPI/server-side,
- **datalayer** structuré (`window.femiglowDataLayer`) avec
  schéma typé, anti-redondance, queue, replay,
- **console admin** `/admin/tracking` permettant d'activer/désactiver
  le tracking par page et par composant, sélectionner les événements,
  configurer les pixels (ID ou code custom), tester en live,
- **visualisation** arborescente (page → composants → events) et
  timeline temps réel des événements,
- **consentement** RGPD intégré (Consent Mode v2 Google + équivalents
  Meta `Limited Data Use` / TikTok `Limited Data Use`),
- **UI** moderne, dense, ergonomique, conforme à la charte FemiGlow
  (tons stone, typographie sereine).

Le module se branche sur l'infrastructure existante (Neon/Postgres,
Drizzle, iron-session, Vercel) et réutilise les conventions du module
admin (audit, rate-limit, CSP nonce, secrets chiffrés).

## Sommaire

| # | Document | Contenu |
|---|---|---|
| 00 | [Cahier des charges](00-cahier-des-charges.md) | Exigences fonctionnelles, non-fonctionnelles, KPIs, RGPD, scope |
| 01 | [Architecture](01-architecture.md) | Vue d'ensemble, flux, séquence event, providers, datalayer central |
| 02 | [Couche data](02-data.md) | Schéma Drizzle (`tracking_*`), migrations, indexes, retention |
| 03 | [Backend](03-backend.md) | Routes API admin + ingestion, services, dispatcher providers, audit |
| 04 | [Frontend](04-frontend.md) | DataLayer, `<TrackingProvider>`, `useTracking()`, `data-track-*`, dedup |
| 05 | [UI/UX & design](05-ui-ux-design.md) | Console admin, tokens, patterns, composants, états, micro-interactions |
| 06 | [Inventaire des composants](06-inventaire-composants.md) | Liste exhaustive composants × catégories × événements applicables |
| 07 | [Catalogue d'événements](07-events-catalog.md) | Référentiel GA4 + extensions, paramètres, items, conversions |
| 08 | [Providers & pixels publicitaires](08-providers-pixels.md) | Meta, TikTok, Google Ads, Snap, Pinterest, mapping & dedup |
| 09 | [Stratégie de tests](09-tests.md) | Vitest unit, MSW provider mocks, Playwright E2E, contract tests |
| 10 | [Plan d'action](10-plan-action.md) | Phases, tâches atomiques (`TRK-001` → `TRK-098`) |
| 11 | [Runbook](11-runbook.md) | Opérations courantes : ajout pixel, debug, audit consent, incidents |

## Conventions transverses

- **Préfixe d'ID Postgres** : `tk_` (config tracking), `te_` (event log),
  `tc_` (component config), `tp_` (page config), `tpr_` (provider),
  `tcs_` (consent snapshot).
- **Préfixe API** :
  - `/api/admin/tracking/*` (admin, authentifié)
  - `/api/track` (ingestion publique, sans auth, rate-limité)
  - `/api/track/test` (mode test admin, dry-run)
- **Nommage events** : `snake_case` GA4 (`view_item`, `add_to_cart`).
  Custom events FemiGlow préfixés `fg_` (`fg_journal_read_75`).
- **Voix** : interfaces et messages en **français**, ton FemiGlow
  (tutoiement, accessible, vocabulaire métier marketing simple).
- **Sécurité** : pixels chargés via `<Script>` Next.js avec nonce CSP.
  Pas d'`unsafe-inline`. Code custom admin sandboxé (pas d'eval).
- **Consentement** : aucun pixel, aucun event ne part avant
  `consent.granted`. Stockage local (cookieless) toléré pour les events
  internes (analytics first-party).

## Préfixe de tickets : `TRK-XXX`

98 tâches atomiques réparties en 7 phases (voir
[10-plan-action.md](10-plan-action.md)).

## État du document

- Version : 1.0
- Date : 2026-05-03
- Auteur : équipe FemiGlow
- Statut : à valider avant kick-off implémentation
