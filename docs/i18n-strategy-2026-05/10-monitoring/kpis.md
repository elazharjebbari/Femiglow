# KPIs i18n — Catalogue complet

> Catalogue de tous les KPIs i18n FemiGlow. Pour chaque KPI : formule, source data, fréquence, owner, alert thresholds.

## 1. TL;DR — KPIs nord-étoile (Top 5)

Si on ne devait suivre que 5 KPIs, ce sont ceux-là :

| # | KPI | Target V1 | Source | Cadence |
|---|---|---|---|---|
| 1 | **Coverage AR** (% clés traduites) | ≥ 90% | `i18n_translation_values` | Live |
| 2 | **Missing key rate** | < 0.1% des renders | Sentry + tracking_events_log | Live |
| 3 | **Adoption AR** (% sessions) | 15-25% à M+3 | GA4 + tracking_events_log | Daily |
| 4 | **LCP AR ≤ FR + 10%** | LCP AR < 2.75s si FR=2.5s | Vercel Analytics | 5 min |
| 5 | **Conversion AR / FR ratio** | ≥ 0.8 (AR conv ≥ 80% de FR conv) | GA4 ecommerce | Weekly |

→ Ces 5 KPIs apparaissent en première position du dashboard "i18n Health".

## 2. Catégories de KPIs

```
┌─────────────────────────────────────────────────────┐
│                  KPIs i18n FemiGlow                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. ADOPTION   ─→ Qui utilise quelle langue ?       │
│  2. COVERAGE   ─→ Combien traduit-on ?              │
│  3. QUALITY    ─→ Les traductions sont OK ?         │
│  4. PERFORMANCE─→ Le site reste rapide ?            │
│  5. UX         ─→ Le switcher fonctionne ?          │
│  6. SEO        ─→ Google nous voit en AR/EN ?       │
│  7. BUSINESS   ─→ AR/EN génèrent du CA ?            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 3. Adoption

### KPI 3.1 — % visites par locale

**Description** : part de marché interne entre fr / ar / en.

| Aspect | Détail |
|---|---|
| **Formule** | `SELECT locale, COUNT(*) / SUM(COUNT(*)) OVER () AS pct FROM sessions GROUP BY locale` |
| **Source** | `tracking_events_log` (event `page_view` avec dim `locale`) OU GA4 |
| **Granularité** | Daily, 7d, 30d |
| **Owner** | Founder |
| **Target V1** | FR=70%, AR=20%, EN=10% à M+3 |
| **Alert** | AR drop > -10pp vs week précédente → Slack |
| **Cadence collecte** | Live (event temps réel) |
| **Cadence revue** | Weekly (lundi 10h) |

#### Query SQL

```sql
SELECT
  payload->>'locale' AS locale,
  COUNT(DISTINCT session_id) AS sessions,
  ROUND(100.0 * COUNT(DISTINCT session_id) /
    SUM(COUNT(DISTINCT session_id)) OVER (), 1) AS pct
FROM tracking_events_log
WHERE event_name = 'page_view'
  AND occurred_at > NOW() - INTERVAL '7 days'
GROUP BY locale
ORDER BY sessions DESC;
```

#### Décision business associée

- Si AR > 30% → investir plus en traduction AR (cf. ouvrir variants AR copy)
- Si EN < 5% → considérer désactiver EN en V2
- Si fr-FR (France) > 20% → considérer hreflang FR-FR/FR-MA distinct

---

### KPI 3.2 — Nouveaux visiteurs par locale (acquisition)

**Description** : qui arrive de Google par quelle langue.

| Aspect | Détail |
|---|---|
| **Formule** | `COUNT(DISTINCT session_id) WHERE is_new AND source = 'organic'` |
| **Source** | GA4 (event `session_start` filter `first_visit`) |
| **Granularité** | Weekly |
| **Owner** | Marketing |
| **Target** | Croissance MoM > 10% sur AR, > 5% sur EN |
| **Alert** | Drop > -20% sur 1 locale → Slack #marketing |
| **Cadence** | Weekly |

---

### KPI 3.3 — Sessions par device × locale

**Description** : mobile vs desktop par langue.

| Aspect | Détail |
|---|---|
| **Formule** | `GROUP BY locale, device` |
| **Source** | GA4 OR tracking_events_log |
| **Granularité** | 7d, 30d |
| **Owner** | Tech lead (impact UX) |
| **Hypothèse** | AR très mobile (>85%) ; FR mobile (>75%) ; EN équilibré (60% mobile) |
| **Cadence** | Monthly |

→ Sert à prioriser optimisations RTL mobile (cf. `05-ui-ux-design/rtl-support.md`).

---

## 4. Coverage

### KPI 4.1 — % clés traduites par locale

**Description** : LE KPI principal pour piloter les efforts de traduction.

| Aspect | Détail |
|---|---|
| **Formule** | `translated_keys / total_active_keys * 100` |
| **Source** | DB : `i18n_translation_keys` + `i18n_translation_values` |
| **Granularité** | Live, par namespace |
| **Owner** | Tech lead + traducteur |
| **Target V1** | FR=100% (source), AR≥90%, EN≥90% |
| **Target V2** | AR=100%, EN=95%, ES=80% |
| **Alert** | AR < 85% pendant 7j → Slack tech lead |
| **Cadence collecte** | Live (UPDATE → recompute) |
| **Cadence revue** | Daily digest Slack 9h |

#### Query SQL

```sql
WITH key_total AS (
  SELECT COUNT(*) AS total
  FROM i18n_translation_keys
  WHERE is_active = true
)
SELECT
  l.code AS locale,
  COUNT(v.key) AS translated,
  k.total AS total_keys,
  ROUND(100.0 * COUNT(v.key) / k.total, 1) AS coverage_pct
