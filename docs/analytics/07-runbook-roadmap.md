# 07 — Roadmap & Runbook prod

> Plan d'exécution **M0 → M6** pour livrer l'admin analytics par phases livrables, sans bloquer le reste du produit. Runbook ops pour exploitation quotidienne et procédures d'incident.

## §1 — Séquencement des phases

> Chaque phase est une PR autonome qui **doit** : (i) typecheck clean, (ii) tests pass, (iii) déployable seule. Pas d'opt-in feature flag — chaque livraison apporte une valeur tangible.

### M0 — Préparation (1 sprint)

**Objectif** : poser l'infrastructure data sans toucher l'UI publique.

- Migration `0050` : ajout colonnes `traffic_source`, `traffic_medium`, `experiment_id` sur `tracking_events_log`.
- Migration `0051` : ajout `funnel_stage` sur `tracking_event_definitions` + UPDATEs seed.
- Migration `0052` à `0055` : 4 vues matérialisées + index.
- Migration `0056` : 3 tables A/B (vides, prêtes pour V2).
- Cron `vercel.json` : `mv_overview_hourly` toutes les 15 min, `mv_funnel_daily` toutes les heures.
- `lib/analytics/attribution.ts` : `classifyTraffic()` + tests unitaires.
- Backfill : script `scripts/backfill-traffic-source.ts` qui parse `payload.referrer` + UTM des events historiques.
- Monitoring : Sentry alert si matview lag > 30 min.

**Livrable** : nouvelle data dispo en DB, 0 changement UI utilisateur. Backfill complet.

**Acceptance** :
- [ ] `SELECT COUNT(*) FROM tracking_events_log WHERE traffic_source IS NULL` = 0 sur les 90 derniers jours.
- [ ] Vue `mv_overview_hourly` contient toutes les données depuis le backfill.
- [ ] Cron tournée 5 fois sans échec.
- [ ] Tests unit `attribution.test.ts` : 12+ cas pass.

### M1 — Vue d'ensemble (2 sprints)

**Objectif** : livrer l'onglet `/admin/analytics` minimal mais fonctionnel.

- Primitives partagées : `<AnalyticsTabs>`, `<FilterBar>`, `<KpiCard>`, `<ChartFrame>`, `<DataTable>`, `<EmptyState>`, `<ErrorState>`, `<Skeleton>`, `<ExportCsvButton>`.
- Hooks : `useAnalyticsFilters` (URL + localStorage).
- Endpoint : `GET /api/admin/analytics/overview` + Zod parse.
- Layout `/admin/analytics/layout.tsx` (Tabs + FilterBar).
- Page `/admin/analytics/page.tsx` (RSC) : 6 KPI + 4 panneaux.
- Tests : 50+ tests Vitest (composants + queries) + 4 scénarios Playwright.
- Doc utilisateur courte dans `/admin/analytics` (tooltip "?" sur chaque KPI expliquant le calcul).

**Livrable** : admin peut consulter sessions, CR, AOV, top sources, top pages, sur Today / 7j / 30j / 90j / Tout / Custom × Mobile/Tablet/Desktop × tout traffic.

**Acceptance** :
- [ ] Page LCP < 1.5 s sur staging.
- [ ] Filtres Mobile/Today/All par défaut au premier chargement.
- [ ] Persistance localStorage vérifiée (close/reopen).
- [ ] Export CSV produit un fichier valide ouvert dans Excel FR.
- [ ] Tests E2E passent (4 scénarios).

### M2 — Audit événements + robustesse (1 sprint)

**Objectif** : fiabiliser l'instrumentation existante. Pré-requis aux onglets suivants.

- Catalogue : ajout `video_user_play`, `video_autoplay_view`, `form_field_focus`, `form_field_blur`, `form_validation_error`, `form_abandon`, `cta_impression`, `mini_cart_open`, `mini_cart_close`.
- Refactor `VideoPlayer4Gestes` : `userInitiatedRef` distingue play autoplay vs user.
- Création `useFormTracking()` hook + intégration sur tous les forms publics.
- Idempotence : audit + correctif sur `MerciClient`, `ScrollDepthTracker`, `AddToCartButton`, `ViewItemTracker`.
- Script CI `scripts/check-event-emit-patterns.ts` qui bloque le merge sur patterns à risque.
- Tests : 30+ tests Vitest pour les composants instrumentés.

