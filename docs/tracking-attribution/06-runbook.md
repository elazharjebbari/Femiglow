# 6. Runbook — exécution phase 1

## Pré-requis

- Système de tracking actuel fonctionnel (✅ déjà en place)
- `event-mapping.ts` enrichi avec catégories Ads (✅ déjà en place)
- Exporter GTM consommant le mapping (✅ déjà en place)

## Ordre d'exécution

### Étape 1 — Données & types (≈45 min)

1. Migration Drizzle : table `visitor_attribution`
   - Fichier : `apps/web/migrations/00XX_visitor_attribution.sql`
   - Schéma TS dans `apps/web/src/lib/db/schema-tracking.ts`
2. Types Zod dans `apps/web/src/lib/tracking/attribution/types.ts`
   - `ChannelTouch`, `AttributionChannel`, `AttributionStrategy`,
     `AttributionSnapshot`, `AttributedChannel`
3. Setting clé `attribution.strategy` ajouté à `tracking_settings`
   (réutilise infra existante `getTrackingSetting` / `setTrackingSetting`)

### Étape 2 — Moteur (≈1h)

4. `lib/tracking/attribution/channel-detector.ts`
   - Fonction `detectChannel({ url, referrer }): ChannelTouch`
   - Tableau de règles ordonnées (cf. `04-data-and-engine.md`)
5. `lib/tracking/attribution/strategy.ts`
   - Fonction `applyStrategy(snapshot, strategy): AttributedChannel`
   - 5 stratégies implémentées
6. `lib/tracking/attribution/repository.ts`
   - `findAttributionByVisitor(visitorId): AttributionSnapshot | null`
   - `upsertAttribution(visitorId, touch): AttributionSnapshot`
   - Logique LRU sur `paid_history` (max 20)

### Étape 3 — Bridges client + serveur (≈1h)

7. `app/api/track/attribution/route.ts`
   - POST `{ visitor_id, touch }` → upsert
   - Auth : aucune (visitor-facing, rate-limited par IP)
8. `components/tracking/AttributionCaptureBridge.tsx`
   - Client component monté dans `TrackingProvider`
   - Sur mount : parse URL + referrer → detectChannel → POST API +
     écriture cookie `fg_attr`
9. `lib/tracking/client.ts` : extension de `emit()`
   - Lit le cookie `fg_attr`
   - Applique stratégie (depuis ENV ou injectée via context)
   - Annote `entry.attribution = { channel, click_id, ... }`

### Étape 4 — Exporter GTM (≈45 min)

10. `lib/tracking/plan/exporter.ts` :
    - Ajout des 4 DLV : `attribution.channel`, `attribution.click_id`,
      `attribution.is_paid`, `attribution.strategy`
    - Pour chaque tag de conversion (Meta event, Ads awct, TikTok…) :
      ajout d'un trigger ou condition basée sur `attribution.channel`
    - Events d'audience (cf. `event-mapping.ts → isStandard` audience-side ou
      catalog `isConversion=false`) : pas de condition

### Étape 5 — Admin UI (≈1h30)

11. `app/admin/tracking/attribution/page.tsx` + composants :
    - Onglet ajouté à `TrackingShell` (tab key `attribution`)
    - `StrategySelector.tsx` : radio buttons
    - `AttributionDebugger.tsx` : input + display snapshot
    - `EventPolicyTable.tsx` : lecture seule v1
12. Server actions :
    - `getAttributionStrategy() / setAttributionStrategy()`
    - `inspectVisitorAttribution(visitorId)`

### Étape 6 — Tests (≈45 min)

13. Tests unitaires :
    - `channel-detector.test.ts` : 12 scénarios (gclid, fbclid, utm,
      referrer, fallback)
    - `strategy.test.ts` : 5 stratégies × N cas
    - `repository.test.ts` : LRU + dedup
14. Tests intégration :
    - POST `/api/track/attribution` upsert
    - GET inspect renvoie le bon snapshot
15. Test E2E Playwright :
    - Visite `?gclid=test_click_1` → vérifier cookie + DB row
    - Visite simple → vérifier `direct` dans cookie
    - Conversion → vérifier `dataLayer.purchase[0].attribution.channel`

### Étape 7 — Build + rollout (≈20 min)

16. `pnpm build`
17. `systemctl restart femiglow.service`
18. Test sur prod : visiter `https://femiglow-maroc.com/?gclid=test_run_X`
    et vérifier `dataLayer`
19. Re-exporter le plan GTM, ré-importer dans GTM
20. Tag Assistant : valider qu'un visiteur "google_ads" ne fire pas
    Meta/TikTok pour `purchase`

## Total estimé

≈ 6 heures pour la phase 1 complète.

## Critères d'acceptation

- ✅ Un visiteur arrivant avec `?gclid=X` voit `attribution.channel === 'google_ads'` dans tous ses dataLayer.push
- ✅ Le tag `Ads Conv — purchase` fire pour ce visiteur ; pas le tag `Meta Evt — purchase (Purchase)`
- ✅ Un visiteur arrivant en direct (sans gclid/fbclid…) voit `attribution.channel === 'direct'`
- ✅ Les tags Ads, Meta, TikTok fire tous pour ce visiteur (fallback broadcast partiel)
- ✅ Un visiteur ayant cliqué Meta jour 1 puis revenu direct jour 5 voit `attribution.channel === 'meta'` (last_paid_touch retrouve fbclid en historique)
- ✅ Changement de stratégie dans l'admin → effet sur les prochaines pushes (pas de cache)
- ✅ Debugger affiche correctement le snapshot pour un `visitor_id` donné

## Phases ultérieures (hors scope phase 1)

### Phase 2 — Meta CAPI selectif (+2h)

- `lib/mail/...meta CAPI dispatcher` : appliquer la stratégie avant l'appel
- Si `attribution.channel !== 'meta'` ET stratégie stricte → skip CAPI
- Conserve event_id pour dedup avec pixel client (au cas où ITP)

### Phase 3 — Google Ads Offline Conversion Import (+8h)

- Server cron quotidien upload des conversions où `attribution.channel === 'google_ads'`
- Match via `gclid` stocké dans `visitor_attribution.last_touch.click_id`
- Format CSV upload via Google Ads API v18

### Phase 4 — TikTok Events API server-side (+6h)

- Pareil que Meta CAPI mais pour TikTok
- Endpoint `https://business-api.tiktok.com/open_api/v1.3/event/track/`

### Phase 5 — Snap/Pinterest Conversions API (+6h)

- Pattern identique
- Snap: `https://tr.snapchat.com/v2/conversion`
- Pinterest: `https://api.pinterest.com/v5/ad_accounts/...events`

### Phase 6 — Data-driven attribution (futur lointain)

- ML model sur l'historique des touches
- Crédite des % aux différents canaux (pas binaire)
- Réservé aux comptes avec >500 conversions/mois