FROM i18n_locales l
CROSS JOIN key_total k
LEFT JOIN i18n_translation_values v ON v.locale = l.code
LEFT JOIN i18n_translation_keys tk ON tk.key = v.key AND tk.is_active = true
WHERE l.enabled = true
GROUP BY l.code, k.total
ORDER BY l.sort_order;
```

#### Breakdown par namespace

```sql
SELECT
  k.namespace,
  v.locale,
  COUNT(v.key) AS translated,
  (SELECT COUNT(*) FROM i18n_translation_keys WHERE namespace = k.namespace AND is_active = true) AS total
FROM i18n_translation_keys k
LEFT JOIN i18n_translation_values v ON v.key = k.key
WHERE k.is_active = true
GROUP BY k.namespace, v.locale
ORDER BY k.namespace, v.locale;
```

---

### KPI 4.2 — Clés actives non traduites (missing keys catalog)

**Description** : combien de clés actives **manquent** dans une locale donnée.

| Aspect | Détail |
|---|---|
| **Formule** | `total_active_keys - translated_keys` |
| **Source** | DB |
| **Granularité** | Live, par locale, par namespace |
| **Owner** | Traducteur |
| **Target V1** | AR < 50 missing, EN < 50 missing |
| **Target V2** | AR = 0, EN < 20 |
| **Alert** | > 100 missing → Slack daily digest |
| **Cadence** | Live + daily digest |

#### Query SQL

```sql
SELECT
  k.key,
  k.namespace,
  k.source_value AS fr_value,
  k.context,
  array_agg(missing.locale) AS missing_in
FROM i18n_translation_keys k
CROSS JOIN (SELECT code FROM i18n_locales WHERE enabled = true AND code != 'fr') AS missing(locale)
LEFT JOIN i18n_translation_values v
  ON v.key = k.key AND v.locale = missing.locale
WHERE k.is_active = true
  AND v.key IS NULL
GROUP BY k.key, k.namespace, k.source_value, k.context
ORDER BY array_length(array_agg(missing.locale), 1) DESC, k.namespace, k.key
LIMIT 100;
```

---

### KPI 4.3 — Clés "stale" (FR mis à jour, AR/EN pas relus)

**Description** : la source FR a changé après que AR a été review → AR potentiellement désynchronisée.

| Aspect | Détail |
|---|---|
| **Formule** | `WHERE fr.updated_at > ar.reviewed_at` |
| **Source** | DB |
| **Owner** | Traducteur |
| **Target** | < 5% des clés review |
| **Alert** | > 10% → Slack #i18n |
| **Cadence** | Weekly |

#### Query SQL

```sql
SELECT
  k.key,
  k.namespace,
  fr.updated_at AS fr_updated,
  ar.reviewed_at AS ar_reviewed,
  ar.updated_at AS ar_updated,
  EXTRACT(DAY FROM NOW() - fr.updated_at) AS days_since_fr_update
FROM i18n_translation_keys k
INNER JOIN i18n_translation_values fr ON fr.key = k.key AND fr.locale = 'fr'
INNER JOIN i18n_translation_values ar ON ar.key = k.key AND ar.locale = 'ar'
WHERE k.is_active = true
  AND ar.reviewed = true
  AND fr.updated_at > ar.reviewed_at