**Livrable** : 0 event "fantôme" en staging pendant 24 h après déploiement. Audit complet `tracking_event_definitions.funnel_stage` rempli.

**Acceptance** :
- [ ] Aucun `video_start` émis sans interaction utilisateur (vérifié via test E2E `video-autoplay-no-engagement`).
- [ ] Form abandon sur navigation départ détecté (`pagehide`).
- [ ] Lint `check-event-emit-patterns.ts` retourne 0.
- [ ] 0 régression dans les KPI Vue d'ensemble.

### M3 — Live (2 sprints)

**Objectif** : SSE + onglet live opérationnel.

- Endpoint SSE `/api/admin/analytics/live/stream` (runtime Node, abort handling).
- Endpoint polling fallback `GET /api/admin/analytics/live`.
- Hook `useAnalyticsSSE` (reconnect exponentiel, fallback).
- Composants Live : `<LiveKpiBig>`, `<LiveByPage>`, `<LiveBySource>`, `<LiveByDevice>`, `<LiveEventStream>`, `<LiveFunnel>`.
- Page `/admin/analytics/live/page.tsx`.
- Tests : MSW SSE + 3 scénarios Playwright (golden, pause, abort).

**Livrable** : monitoring temps réel < 800 ms first paint. SSE multiplexé via BroadcastChannel.

**Acceptance** :
- [ ] SSE soutient 5 admins concurrents pendant 1 h sans fuite mémoire.
- [ ] Reconnexion auto observée après abort.
- [ ] Pause arrête bien le stream client (vérifié E2E).
- [ ] Funnel live cohérent avec funnel non-live sur même fenêtre.

### M4 — Funnel (1 sprint)

**Objectif** : onglet Funnel avec drill-down pages.

- Endpoint `/api/admin/analytics/funnel` + `/sankey`.
- Composants : `<FunnelGlobal>`, `<FunnelDropOff>`, `<FunnelByPageSankey>`, `<FunnelDataTable>`.
- Page `/admin/analytics/funnel/page.tsx`.
- Tests : queries SQL + 2 scénarios Playwright.

**Livrable** : admin peut identifier le step de plus gros décrochage et voir quelle page d'entrée convertit.

**Acceptance** :
- [ ] Sankey lisible jusqu'à 20 pages d'entrée distinctes.
- [ ] Funnel drop-off cohérent avec Vue d'ensemble (sessions = même nombre).
- [ ] Filtres period/device/traffic propagés.

### M5 — CTA (1 sprint)

**Objectif** : onglet CTA + attribution 7j.

- Endpoint `/api/admin/analytics/cta`.
- Composants : `<CtaKpiGrid>`, `<CtaTable>`, `<CtaTopMessages>`, `<CtaTopPages>`.
- Page `/admin/analytics/cta/page.tsx`.
- Refresh `mv_cta_performance` toutes les heures.
- Tests.

**Livrable** : admin sait quel CTA et quel message convertit, segmentable.

