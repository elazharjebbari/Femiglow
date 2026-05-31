# 01 — Audit baseline

## Symptôme

Sur `/admin/analytics`, **100% du trafic apparaît en `'direct'`** alors que :
- Campagnes Meta Ads actives (Pixel + CAPI configurés)
- Trafic Google Ads avec gclid
- Trafic organique Insta/TikTok
- Sessions UTM-taggées détectables côté Plausible

## 3 causes racines identifiées

### Cause #1 — `trafficSource` jamais écrit (95% confiance)

**Fichiers** :
- `apps/web/src/app/api/track/route.ts:221-244` — appelle `logEvent()` SANS `trafficSource`
- `apps/web/src/lib/db/queries/tracking/events-log.ts:74-128` — ne les expose pas non plus
- Le schéma DB les a (`schema.ts:824-825`) mais colonnes **systématiquement NULL**

**Impact** : 100% des events depuis le déploiement initial ont `traffic_source = NULL`.

**Conséquence cascade** : `overview.ts:377` retombe sur `classifyTraffic({ utm: payload, referrer: payload.referrer })` qui voit un payload vide → `'direct'`.

### Cause #2 — Mismatch taxonomie (80% confiance)

**Détecteur** émet : `google_ads | meta | tiktok | bing_ads | social_organic | organic`
**Reporting** utilise : `google | meta | bing | twitter | linkedin | youtube | other`

Aucune fonction de mapping entre les deux. Même après fix #1, l'UI afficherait "Autres" pour `google_ads`.

### Cause #3 — Payload sans UTM/referrer (75% confiance)

`TrackingClient.emit()` place le referrer dans `entry.page.referrer` (PAS dans `payload`), et **les UTM ne sont jamais parsés** depuis `window.location.search`. Le fallback `classifyTraffic` cherche `payload.utm_*` → vide → 'direct'.

## Trous de tests qui ont permis le bug

- ❌ Aucun test E2E `emit → /api/track → traffic_source ≠ NULL → /admin/analytics`
- ❌ `events-log.test.ts` n'asserte PAS que les colonnes attribution sont persistées
- ❌ `overview.test.ts` injecte `trafficSource` à la main dans ses fixtures → masque le bug en local

## Baseline SQL (à exécuter avant déploiement)

```sql
SELECT
  COUNT(*) FILTER (WHERE traffic_source IS NULL) * 100.0 / COUNT(*) AS pct_null,
  COUNT(DISTINCT traffic_source) AS unique_sources,
  COUNT(*) AS total_events_7d
FROM tracking_events_log
WHERE timestamp > NOW() - INTERVAL '7 days';
```

Attendu pre-fix : `pct_null ≈ 100`, `unique_sources = 1` (NULL).
Cible post-fix (J+7) : `pct_null < 5`, `unique_sources ≥ 4`.