ORDER BY fr.updated_at DESC
LIMIT 100;
```

---

### KPI 4.4 — Coverage CMS components

**Description** : combien de components CMS (`component_field_bindings`) ont une variante AR/EN.

| Aspect | Détail |
|---|---|
| **Formule** | `COUNT(DISTINCT component_id) WHERE locale='ar' / total` |
| **Source** | DB : `component_field_bindings` |
| **Granularité** | Per locale, per component_type |
| **Owner** | Founder (editorial) + tech lead |
| **Target V1** | AR ≥ 80%, EN ≥ 60% |
| **Alert** | Component publié sans variante AR/EN → console warn admin |
| **Cadence** | Weekly digest |

#### Query SQL

```sql
WITH component_locales AS (
  SELECT
    component_id,
    array_agg(DISTINCT locale) AS available_locales
  FROM component_field_bindings
  GROUP BY component_id
)
SELECT
  COUNT(*) FILTER (WHERE 'ar' = ANY(available_locales)) AS components_with_ar,
  COUNT(*) FILTER (WHERE 'en' = ANY(available_locales)) AS components_with_en,
  COUNT(*) AS total_components,
  ROUND(100.0 * COUNT(*) FILTER (WHERE 'ar' = ANY(available_locales)) / COUNT(*), 1) AS ar_coverage_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE 'en' = ANY(available_locales)) / COUNT(*), 1) AS en_coverage_pct
FROM component_locales;
```

---

## 5. Quality

### KPI 5.1 — Missing key rate (live)

**Description** : sur 10 000 renders, combien utilisent une clé absente → trigger fallback FR.

| Aspect | Détail |
|---|---|
| **Formule** | `missing_key_events / total_renders * 100` |
| **Source** | Sentry custom event `i18n.missing_key` + GA4 page_view total |
| **Granularité** | Live, par locale, par key |
| **Owner** | Tech lead |
| **Target V1** | < 0.1% |
| **Target V2** | < 0.01% |
| **Alert** | > 1% sur 5 min → Slack #i18n + email tech lead |
| **Cadence collecte** | Live (Sentry stream) |
| **Cadence revue** | Continue (Sentry dashboard) |

#### Implementation côté code (référence — pas à shipper ici)

```ts
// Dans le getMessageFallback de next-intl config
function onMissingKey({ namespace, key, locale }: MissingKeyEvent) {
  // Sentry capture
  Sentry.captureMessage('i18n.missing_key', {
    level: 'warning',
    tags: { locale, namespace },
    extra: { key },
  });
  // Tracking event
  trackEvent({
    name: 'i18n_missing_key',
    payload: { locale, namespace, key },
  });
}
```

#### Query Sentry

```
event.type:default message:"i18n.missing_key" tag:locale:ar
```

---

### KPI 5.2 — Fallback FR usage rate

**Description** : sur toutes les clés rendues en AR/EN, combien tombent en fallback FR (car traduction manquante).

| Aspect | Détail |
|---|---|
| **Formule** | `fallback_renders / total_renders * 100` |
| **Source** | Custom event `i18n_fallback_used` |
| **Granularité** | Per locale, per namespace |
| **Owner** | Tech lead + founder |
| **Target V1** | < 5% |
| **Target V2** | < 1% |
| **Alert** | > 5% sur 1h → email founder |
| **Cadence** | Live |

**Différence avec missing_key** : `missing_key` = clé absente du dictionnaire (bug). `fallback_used` = clé volontairement non traduite (en attente trad).

---

### KPI 5.3 — % traductions reviewed

**Description** : combien de traductions ont passé une review humaine (vs auto-MT).

| Aspect | Détail |
|---|---|
| **Formule** | `COUNT(*) WHERE reviewed = true / total * 100` |
| **Source** | DB `i18n_translation_values.reviewed` |
| **Granularité** | Per locale |
| **Owner** | Founder (mandate review) |
| **Target V1** | AR ≥ 80%, EN ≥ 70% reviewed |
| **Target V2** | 100% reviewed pour locales actives |
| **Alert** | Drop > -10pp WoW → Slack |
| **Cadence** | Weekly |

#### Query SQL

```sql
SELECT
  v.locale,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE reviewed = true) AS reviewed_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE reviewed = true) / COUNT(*), 1) AS reviewed_pct