**Acceptance** :
- [ ] Attribution 7j calculée correctement (test integration avec scénario "achat 5j après clic").
- [ ] Component supprimé ne crashe pas le tableau.
- [ ] Top messages affichés avec label exact (pas l'ID).

### M6 — Checkout (1 sprint)

**Objectif** : onglet Checkout + webhook purchase fallback.

- Endpoint `/api/admin/analytics/checkout`.
- Composants : `<CheckoutKpiGrid>`, `<CheckoutFunnel>`, `<CheckoutFormErrors>`, `<CheckoutTimeToSubmit>`.
- Page `/admin/analytics/checkout/page.tsx`.
- Webhook Stripe → `purchase_server` event si client n'a pas envoyé `purchase`.
- Refresh `mv_checkout_steps` toutes les heures.
- Tests.

**Livrable** : admin voit erreurs forms, time-to-submit, abandons par champ.

**Acceptance** :
- [ ] Histogram P25/P50/P75/P95 cohérent.
- [ ] Webhook fallback se déclenche si `purchase` client manquant (test E2E avec flag `block_purchase_event`).
- [ ] Outliers > 30 min plafonnés.

### V2 — A/B testing (post-launch, hors scope V1)

- UI `/admin/experiments` : créer / pausse / conclure une expérience.
- Variant assignment client (cookie + serveur fallback).
- Reporting natif dans chaque onglet (toggle "voir par variant").
- Stat sig (Frequentist + Bayesian).

> Les tables `experiments`, `experiment_variants`, `experiment_assignments` étant déjà en place dès M0, la V2 = pure feature UI + assignment lib.

## §2 — Effort estimé

| Phase | Story points | Sprints (1 dev) | Dépendances |
|---|---|---|---|
| M0 | 13 | 1 | — |
| M1 | 21 | 2 | M0 |
| M2 | 13 | 1 | M0 (peut paralléliser M1) |
| M3 | 21 | 2 | M1, M2 |
| M4 | 8 | 1 | M1, M2 |
| M5 | 8 | 1 | M1, M2 |
| M6 | 13 | 1 | M1, M2 |
| **Total** | **97 SP** | **~9 sprints** | |

> Avec 2 devs en parallèle (M1+M2 puis M3 + (M4||M5||M6)) : ~5–6 sprints.

## §3 — Pré-requis avant chaque phase

| Phase | Avant de commencer |
|---|---|
| M0 | DB staging accessible, scripts migrations testés en local, accès Sentry |
| M1 | M0 mergé sur main, backfill complet vérifié |
| M2 | Audit checklist `03-events-funnel-audit.md` §6 lue, tests E2E vidéo prêts |
| M3 | M1 et M2 mergés, runtime Node activé sur Vercel pour SSE |
| M4 | M2 mergé (funnel_stage rempli), `mv_funnel_daily` rafraîchie au moins 1× |
| M5 | M2 mergé, `mv_cta_performance` rafraîchie |
| M6 | Webhook Stripe staging fonctionnel, signature vérifiée |

## §4 — Runbook prod

### 4.1 Health check journalier (script automatisé)

```sh
# scripts/analytics-healthcheck.ts
# Cron quotidien 8h via vercel.json
```

Vérifications :
1. **Matview lag** : `SELECT MAX(now() - bucket) FROM mv_overview_hourly` < 30 min.
2. **Volume events** : `SELECT COUNT(*) FROM tracking_events_log WHERE received_at > now() - interval '1 day'` > 0.
3. **Ratio consent** : `SELECT COUNT(*) FILTER (WHERE consent_snapshot->>'analytics_storage' = 'granted') / COUNT(*)` ≥ 0.30.
4. **Erreurs ingest** : Sentry tag `tracking.ingest` = 0 erreur 5xx sur 24 h.
5. **Performance API** : moyenne `/api/admin/analytics/overview` < 500 ms.

Si KO → Slack `#femiglow-analytics-alerts`.

### 4.2 Procédure rafraîchissement matview manuel

```sql
-- Si vue stale (cron failed)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_hourly;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cta_performance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_checkout_steps;
```

> CONCURRENTLY = ne bloque pas les SELECTs en cours. Coût : x2 espace disque temporaire.

### 4.3 Procédure backfill events

```sh
# Si event taxonomy change ou backfill traffic_source
npm run scripts:backfill-traffic-source -- --from 2026-01-01 --to 2026-05-01
npm run scripts:refresh-funnel-stage   # met à jour funnel_stage post-migration
```

Toujours `dry-run` d'abord :

```sh
npm run scripts:backfill-traffic-source -- --dry-run
```

### 4.4 Procédure rollback

| Type | Procédure |
|---|---|
| **Bug page admin** | Revert PR sur Vercel ; staging reste en place. |
| **Migration data corrompue** | `BEGIN; ALTER TABLE tracking_events_log DROP COLUMN xxx; COMMIT;` (additive only). Pas de rollback destructif. |
| **Matview en boucle d'échec** | `DROP MATERIALIZED VIEW xxx; CREATE MATERIALIZED VIEW xxx AS …;` puis recréer index. |
| **SSE saturé** | Couper côté Vercel : env `ANALYTICS_LIVE_DISABLED=true` → fallback polling 30s. |

### 4.5 Procédure incident "0 events"

Si `tracking_events_log` n'a plus d'inserts :

1. Vérifier `/api/track` répond 204 (curl).
2. Vérifier consent banner affiché (la base d'utilisateurs a peut-être tout rejeté).
3. Vérifier `TrackingClient` côté browser (console : `window.femiglowDataLayer.length`).
4. Vérifier Sentry tag `tracking.client.error`.
5. Vérifier rate limit (dépassement → 429 silencieux).

Si rate limit :

```ts
// lib/security/rateLimit.ts — augmenter temporairement
TRACK_RATE_LIMIT = { window: '1m', max: 60 }; // au lieu de 30
```

### 4.6 Procédure incident "matview lag"

Si lag > 1 h alerté :

1. `SELECT * FROM pg_stat_user_tables WHERE relname = 'mv_overview_hourly'` → vérifier stats d'écriture.
2. `SELECT pg_size_pretty(pg_total_relation_size('mv_overview_hourly'))` → si > 1 GB, vacuum nécessaire.
3. `VACUUM ANALYZE mv_overview_hourly` (en heures creuses).
4. Vérifier cron Vercel (`vercel cron ls`) que le job est actif.
5. Si query refresh > 5 min : créer matview pré-agrégée plus fine (ex `mv_overview_minute` partitionné).

### 4.7 Procédure incident "Sentry tracking errors"

Pattern courant : `payload too large`, `event_id collision`, `consent_snapshot missing`.

| Erreur | Cause | Fix |
|---|---|---|
| `payload too large` | Object > 8 KB sérialisé | Tronquer côté client dans `TrackingClient.emit()` |
| `event_id collision` | UUID dupliqué (très rare) | Idempotent insert : `ON CONFLICT (event_id) DO NOTHING` (déjà en place) |
| `consent_snapshot missing` | `TrackingClient` lit consent avant init | Guard `if (!consent) return queueEvent()` |

## §5 — Troubleshooting onglet par onglet

### 5.1 Vue d'ensemble

| Symptôme | Cause possible | Vérif |
|---|---|---|
| Sessions = 0 | Matview pas rafraîchie OU consent rate effondré | `SELECT * FROM mv_overview_hourly LIMIT 5` |
| Delta absent | Période précédente vide | OK si nouveau site |
| Top pages vide | `page_view` events absents | Vérifier `TrackingClient.emit('page_view')` dans `app/(marketing)/template.tsx` |
| Bounce 100% | `session_duration_s` manquant | Vérifier `pagehide` listener émet `session_end` |

### 5.2 Live

| Symptôme | Cause possible | Vérif |
|---|---|---|
| 0 en ligne tout le temps | SSE pas atteint | Network tab : status 200 + content-type event-stream ? |
| Reconnexions infinies | Vercel timeout < polling | `runtime: 'nodejs'` + duration 60s ? |
| Stream lag > 5 s | Buffering | Forcer `Cache-Control: no-store` et `X-Accel-Buffering: no` |
| Funnel live = 0 | Pas d'events depuis 1 h | Normal si trafic faible (mode dev) |

### 5.3 Funnel

| Symptôme | Cause possible | Vérif |
|---|---|---|
| Step "Engage" = 0 | Events `scroll_depth_50` non émis | Vérifier `ScrollDepthTracker` mounted |
| Step suivant > step précédent | Bug data, sessions counted twice | Logger session_id dans payload pour debug |
| Sankey vide | `first_page` calcul échoué | Vérifier index par session_id ordonné `received_at` |

### 5.4 CTA

| Symptôme | Cause possible | Vérif |
|---|---|---|
| Tableau vide | `tracking_components` non synchronisé | Lancer `componentSyncService.syncAll()` |
| `purchases_after_click` toujours 0 | Fenêtre 7j trop courte ou attribution cassée | Vérifier `anonymous_id` cohérent entre sessions |
| Top messages = label vide | `c.label` non rempli | Migration `0040_components_labels` exécutée ? |

### 5.5 Checkout

| Symptôme | Cause possible | Vérif |
|---|---|---|
| Time-to-submit médiane bizarre (< 1 s) | Bots non filtrés | Ajouter filtre `EXCLUDE bot user_agents` dans query |
| Form errors vide | `form_validation_error` non émis | Vérifier hook `useFormTracking` dans `<CheckoutForm>` |
| Webhook fallback non déclenché | Stripe webhook URL incorrect | `stripe webhook list` + check signature |

## §6 — Observabilité

### 6.1 Métriques à monitorer

| Métrique | Source | Seuil alerte |
|---|---|---|
| `analytics.ingest.rate` (events/min) | Custom metric Vercel | < 50 % moyenne 7j → warn |
| `analytics.api.duration.p95` | Vercel Analytics | > 1 s → warn |
| `analytics.matview.lag.minutes` | Cron healthcheck | > 30 min → critical |
| `analytics.sse.active_connections` | SSE endpoint counter | > 50 → warn (dimension capacity) |
| `analytics.consent.rate` | Custom query | < 25 % → warn (RGPD UX issue) |

### 6.2 Logs structurés

Tous les endpoints `/api/admin/analytics/*` loggent :

```ts
{
  level: 'info',
  msg: 'analytics.api.request',
  endpoint: '/overview',
  duration_ms: 234,
  cache_hit: false,
  filters: { period: '7d', device: 'mobile', traffic: 'all' },
  rows_returned: 168,
  admin_id: 'usr_xxx',
}
```

Recherche Loki / Datadog : `{endpoint="/overview"} | json | duration_ms > 500`.

### 6.3 Dashboard ops (Grafana ou équivalent)

Panneaux suggérés (hors scope V1, V2) :
- Volume events ingérés / heure.
- Latence P50/P95/P99 par endpoint.
- Matview lag par vue.
- Erreurs ingest groupées par tag.
- Consent rate global et par device.

## §7 — Sécurité

### 7.1 Audit trail admin

Tous les accès `/admin/analytics/*` sont loggés via `auditLog()` (existant) avec :
- `actor_id`, `actor_email`
- `endpoint` ou `page`
- `filters` appliqués
- `timestamp`

Conservation 12 mois pour conformité RGPD (DPO peut demander preuve d'accès).

### 7.2 RGPD compliance

- **Données utilisateur** : aucune PII dans `tracking_events_log` (anonymous_id only). Email/nom n'apparaissent que via `user_id` (FK soft) si user authentifié.
- **Droit à l'oubli** : script `scripts/erase-user-tracking.ts --user-id xxx` purge events + agrégats matview au prochain refresh.
- **Export utilisateur** : endpoint `/api/account/export` retourne tous les events liés (existant, à étendre).
- **Consent** : matviews filtrent `consent_snapshot.analytics_storage = 'granted'`. Les events `denied` restent en DB pour audit mais n'apparaissent jamais dans les KPI.

### 7.3 Auth admin

`requireAdmin()` (existant) check :
- Session valide (NextAuth JWT)
- Rôle `admin` dans `users.role`
- 2FA activée (recommandé V2)

Throttling : 30 requêtes / minute par admin sur `/api/admin/analytics/*` (pour éviter scrape accidentel ou abus).

## §8 — Performance & coûts

### 8.1 Estimation volumétrie

| Trafic mensuel | Events / mois | DB storage / mois | Matview storage |
|---|---|---|---|
| 10 K sessions | 1 M events | ~500 MB | ~50 MB |
| 100 K sessions | 10 M events | ~5 GB | ~500 MB |
| 1 M sessions | 100 M events | ~50 GB | ~5 GB |

> Au-delà de 1 M sessions/mois → partitionner `tracking_events_log` par mois (PG `PARTITION BY RANGE`).

### 8.2 Rétention

| Donnée | Durée | Justification |
|---|---|---|
| `tracking_events_log` raw | 13 mois | Comparaison année / année |
| Matviews | indéfini (rebuilt from raw) | Coût négligeable |
| Audit log admin | 12 mois | Conformité légale |
| `experiment_assignments` | 24 mois | Analyses post-mortem |

Cron mensuel `scripts/prune-tracking-events.ts` : `DELETE WHERE received_at < now() - interval '13 months'`.

### 8.3 Coûts Vercel + DB estimés (100 K sessions/mois)

| Item | Coût / mois | Notes |
|---|---|---|
| DB Postgres (Supabase Pro) | $25 | 8 GB inclus |
| Vercel Pro | $20 | inclus base + cron |
| Sentry events | $0 | tier free 5K errors/mois |
| **Total marginal analytics** | **~$0–10/mois** | sur infra existante |

> Pas de coût SaaS ajouté (vs. PostHog Cloud à $450/mo pour ce volume).

## §9 — Adoption & formation

### 9.1 Onboarding admin (post-livraison M1)

- Tutoriel intégré : tooltip "?" sur chaque KPI explicant le calcul + exemple.
- Glossaire intégré : page `/admin/analytics/glossaire` (markdown statique).
- 1 vidéo Loom de 5 min envoyée à l'équipe : "Ce que je peux apprendre en 30 secondes par jour".

### 9.2 Rituel hebdo (recommandé)

- Lundi 9h : revue Vue d'ensemble + Funnel = identifier 1 hypothèse d'optimisation pour la semaine.
- Vendredi 17h : revue CTA + Checkout = mesurer impact des changements de la semaine.

### 9.3 Sur-utilisation à éviter

- ❌ Re-rafraîchir compulsivement Live → distraction.
- ❌ Optimiser un KPI < 50 sessions → variance > signal.
- ❌ Comparer périodes à volumes très différents (saisonnalité).

## §10 — Open questions / dette consciente

| Sujet | Position V1 | Détaillé V2 |
|---|---|---|
| Dark mode | Non livré | À considérer si feedback admin |
| Multi-tenant (plusieurs marques) | Hors scope | Ajouter `tenant_id` partition |
| Cohortes (utilisateurs par mois d'acquisition) | Hors scope | Vue dédiée `/admin/analytics/cohorts` |
| Forecasting (prédiction CR sem prochaine) | Hors scope | ML basique post-V2 |
| Slack alerts custom (CR < x → notif) | Hors scope | Page settings alerts |
| Comparaisons avancées (segment vs segment) | Hors scope partial | A/B testing V2 couvre une partie |
| Export PDF rapport hebdo | Hors scope | Cron + react-pdf si demandé |
| Webhook tiers (Slack, Teams) | Hors scope | V3 si besoin |

## §11 — Définition de done global

Le projet analytics est **fini** quand :

- [ ] Les 5 onglets `/admin/analytics/*` sont accessibles, fonctionnels, performants.
- [ ] Tous les acceptance criteria de M0–M6 sont cochés.
- [ ] La couverture de tests est ≥ 85 % sur `lib/analytics/` et ≥ 80 % sur `components/admin/analytics/`.
- [ ] Le runbook (cette section §4) a été testé en pratique au moins 2 fois.
- [ ] L'équipe produit utilise effectivement le dashboard pendant 4 semaines consécutives (mesuré via `admin_analytics_tab_view`).
- [ ] Aucune erreur Sentry critique pendant 14 jours après le rollout final.
- [ ] Les schémas A/B existent en DB et sont prêts pour V2.
- [ ] La documentation (`docs/analytics/*.md`) est à jour avec les éventuelles déviations.

---

**Fin du dossier**. Les 7 fichiers (`README` + 6 modules) couvrent vision, data, events, UI, specs onglets, tests, runbook. À chaque PR, mettre à jour le module concerné en first commit (doc-first).