FROM i18n_translation_values v
INNER JOIN i18n_translation_keys k ON k.key = v.key AND k.is_active = true
GROUP BY v.locale
ORDER BY v.locale;
```

---

### KPI 5.4 — Translation length deviation

**Description** : si AR est >> FR en longueur → suspect (peut casser UI).

| Aspect | Détail |
|---|---|
| **Formule** | `LENGTH(ar.value) / LENGTH(fr.value)` |
| **Source** | DB |
| **Granularité** | Per key |
| **Owner** | Traducteur |
| **Threshold** | ratio > 2.0 ou < 0.4 → flag manuel |
| **Cadence** | Manual review when adding bulk translations |

---

## 6. Performance

### KPI 6.1 — LCP (Largest Contentful Paint) par locale

**Description** : temps de chargement perçu par les utilisateurs.

| Aspect | Détail |
|---|---|
| **Formule** | p75(LCP) groupé par locale |
| **Source** | Vercel Analytics (Web Vitals beacon) |
| **Granularité** | 7d rolling, par device, par locale, par route |
| **Owner** | Tech lead |
| **Target V1** | FR p75 < 2.5s, AR/EN p75 < 2.75s (max +10%) |
| **Target V2** | Toutes locales p75 < 2.5s |
| **Alert** | LCP AR > 3.0s sur 24h → Slack tech |
| **Cadence collecte** | Live (beacon par render) |
| **Cadence revue** | Daily |

#### Custom dimension Vercel Analytics

```ts
// Doc only — implementation ailleurs
beforeSendEvent(event) {
  event.locale = getLocaleFromPath(window.location.pathname);
  return event;
}
```

---

### KPI 6.2 — Bundle size par locale

**Description** : poids du JS chargé par locale.

| Aspect | Détail |
|---|---|
| **Formule** | Taille gzippée des chunks `messages-[locale].js` |
| **Source** | `next build` output + Vercel deployment artifacts |
| **Granularité** | Per locale, per build |
| **Owner** | Tech lead |
| **Target V1** | < 30 KB gzip par locale |
| **Target V2** | < 20 KB gzip par locale |
| **Alert** | Augmentation > +20% vs baseline → email tech lead (CI check) |
| **Cadence collecte** | Per build (CI) |
| **Cadence revue** | Per PR (CI bot comment) |

#### CI check (référence script)

```bash
# .github/workflows/bundle-check.yml
- name: Check messages bundle size
  run: |
    SIZE_FR=$(stat -c%s .next/static/chunks/messages-fr.*.js)
    SIZE_AR=$(stat -c%s .next/static/chunks/messages-ar.*.js)
    SIZE_EN=$(stat -c%s .next/static/chunks/messages-en.*.js)
    echo "FR: $SIZE_FR | AR: $SIZE_AR | EN: $SIZE_EN"
    # Fail if any > 30 KB
    for SIZE in $SIZE_FR $SIZE_AR $SIZE_EN; do
      if [ "$SIZE" -gt 30720 ]; then exit 1; fi
    done
```

---

### KPI 6.3 — CLS (Cumulative Layout Shift) par locale

**Description** : stabilité visuelle, particulièrement critique pour RTL.

| Aspect | Détail |
|---|---|
| **Formule** | p75(CLS) groupé par locale |
| **Source** | Vercel Analytics |
| **Granularité** | 7d rolling |
| **Owner** | Tech lead + UX designer |
| **Target V1** | < 0.1 toutes locales |
| **Alert** | AR CLS > 0.2 → ticket UX prio |
| **Cadence** | Daily |

→ **Pourquoi spécifique AR** : flip RTL peut causer reflows si pas correctement géré.

---

### KPI 6.4 — INP (Interaction to Next Paint) par locale

**Description** : réactivité aux clics, notamment switcher locale.

| Aspect | Détail |
|---|---|
| **Formule** | p75(INP) |
| **Source** | Vercel Analytics |
| **Target V1** | < 200ms |
| **Owner** | Tech lead |
| **Cadence** | Daily |

---

### KPI 6.5 — Time to first meaningful paint (TTFMP) par route × locale

**Description** : metrics custom pour suivre routes spécifiques.

| Aspect | Détail |
|---|---|
| **Formule** | `performance.mark('meaningful')` — `navigationStart` |
| **Source** | Custom beacon |
| **Granularité** | Per route (kit, checkout, journal) × locale |
| **Owner** | Tech lead |
| **Target** | `/kit` < 2s, `/checkout/lead` < 1.5s |
| **Cadence** | Daily |

---

## 7. UX

### KPI 7.1 — Switcher usage rate

**Description** : % de sessions où l'utilisateur a changé manuellement la langue.

| Aspect | Détail |
|---|---|
| **Formule** | `sessions_with_switch / total_sessions * 100` |
| **Source** | `tracking_events_log` event `locale_changed_manually` |
| **Granularité** | Per locale source (from), per locale target (to) |
| **Owner** | UX designer + founder |
| **Target V1** | 3-8% (mesure baseline) |
| **Insight** | Switcher usage élevé = détection auto défectueuse |
| **Alert** | > 15% → tech lead investiguer détection |
| **Cadence** | Weekly |

#### Query SQL

```sql
WITH session_switches AS (
  SELECT DISTINCT session_id
  FROM tracking_events_log
  WHERE event_name = 'locale_changed_manually'
    AND occurred_at > NOW() - INTERVAL '7 days'
),
all_sessions AS (
  SELECT DISTINCT session_id
  FROM tracking_events_log
  WHERE occurred_at > NOW() - INTERVAL '7 days'
)
SELECT
  COUNT(s.session_id) AS sessions_with_switch,
  COUNT(a.session_id) AS total_sessions,
  ROUND(100.0 * COUNT(s.session_id) / COUNT(a.session_id), 2) AS switch_rate_pct
FROM all_sessions a
LEFT JOIN session_switches s ON s.session_id = a.session_id;
```

---

### KPI 7.2 — Switcher transitions (from → to)

**Description** : matrice de transitions pour comprendre les flux.

| Aspect | Détail |
|---|---|
| **Formule** | `GROUP BY (from, to)` |
| **Source** | `tracking_events_log` event `locale_changed_manually` |
| **Owner** | UX designer |
| **Insight** | Top transition révèle la détection défaillante |
| **Cadence** | Weekly |

#### Query SQL

```sql
SELECT
  payload->>'from' AS from_locale,
  payload->>'to' AS to_locale,
  COUNT(*) AS switches,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM tracking_events_log
WHERE event_name = 'locale_changed_manually'
  AND occurred_at > NOW() - INTERVAL '30 days'
GROUP BY from_locale, to_locale
ORDER BY switches DESC;
```

**Interprétation type** :
- 60% `fr → ar` = beaucoup d'utilisateurs détectés FR alors qu'ils veulent AR → audit Accept-Language
- 20% `ar → fr` = certains AR préfèrent l'interface en FR (cas marocain courant) → OK

---

### KPI 7.3 — Bounce rate par locale

**Description** : % sessions avec 1 seule pageview.

| Aspect | Détail |
|---|---|
| **Formule** | `sessions_1_page / total_sessions * 100` |
| **Source** | GA4 OR derived from `tracking_events_log` |
| **Granularité** | Per locale, per landing page |
| **Owner** | Marketing + UX |
| **Target V1** | AR bounce ≤ FR bounce + 5pp |
| **Alert** | AR bounce > FR + 15pp → ticket UX |
| **Cadence** | Weekly |

**Insight critique** : si AR bounce >> FR bounce, signal que la traduction AR est mauvaise OU le RTL mal foutu.

---

### KPI 7.4 — Drop-off après switcher

**Description** : % de sessions où l'utilisateur abandonne (close tab) dans les 10s après un switch.

| Aspect | Détail |
|---|---|
| **Formule** | `sessions_abandoning_post_switch / sessions_with_switch * 100` |
| **Source** | `tracking_events_log` (event sequence) |
| **Owner** | UX designer |
| **Target V1** | < 10% |
| **Alert** | > 20% → ticket UX |
| **Cadence** | Weekly |

---

### KPI 7.5 — Average session duration par locale

**Description** : engagement par langue.

| Aspect | Détail |
|---|---|
| **Formule** | `AVG(EXTRACT(EPOCH FROM (last_event - first_event)))` |
| **Source** | tracking_events_log |
| **Target** | AR ≥ 60% de FR |
| **Cadence** | Weekly |

---

## 8. SEO

### KPI 8.1 — Impressions par locale (GSC)

**Description** : nombre de fois où FemiGlow apparaît dans Google par locale.

| Aspect | Détail |
|---|---|
| **Formule** | `SUM(impressions)` filtered by path prefix |
| **Source** | Google Search Console API |
| **Granularité** | 7d, 28d, monthly |
| **Owner** | Marketing |
| **Target V1** | AR > 1000 impr/mois à M+3, EN > 500/mois |
| **Alert** | Drop > -20% WoW sur 1 locale → Slack |
| **Cadence** | Daily (cache 48h GSC) |

#### Query GSC (via API)

```typescript
// Pseudo code — GSC API
const result = await searchconsole.searchanalytics.query({
  siteUrl: 'sc-domain:femiglow.ma',
  requestBody: {
    startDate: '2026-04-27',
    endDate: '2026-05-27',
    dimensions: ['page'],
    dimensionFilterGroups: [{
      filters: [{ dimension: 'page', operator: 'contains', expression: '/ar/' }],
    }],
  },
});
```

---

### KPI 8.2 — CTR par locale

**Description** : qualité du référencement.

| Aspect | Détail |
|---|---|
| **Formule** | `clicks / impressions * 100` |
| **Source** | GSC |
| **Owner** | Marketing |
| **Target V1** | AR > 3%, EN > 2% |
| **Cadence** | Weekly |

---

### KPI 8.3 — Position moyenne par locale (top 10 queries)

**Description** : ranking moyen par locale.

| Aspect | Détail |
|---|---|
| **Formule** | `AVG(position)` par query |
| **Source** | GSC |
| **Target V1** | Top 5 queries < position 20 |
| **Cadence** | Monthly |

---

### KPI 8.4 — Indexation par locale

**Description** : combien d'URLs `/ar/*` et `/en/*` Google a réellement indexé.

| Aspect | Détail |
|---|---|
| **Formule** | `SELECT COUNT(*) FROM google_indexed WHERE path LIKE '/ar/%'` (data via GSC URL Inspection API) |
| **Source** | GSC URL Inspection |
| **Target V1** | ≥ 95% des URLs `/ar/*` et `/en/*` indexées |
| **Alert** | Coverage drop > -10% → Slack marketing |
| **Cadence** | Weekly |

---

### KPI 8.5 — Hreflang validation rate

**Description** : % pages avec hreflang valide (selon GSC).

| Aspect | Détail |
|---|---|
| **Source** | GSC International Targeting report |
| **Target V1** | 100% des pages publiées ont hreflang valide |
| **Alert** | Toute erreur hreflang → Slack tech |
| **Cadence** | Weekly |

---

## 9. Business

### KPI 9.1 — Conversion rate par locale

**Description** : LE KPI business final.

| Aspect | Détail |
|---|---|
| **Formule** | `purchases / sessions * 100` |
| **Source** | GA4 ecommerce event `purchase` + `session_start` |
| **Granularité** | Per locale, per device, per source |
| **Owner** | Founder |
| **Target V1** | AR ≥ 0.8 × FR conv |
| **Target V2** | AR = FR conv |
| **Alert** | AR < 0.5 × FR → email founder + investigation |
| **Cadence** | Weekly |

#### Query GA4 (via BigQuery export)

```sql
SELECT
  user_pseudo_id,
  (SELECT value.string_value FROM UNNEST(user_properties) WHERE key = 'locale') AS locale,
  COUNT(DISTINCT IF(event_name = 'purchase', ecommerce.transaction_id, NULL)) AS purchases,
  COUNT(DISTINCT IF(event_name = 'session_start', concat(user_pseudo_id, (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')), NULL)) AS sessions
FROM `femiglow.analytics_XXXX.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260420' AND '20260527'
GROUP BY user_pseudo_id, locale;
```

---

### KPI 9.2 — AOV (Average Order Value) par locale

**Description** : panier moyen par langue.

| Aspect | Détail |
|---|---|
| **Formule** | `SUM(revenue) / COUNT(purchases)` |
| **Source** | GA4 ecommerce + `orders` table DB |
| **Granularité** | Monthly |
| **Owner** | Founder |
| **Hypothèse** | AOV similaire entre locales (~370 MAD) |
| **Alert** | Écart > 30% entre AR et FR → investigation pricing |
| **Cadence** | Monthly |

---

### KPI 9.3 — Revenue contribution par locale

**Description** : % du CA total venu de chaque locale.

| Aspect | Détail |
|---|---|
| **Formule** | `SUM(revenue) WHERE locale = X / SUM(revenue) total` |
| **Source** | GA4 + DB `orders.locale` |
| **Granularité** | Monthly |
| **Owner** | Founder |
| **Target M+3** | AR ≥ 15% du CA |
| **Cadence** | Monthly |

---

### KPI 9.4 — LTV par locale

**Description** : valeur vie client par langue.

| Aspect | Détail |
|---|---|
| **Formule** | `AVG(total_revenue_per_customer)` |
| **Source** | DB `customers` join `orders` |
| **Granularité** | Quarterly |
| **Owner** | Founder |
| **Cadence** | Quarterly |

---

### KPI 9.5 — Funnel drop-off par locale

**Description** : à quelle étape les utilisateurs abandonnent (par langue).

| Aspect | Détail |
|---|---|
| **Source** | GA4 funnel report OU custom |
| **Owner** | Founder + tech lead |
| **Insight** | Si AR abandonne plus à `/checkout/lead` → champ formulaire AR mal traduit ? |
| **Cadence** | Weekly |

#### Étapes funnel à tracker

```
1. Land sur /[locale]/  (session_start)
2. View /[locale]/kit  (view_item)
3. Click "Acheter" → /[locale]/checkout/lead  (begin_checkout)
4. Submit lead form  (lead_submitted)
5. Confirm purchase  (purchase)
```

---

## 10. Tableau récapitulatif — tous KPIs

| # | KPI | Catégorie | Target V1 | Source | Cadence | Owner |
|---|---|---|---|---|---|---|
| 3.1 | % visites par locale | Adoption | FR=70/AR=20/EN=10 | tracking_events_log | Daily | Founder |
| 3.2 | New visitors par locale | Adoption | Croissance >10% MoM | GA4 | Weekly | Marketing |
| 3.3 | Sessions device×locale | Adoption | AR mobile >85% | GA4 | Monthly | Tech lead |
| 4.1 | % clés traduites | Coverage | AR≥90, EN≥90 | DB | Live | Tech lead |
| 4.2 | Missing keys actives | Coverage | < 50 par locale | DB | Live | Traducteur |
| 4.3 | Stale translations | Coverage | < 5% | DB | Weekly | Traducteur |
| 4.4 | Coverage CMS | Coverage | AR≥80, EN≥60 | DB | Weekly | Founder |
| 5.1 | Missing key rate | Quality | < 0.1% | Sentry | Live | Tech lead |
| 5.2 | Fallback FR rate | Quality | < 5% | Custom event | Live | Tech lead |
| 5.3 | % reviewed | Quality | AR≥80, EN≥70 | DB | Weekly | Founder |
| 5.4 | Length deviation | Quality | ratio 0.4-2.0 | DB | Manual | Traducteur |
| 6.1 | LCP par locale | Performance | AR < 2.75s | Vercel Analytics | Daily | Tech lead |
| 6.2 | Bundle size | Performance | < 30 KB gzip | CI | Per build | Tech lead |
| 6.3 | CLS par locale | Performance | < 0.1 | Vercel Analytics | Daily | Tech lead |
| 6.4 | INP par locale | Performance | < 200ms | Vercel Analytics | Daily | Tech lead |
| 6.5 | TTFMP par route | Performance | /kit < 2s | Custom | Daily | Tech lead |
| 7.1 | Switcher usage | UX | 3-8% | tracking_events_log | Weekly | UX |
| 7.2 | Switcher transitions | UX | Insight | tracking_events_log | Weekly | UX |
| 7.3 | Bounce rate par locale | UX | AR ≤ FR + 5pp | GA4 | Weekly | Marketing |
| 7.4 | Drop-off post switch | UX | < 10% | tracking_events_log | Weekly | UX |
| 7.5 | Session duration | UX | AR ≥ 0.6 × FR | tracking_events_log | Weekly | Marketing |
| 8.1 | Impressions GSC | SEO | AR > 1000/mois M+3 | GSC | Daily | Marketing |
| 8.2 | CTR par locale | SEO | AR > 3%, EN > 2% | GSC | Weekly | Marketing |
| 8.3 | Position moyenne | SEO | Top 5 q < pos 20 | GSC | Monthly | Marketing |
| 8.4 | Indexation par locale | SEO | ≥ 95% indexed | GSC | Weekly | Marketing |
| 8.5 | Hreflang validation | SEO | 100% valides | GSC | Weekly | Tech lead |
| 9.1 | Conversion par locale | Business | AR ≥ 0.8 × FR | GA4 | Weekly | Founder |
| 9.2 | AOV par locale | Business | Écart < 30% | GA4 + DB | Monthly | Founder |
| 9.3 | Revenue contribution | Business | AR ≥ 15% M+3 | GA4 + DB | Monthly | Founder |
| 9.4 | LTV par locale | Business | — | DB | Quarterly | Founder |
| 9.5 | Funnel drop-off | Business | Insight | GA4 | Weekly | Founder |

## 11. Définitions formelles (lexique)

| Terme | Définition |
|---|---|
| **Coverage** | % de clés actives ayant une valeur (peu importe la qualité) |
| **Reviewed** | Coverage **+** humain a marqué `reviewed = true` |
| **Active key** | Clé dans `i18n_translation_keys.is_active = true` |
| **Missing key** | Clé active sans valeur dans une locale donnée |
| **Stale translation** | Clé où FR a été mis à jour après le `reviewed_at` AR/EN |
| **Fallback** | Affichage de FR pour une clé manquante en AR/EN |
| **Locale switcher** | UI permettant de changer manuellement de langue |
| **Locale detection** | Algo middleware résolvant la locale (cf. `02-design-conception/locale-detection.md`) |
| **Session** | Période d'activité d'un visiteur (GA4 default = 30 min inactivity) |
| **p75** | 75e percentile (75% des mesures sont meilleures que cette valeur) |
| **pp** | Points de pourcentage (différence entre 2 pourcentages) |
| **MoM** | Month over Month |
| **WoW** | Week over Week |

## 12. Pièges KPIs

| Piège | Comment l'éviter |
|---|---|
| **Confondre coverage et qualité** | Coverage 100% ne dit RIEN sur la qualité. Toujours croiser avec `reviewed` |
| **Comparer adoption % sans baseline** | Toujours comparer à la baseline ou à un objectif explicite |
| **LCP global sans segmenter** | Toujours dimensionner par locale ET device |
| **Bounce rate trompeur** | GA4 a changé la définition en GA4 (engaged sessions). Vérifier la définition |
| **Conversion sans correction saisonnière** | Lundi 9h ≠ vendredi 16h. Comparer sur fenêtres comparables |
| **Switcher usage = échec de détection** | Pas toujours. Certains utilisateurs aiment tester. Croiser avec bounce |
| **GSC delay** | GSC a 48h de délai. Pas d'alerte basée sur "today" |
| **Sample size trop faible** | < 100 sessions → pas de p75 statistiquement valide |
| **GA4 vs GA-UA migration** | Si on vient de UA, attention aux events redéfinis |

## 13. Évolution KPIs par phase

### Phase 1 — Foundation (sem 1-2)

KPIs actifs : 4.1, 4.2 (coverage seulement)

### Phase 2 — Content extraction (sem 3-4)

Ajout : 5.1, 5.2 (missing key rate, fallback)

### Phase 3 — CMS multilingue (sem 5)

Ajout : 4.4 (coverage CMS)

### Phase 4 — RTL + AR (sem 6)

Ajout : 3.1, 3.3, 6.1-6.5 (adoption + performance par locale)

### Phase 5 — Translateur workflow (sem 7)

Ajout : 4.3, 5.3 (stale, reviewed)

### Phase 6 — Tests + QA (sem 8-9)

Ajout : 7.1-7.5 (UX KPIs)

### Phase 7 — Deploy + obs 30j (sem 10-11)

Tous les KPIs actifs, dont 8.x (SEO) et 9.x (business). Première revue mensuelle.

## 14. Checklist setup KPIs

- [ ] Custom dimension `locale` créée dans GA4
- [ ] Custom dimension `locale` envoyée dans tous les events GA4 (via gtag config)
- [ ] Sentry tag `locale` configuré dans `Sentry.init()`
- [ ] Vercel Analytics : custom property `locale` via `beforeSendEvent`
- [ ] BigQuery export GA4 activé (pour queries SQL custom)
- [ ] GSC API token + service account configurés (`GSC_API_KEY` env var)
- [ ] Tables `i18n_translation_keys` + `i18n_translation_values` créées
- [ ] Endpoint `/api/i18n/coverage` accessible et testé
- [ ] Endpoint `/api/i18n/missing-keys` accessible et testé
- [ ] Daily digest Slack 9h configuré (cron job)
- [ ] Weekly review meeting installé dans agenda founder + tech lead
- [ ] Owners assignés et notifiés (cf. README §7)
- [ ] Thresholds validés par founder

---

→ Prochaine lecture : [`dashboards.md`](./dashboards.md)
