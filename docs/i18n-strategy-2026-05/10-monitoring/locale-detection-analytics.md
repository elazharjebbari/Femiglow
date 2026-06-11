# Locale Detection — Analytics

> Analytics spécifiques à la détection de locale (path / cookie / header). Schema events, queries SQL, insights décisionnels.

## 1. Pourquoi des analytics dédiés détection ?

La détection de locale est un **algorithme silencieux** (`02-design-conception/locale-detection.md`) qui décide pour chaque visiteur quelle langue lui servir. Sans télémétrie :

- Impossible de savoir si **Accept-Language** est respecté
- Impossible de mesurer l'**impact des switcher** sur UX
- Impossible de **détecter une régression** (un deploy casse la détection)
- Impossible de **décider business** (faut-il ouvrir ES ? désactiver EN ?)

**3 questions** que ces analytics doivent répondre :

1. **Detection** : qu'est-ce qui pilote la locale finale d'un visiteur ?
2. **UX** : le switcher est-il utilisé ? Est-il efficace ?
3. **Business** : y a-t-il une **demande latente** pour une nouvelle langue ?

## 2. Events à tracker

### 2.1 Liste des events

3 events custom (issus de la décision §9 dans `02-design-conception/locale-detection.md`) :

| Event | Trigger | Owner code | Cadence émission |
|---|---|---|---|
| `locale_detected` | À chaque résolution middleware | `middleware.ts` | 1 par session_start typiquement |
| `locale_changed_manually` | Click sur LocaleSwitcher | `<LocaleSwitcher />` | 1 par switch |
| `locale_redirect` | Redirect imposé middleware (e.g. `/` → `/fr/`) | `middleware.ts` | 1 par redirect |

**Volume estimé** :
- `locale_detected` : ~20 000/jour à M+3 (= 1 par session)
- `locale_changed_manually` : ~500-1500/jour (~5% des sessions)
- `locale_redirect` : ~5 000/jour (visiteurs sans cookie)

→ Volume modeste, tient sans souci dans `tracking_events_log` (déjà 100k+ events/jour en prod).

### 2.2 Pourquoi pas dans GA4 ?

GA4 = bon pour funnel/conversion. Mais :
- GA4 sample sur high volume (peu probable ici, mais à terme)
- BigQuery export = 24h delay
- Custom events GA4 = limits dimensions

→ On utilise `tracking_events_log` (Postgres) pour latence < 5s + queries SQL flexibles. GA4 reçoit ces events aussi (via gtag) pour le marketing.

## 3. Schema TypeScript des events

### 3.1 Types

```typescript
// apps/web/src/lib/tracking/i18n-events.ts (REF — pas à shipper ici)

export type LocaleCode = 'fr' | 'ar' | 'en';

export type DetectionSource =
  | 'path'           // Step 1: URL contains /[locale]/...
  | 'cookie'         // Step 2: NEXT_LOCALE cookie
  | 'header'         // Step 3: Accept-Language header
  | 'geo'            // Step 4: IP geolocation (V2 only)
  | 'default';       // Step 5: fallback to default

export interface LocaleDetectedPayload {
  /** La locale finalement servie */
  locale: LocaleCode;
  /** Source qui a "gagné" dans l'algo */
  source: DetectionSource;
  /** Locale candidate par chaque source (pour cross-analysis) */
  candidates: {
    pathLocale: LocaleCode | null;
    cookieLocale: LocaleCode | null;
    headerBest: LocaleCode | null;
    acceptLanguageRaw: string | null; // 'ar-MA, ar;q=0.9, fr;q=0.8'
    countryGuess?: string;            // 'MA', 'FR' (V2)
  };
  /** Indique si redirect 30x émis pour atteindre la locale */
  redirected: boolean;
  /** User-Agent parsed (utile pour bots) */
  isBot: boolean;
}

export interface LocaleChangedManuallyPayload {
  from: LocaleCode;
  to: LocaleCode;
  /** Route au moment du switch (pour analyser quelle page déclenche le switch) */
  route: string;
  /** Switch via header, footer, modal */
  switcherLocation: 'header' | 'footer' | 'modal' | 'other';
}

export interface LocaleRedirectPayload {
  from: string;     // '/kit' (path before)
  to: string;       // '/fr/kit' (path after)
  reason: 'no_locale_prefix' | 'cookie_mismatch' | 'header_mismatch';
  statusCode: 301 | 302;
}

// Discriminated union
export type LocaleEvent =
  | { name: 'locale_detected'; payload: LocaleDetectedPayload }
  | { name: 'locale_changed_manually'; payload: LocaleChangedManuallyPayload }
  | { name: 'locale_redirect'; payload: LocaleRedirectPayload };
```

### 3.2 Persistence

```sql
-- tracking_events_log déjà existant
-- Ces events s'écrivent dedans avec event_name + payload (JSONB)

INSERT INTO tracking_events_log (
  session_id, event_name, payload, occurred_at, source_ip, user_agent
) VALUES (
  $1, 'locale_detected', $2::jsonb, NOW(), $3, $4
);
```

### 3.3 Validation Zod

```typescript
import { z } from 'zod';

const localeCodeSchema = z.enum(['fr', 'ar', 'en']);
const detectionSourceSchema = z.enum(['path', 'cookie', 'header', 'geo', 'default']);

export const localeDetectedSchema = z.object({
  locale: localeCodeSchema,
  source: detectionSourceSchema,
  candidates: z.object({
    pathLocale: localeCodeSchema.nullable(),
    cookieLocale: localeCodeSchema.nullable(),
    headerBest: localeCodeSchema.nullable(),
    acceptLanguageRaw: z.string().nullable(),
    countryGuess: z.string().optional(),
  }),
  redirected: z.boolean(),
  isBot: z.boolean(),
});

export const localeChangedManuallySchema = z.object({
  from: localeCodeSchema,
  to: localeCodeSchema,
  route: z.string(),
  switcherLocation: z.enum(['header', 'footer', 'modal', 'other']),
});

export const localeRedirectSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.enum(['no_locale_prefix', 'cookie_mismatch', 'header_mismatch']),
  statusCode: z.union([z.literal(301), z.literal(302)]),
});
```

## 4. Implementation — où émettre

### 4.1 Middleware Next.js — `locale_detected` + `locale_redirect`

```typescript
// apps/web/src/middleware.ts (REF — extension du middleware existant)
import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { trackEvent } from '@/lib/tracking/server';
import { parseAcceptLanguage } from '@/lib/i18n/accept-language';
import { isBot } from '@/lib/utils/bot-detection';

const intlMiddleware = createIntlMiddleware({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});

export default async function middleware(req: NextRequest) {
  const sessionId = req.cookies.get('session_id')?.value || generateSessionId();
  const acceptLang = req.headers.get('accept-language');
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
  const userAgent = req.headers.get('user-agent') || '';

  // Compute candidates
  const pathLocale = extractLocaleFromPath(req.nextUrl.pathname);
  const headerBest = matchAcceptLanguage(acceptLang, ['fr', 'ar', 'en']);

  // Determine winner
  let finalLocale: 'fr' | 'ar' | 'en';
  let source: DetectionSource;
  let redirected = false;

  if (pathLocale) {
    finalLocale = pathLocale;
    source = 'path';
  } else if (cookieLocale && ['fr', 'ar', 'en'].includes(cookieLocale)) {
    finalLocale = cookieLocale as LocaleCode;
    source = 'cookie';
    redirected = true;
  } else if (headerBest) {
    finalLocale = headerBest;
    source = 'header';
    redirected = true;
  } else {
    finalLocale = 'fr';
    source = 'default';
    redirected = true;
  }

  // Run next-intl (handles routing + cookie set)
  const response = intlMiddleware(req);

  // Track event (fire and forget — pas critique pour la latence)
  trackEvent({
    sessionId,
    name: 'locale_detected',
    payload: {
      locale: finalLocale,
      source,
      candidates: {
        pathLocale,
        cookieLocale: (cookieLocale as LocaleCode) ?? null,
        headerBest,
        acceptLanguageRaw: acceptLang,
      },
      redirected,
      isBot: isBot(userAgent),
    },
  }).catch(err => console.error('[tracking] locale_detected failed', err));

  // Si redirect, track aussi locale_redirect
  if (redirected) {
    trackEvent({
      sessionId,
      name: 'locale_redirect',
      payload: {
        from: req.nextUrl.pathname,
        to: `/${finalLocale}${req.nextUrl.pathname}`,
        reason: pathLocale ? 'cookie_mismatch' : 'no_locale_prefix',
        statusCode: 307,
      },
    }).catch(() => {});
  }

  return response;
}
```

**Note** : `trackEvent` est async, ne bloque pas la requête (fire-and-forget).

### 4.2 `<LocaleSwitcher />` component — `locale_changed_manually`

```typescript
// apps/web/src/components/i18n/LocaleSwitcher.tsx (REF)
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { trackEventClient } from '@/lib/tracking/client';

export function LocaleSwitcher({ location }: { location: 'header' | 'footer' | 'modal' }) {
  const currentLocale = useLocale() as LocaleCode;
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (newLocale: LocaleCode) => {
    if (newLocale === currentLocale) return;

    // Track BEFORE navigation
    trackEventClient({
      name: 'locale_changed_manually',
      payload: {
        from: currentLocale,
        to: newLocale,
        route: pathname,
        switcherLocation: location,
      },
    });

    // Set cookie + navigate
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax; Secure`;
    const newPath = pathname.replace(/^\/(fr|ar|en)/, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <select value={currentLocale} onChange={e => handleSwitch(e.target.value as LocaleCode)}>
      <option value="fr">Français</option>
      <option value="ar">العربية</option>
      <option value="en">English</option>
    </select>
  );
}
```

### 4.3 Track event helper

```typescript
// apps/web/src/lib/tracking/client.ts (REF)
export async function trackEventClient(event: LocaleEvent) {
  // POST /api/tracking/events (existant)
  navigator.sendBeacon(
    '/api/tracking/events',
    JSON.stringify({ events: [event] })
  );
}
```

## 5. Queries SQL — analyses clés

### 5.1 Top sources de détection (header dominant ?)

**Question** : qu'est-ce qui pilote la locale finale ?

```sql
SELECT
  payload->>'source' AS detection_source,
  COUNT(*) AS occurrences,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '7 days'
  AND (payload->>'isBot')::boolean = false  -- Exclude crawlers
GROUP BY detection_source
ORDER BY occurrences DESC;
```

**Output attendu (target)** :

| source | occurrences | pct |
|---|---|---|
| path | 12 500 | 62% (visiteurs returning, URL explicit) |
| cookie | 4 800 | 24% (returning sans path) |
| header | 2 100 | 11% (first visit) |
| default | 600 | 3% (header non match) |

**Interprétations** :
- Si `default` > 10% → l'algorithme Accept-Language ne match pas pour beaucoup → vérifier le matching (ex : `ar-MA` non géré ?)
- Si `header` > 30% → soit beaucoup de first-visits (acquisition forte), soit cookies bloqués

---

### 5.2 Match rate Accept-Language

**Question** : sur les visiteurs **first-visit** (donc routés par header), quel % match une locale supportée ?

```sql
WITH first_visits AS (
  SELECT
    payload->>'source' AS source,
    payload->'candidates'->>'acceptLanguageRaw' AS accept_lang,
    payload->'candidates'->>'headerBest' AS header_match
  FROM tracking_events_log
  WHERE event_name = 'locale_detected'
    AND occurred_at > NOW() - INTERVAL '7 days'
    AND (payload->>'isBot')::boolean = false
    AND payload->>'source' IN ('header', 'default')
)
SELECT
  CASE
    WHEN header_match IS NOT NULL THEN 'matched'
    ELSE 'no_match (fell to default)'
  END AS match_status,
  COUNT(*) AS occurrences,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM first_visits
GROUP BY match_status
ORDER BY occurrences DESC;
```

**Output attendu** :

| match_status | occurrences | pct |
|---|---|---|
| matched | 2 100 | 78% |
| no_match (fell to default) | 600 | 22% |

**Interprétation** :
- Si > 20% no_match → beaucoup de visiteurs avec langues non supportées (ES, IT, DE…)
- Si target : ouvrir une langue → c'est un signal fort

---

### 5.3 Distribution des Accept-Language non matchés

**Question** : quelles sont les langues "perdues" en default ?

```sql
SELECT
  -- Extraire la première langue de l'Accept-Language
  split_part(
    split_part(payload->'candidates'->>'acceptLanguageRaw', ',', 1),
    ';',
    1
  ) AS primary_language,
  COUNT(*) AS occurrences,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '30 days'
  AND payload->>'source' = 'default'
  AND (payload->>'isBot')::boolean = false
  AND payload->'candidates'->>'acceptLanguageRaw' IS NOT NULL
GROUP BY primary_language
ORDER BY occurrences DESC
LIMIT 20;
```

**Output attendu (insight business)** :

| primary_language | occurrences | pct |
|---|---|---|
| es | 1 800 | 28% — espagnol (signal fort pour ouvrir ES !) |
| es-ES | 1 200 | 19% |
| it | 800 | 12% |
| de | 600 | 9% |
| pt | 400 | 6% |
| nl | 300 | 5% |
| ... | ... | ... |

**Décision business** :
- Si ES > 25% → V2 : ouvrir Espagnol (Espagne / Latin Am)
- Si IT > 15% → V2 : considérer Italien
- ROI : coût trad (~1500 €) vs revenue potentiel

---

### 5.4 Switcher conversion (qui active vraiment AR ?)

**Question** : combien d'utilisateurs détectés en FR switchent vers AR ?

```sql
WITH switcher_transitions AS (
  SELECT
    payload->>'from' AS from_locale,
    payload->>'to' AS to_locale,
    COUNT(*) AS switches
  FROM tracking_events_log
  WHERE event_name = 'locale_changed_manually'
    AND occurred_at > NOW() - INTERVAL '30 days'
  GROUP BY from_locale, to_locale
),
detected_locales AS (
  SELECT
    payload->>'locale' AS locale,
    COUNT(*) AS detections
  FROM tracking_events_log
  WHERE event_name = 'locale_detected'
    AND occurred_at > NOW() - INTERVAL '30 days'
    AND (payload->>'isBot')::boolean = false
  GROUP BY locale
)
SELECT
  st.from_locale,
  st.to_locale,
  st.switches,
  dl.detections AS total_detected_as_from,
  ROUND(100.0 * st.switches / dl.detections, 2) AS switch_rate_pct
FROM switcher_transitions st
INNER JOIN detected_locales dl ON dl.locale = st.from_locale
ORDER BY st.switches DESC;
```

**Output attendu** :

| from | to | switches | total_detected | switch_rate_pct |
|---|---|---|---|---|
| fr | ar | 520 | 14 250 | 3.6% |
| ar | fr | 310 | 3 750 | 8.3% |
| fr | en | 180 | 14 250 | 1.3% |
| en | fr | 140 | 1 780 | 7.9% |

**Interprétations** :
- 3.6% des FR-détectés switchent vers AR → la détection n'est pas optimale pour eux (Maroc → fr-MA dans Accept-Language mais préfèrent AR)
- 8.3% AR → FR : profil marocain typique (consomme AR mais préfère FR pour le shopping ?)

**Décision** : tester si la détection sur `MA` country devrait défault AR (via geo, V2). Hypothesis test.

---

### 5.5 Drop-off après switch (UX problème)

**Question** : un user qui switch quitte-t-il vite ?

```sql
WITH switches AS (
  SELECT
    session_id,
    occurred_at AS switch_at,
    payload->>'to' AS to_locale,
    payload->>'route' AS route
  FROM tracking_events_log
  WHERE event_name = 'locale_changed_manually'
    AND occurred_at > NOW() - INTERVAL '30 days'
),
post_switch_activity AS (
  SELECT
    s.session_id,
    s.to_locale,
    s.route AS switch_route,
    COUNT(t.id) AS events_after_switch,
    MAX(t.occurred_at) - s.switch_at AS time_active_after_switch
  FROM switches s
  LEFT JOIN tracking_events_log t
    ON t.session_id = s.session_id
    AND t.occurred_at > s.switch_at
    AND t.occurred_at <= s.switch_at + INTERVAL '10 minutes'
  GROUP BY s.session_id, s.to_locale, s.switch_route, s.switch_at
)
SELECT
  to_locale,
  COUNT(*) AS total_switches,
  COUNT(*) FILTER (WHERE events_after_switch = 0) AS no_activity_after,
  COUNT(*) FILTER (WHERE time_active_after_switch < INTERVAL '10 seconds') AS abandoned_under_10s,
  ROUND(100.0 * COUNT(*) FILTER (WHERE time_active_after_switch < INTERVAL '10 seconds') / COUNT(*), 1) AS dropoff_pct
FROM post_switch_activity
GROUP BY to_locale
ORDER BY dropoff_pct DESC;
```

**Output attendu** :

| to_locale | total_switches | no_activity_after | abandoned_under_10s | dropoff_pct |
|---|---|---|---|---|
| ar | 520 | 48 | 65 | 12.5% |
| en | 180 | 12 | 15 | 8.3% |
| fr | 450 | 30 | 40 | 8.9% |

**Interprétations** :
- AR a drop-off 12.5% post-switch → potentiellement UX RTL cassée ou contenu AR pauvre
- EN drop-off 8.3% → acceptable
- Action : audit UX AR sur les pages déclencheurs de switch (cf. §5.6)

---

### 5.6 Top pages déclenchant un switch

**Question** : quelles pages déclenchent le plus de switch ? (signal de problème UX local)

```sql
SELECT
  payload->>'route' AS route,
  payload->>'from' AS from_locale,
  payload->>'to' AS to_locale,
  COUNT(*) AS switches
FROM tracking_events_log
WHERE event_name = 'locale_changed_manually'
  AND occurred_at > NOW() - INTERVAL '30 days'
GROUP BY route, from_locale, to_locale
ORDER BY switches DESC
LIMIT 20;
```

**Insight** :
- Si `/kit` apparaît souvent en "fr → ar" → la version FR de kit n'est pas claire pour les marocains
- Si `/checkout/lead` apparaît souvent → formulaire mal traduit ou typo critique

---

### 5.7 Locale par device (mobile vs desktop)

```sql
SELECT
  payload->>'locale' AS locale,
  CASE
    WHEN user_agent ~* 'mobile|iphone|android' THEN 'mobile'
    WHEN user_agent ~* 'ipad|tablet' THEN 'tablet'
    ELSE 'desktop'
  END AS device,
  COUNT(DISTINCT session_id) AS sessions
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '30 days'
  AND (payload->>'isBot')::boolean = false
GROUP BY locale, device
ORDER BY locale, device;
```

**Insight** :
- AR très mobile → optimiser RTL mobile en priorité
- EN équilibré → desktop OK

---

### 5.8 Bots vs humains

```sql
SELECT
  (payload->>'isBot')::boolean AS is_bot,
  payload->>'locale' AS locale,
  COUNT(*) AS events
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '7 days'
GROUP BY is_bot, locale
ORDER BY is_bot, locale;
```

**Utilité** :
- Si bots > 30% du traffic → re-vérifier sitemap par locale + robots.txt
- Si bot crawl /fr/ mais pas /ar/ → problème indexation

---

### 5.9 Tendance temporelle adoption

```sql
SELECT
  DATE_TRUNC('week', occurred_at) AS week,
  payload->>'locale' AS locale,
  COUNT(DISTINCT session_id) AS sessions
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '90 days'
  AND (payload->>'isBot')::boolean = false
GROUP BY week, locale
ORDER BY week, locale;
```

→ Sert au dashboard Adoption (chart time series).

---

### 5.10 Cookie mismatch (UX issue)

**Question** : combien d'utilisateurs ont un cookie locale mais voient une locale différente ?

```sql
SELECT
  payload->'candidates'->>'cookieLocale' AS cookie_locale,
  payload->>'locale' AS final_locale,
  payload->>'source' AS source,
  COUNT(*) AS occurrences
FROM tracking_events_log
WHERE event_name = 'locale_detected'
  AND occurred_at > NOW() - INTERVAL '7 days'
  AND payload->'candidates'->>'cookieLocale' IS NOT NULL
  AND payload->'candidates'->>'cookieLocale' != payload->>'locale'
GROUP BY cookie_locale, final_locale, source
ORDER BY occurrences DESC;
```

**Interprétation** :
- Si beaucoup de mismatch → bug middleware (cookie ignoré ?) ou intentionnel (path explicit override cookie)

---

## 6. Insights décisionnels — exemples

### 6.1 "Faut-il ouvrir ES (espagnol) en V2 ?"

**Données nécessaires** :
1. Query §5.3 sur 60 jours : `primary_language = 'es'` ou `'es-ES'`
2. Country (via geo si activé V2) : utilisateurs from Spain/Latin Am

**Décision** :

```
SI (visiteurs ES > 20% des "default") ET (croissance MoM positive)
ALORS → Investir 2 sem dev + ~2000 € trad → ouvrir ES
SINON → reporter à V3
```

### 6.2 "Faut-il désactiver EN ?"

**Données nécessaires** :
1. Query §5.4 : conversion EN
2. Adoption EN sur 90j (target ≥ 5%)

**Décision** :

```
SI (adoption EN < 3% pendant 3 mois) ET (conv EN < 0.5 × conv FR)
ALORS → désactiver EN, retirer du switcher, freezer trads
SINON → maintenir
```

### 6.3 "Switcher trop ou pas assez utilisé ?"

**Données nécessaires** :
1. Query §5.4 : taux global de switch
2. Query §5.5 : drop-off post-switch

**Décision** :

```
SI taux global > 15% ET drop-off > 20%
ALORS → la détection est mauvaise (switch forcé) ET la UX post-switch est cassée
ACTION → 1) audit détection 2) audit UX

SI taux global < 2%
ALORS → switcher peu utilisé MAIS peut indiquer détection parfaite ET aucune curiosité
ACTION → vérifier que le switcher est visible et accessible
```

### 6.4 "Le RTL casse-t-il l'UX en AR ?"

**Données nécessaires** :
1. Query §5.5 : drop-off `to_locale = 'ar'`
2. Bounce rate AR (cf. KPI 7.3)
3. Web Vitals CLS AR (cf. KPI 6.3)

**Décision** :

```
SI drop-off AR > 15% ET CLS AR > 0.2
ALORS → bug RTL probable
ACTION → audit visuel + tests Playwright AR
```

## 7. Reporting weekly automatique

### 7.1 Script

Cron job hebdo (lundi 8h) envoyant un email digest avec :
- Top 5 KPIs adoption
- Top sources de détection
- Top transitions switcher
- Anomalies détectées (drop, spike)

**Endpoint** : `/api/admin/i18n/reports/weekly` (Phase 5)

### 7.2 Template email

```
Subject : [FemiGlow i18n] Weekly report — week 22 (2026-05-25 to 2026-05-31)

📊 Adoption (7d)
- FR : 14 250 sessions (72%, ▲ +3%)
- AR : 3 750 sessions (19%, ▲ +8%)
- EN : 1 780 sessions (9%, ▼ -2%)

🔄 Switcher activity
- 1 110 switches total (5.6% des sessions)
- Top : fr→ar (520) > ar→fr (310) > fr→en (180)

🌍 Detection sources
- path: 62% | cookie: 24% | header: 11% | default: 3%
- Default = no match : 600 sessions (top langs : es, it, de)

⚠ Anomalies
- AR LCP p75 : 2.78s (warning, target <2.75s)
- 3 missing keys nouvelles sur EN

🎯 Insights
- Espagnol représente 28% des "default" → consider opening ES in V2

Voir détails : /admin/i18n/dashboard
```

## 8. Privacy & RGPD

### 8.1 Données collectées

| Donnée | Personnelle ? | Base légale | Rétention |
|---|---|---|---|
| `session_id` (cookie) | Pseudonyme | Intérêt légitime (analytics) | 90 jours |
| `locale` détectée | Non | Intérêt légitime | 12 mois |
| `acceptLanguageRaw` | Non | Intérêt légitime | 12 mois |
| `source_ip` | Personnelle | Intérêt légitime (sécurité) | 30 jours (hash) |
| `user_agent` | Quasi-anon | Intérêt légitime | 90 jours |
| `countryGuess` (V2) | Non | Intérêt légitime | 12 mois |

### 8.2 Conformité

- Cookie `NEXT_LOCALE` = **fonctionnel** (pas d'opt-in nécessaire, cf. `02-design-conception/locale-detection.md` §5.2)
- `session_id` = analytics (CNIL : peut nécessiter consentement si croisé avec IP). On hash l'IP après 30j.
- Pas d'identification user-level (pas de email/téléphone dans ces events)

### 8.3 Banner cookies

Mentionner :
> "Nous mesurons quelle langue vous est servie pour améliorer notre détection automatique. Aucune donnée personnelle n'est partagée."

## 9. Volume et performance

### 9.1 Charge estimée

| Métrique | Aujourd'hui | À M+3 | À M+12 |
|---|---|---|---|
| `locale_detected` events/jour | 0 | 20 000 | 60 000 |
| `locale_changed_manually` events/jour | 0 | 1 000 | 3 000 |
| `locale_redirect` events/jour | 0 | 5 000 | 15 000 |
| **Total i18n events/jour** | 0 | 26 000 | 78 000 |
| **Storage 12 mois** | 0 | 7.5M rows | 28M rows |

### 9.2 Performance impact

- `trackEvent` est **async** (fire-and-forget) → 0 ms ajouté à la latence middleware
- `tracking_events_log` indexé sur `(event_name, occurred_at)` + `(session_id)` → queries restent < 100 ms
- Si volume explose : partitioning par mois sur `tracking_events_log`

### 9.3 Sample rate

Pas de sampling V1 (volume gérable). Si volume × 10 :
- Sample `locale_detected` à 50% (1 event sur 2)
- Garder 100% pour `locale_changed_manually` (volume faible + valeur info élevée)

## 10. Pièges analytics locale

| Piège | Symptôme | Remède |
|---|---|---|
| **Tracker dans le client uniquement** | Bots et users no-JS pas trackés → biais | Tracker côté middleware (server-side) |
| **Pas de bot detection** | Stats faussées par Google/Bing | Filter `isBot = true` toujours |
| **Cookie set après détection** | Race condition : event dit "header" mais cookie déjà set | Tracker l'état AVANT next-intl middleware |
| **`session_id` incohérent** | Impossible de joindre detection + switch | Utiliser cookie `session_id` cross-events |
| **Pas de schema validation** | Garbage in payload (clés typo, valeurs imprévues) | Zod validation server-side |
| **PII dans payload** | RGPD violation | NE PAS stocker email/IP brut. Hash IP |
| **Pas de TTL** | Table grossit infinie | Cron purge events > 12 mois |
| **Confondre `locale_detected` et `page_view`** | Double comptage | Détection 1× par session, page_view N× |
| **Pas tracker `redirected`** | Impossible d'expliquer pourquoi locale finale | Capter le redirect dans le payload |
| **GA4 et tracking_events désynchronisés** | Chiffres divergents | Source of truth : `tracking_events_log` |

## 11. Évolution par phase

| Phase | Events actifs | Queries actives |
|---|---|---|
| Phase 1 | Aucun (focus foundation) | — |
| Phase 2 | `locale_detected` (basique) | §5.1 (sources) |
| Phase 4 (RTL+AR) | + `locale_changed_manually` + `locale_redirect` | §5.4-5.6 |
| Phase 5 | Schema validation Zod | §5.2-5.3 (insights business) |
| Phase 7 (obs 30j) | Geo enrichment (optionnel) | Toutes |

## 12. Cross-references

- [`02-design-conception/locale-detection.md`](../02-design-conception/locale-detection.md) §9 — Décision events à tracker
- [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md) — Path structure `/[locale]/...`
- [`kpis.md`](./kpis.md) §7 — KPIs UX (switcher usage)
- [`dashboards.md`](./dashboards.md) §4 — Dashboard Adoption
- [`alerts.md`](./alerts.md) — Pas d'alerte directement sur ces events (ils alimentent les autres)

## 13. Outputs business attendus

Au bout de 3 mois de collecte, on devrait pouvoir répondre :

- [ ] Quelle est la **répartition réelle** de nos visiteurs par langue ?
- [ ] Notre détection automatique est-elle **précise** (faible switcher usage = OK) ?
- [ ] Y a-t-il une **demande latente** pour une langue non supportée (ES ? IT ?) ?
- [ ] Le RTL en AR est-il **bien implémenté** (faible drop-off post-switch) ?
- [ ] Quelles **pages** posent problème de traduction (top pages déclenchant switch) ?
- [ ] **Faut-il maintenir EN** (adoption + conversion suffisantes) ?
- [ ] Le **cookie locale** est-il respecté (faible mismatch) ?
- [ ] Les **bots** trouvent-ils toutes les versions linguistiques (sitemap OK) ?

## 14. Checklist setup analytics locale

- [ ] Schema TypeScript `LocaleEvent` créé dans `apps/web/src/lib/tracking/i18n-events.ts`
- [ ] Validation Zod ajoutée dans `/api/tracking/events` pour ces events
- [ ] Middleware émet `locale_detected` sur chaque request (test sur staging)
- [ ] Middleware émet `locale_redirect` quand redirect (test sur staging)
- [ ] `<LocaleSwitcher />` émet `locale_changed_manually` (test sur staging)
- [ ] `trackEvent` est fire-and-forget (ne bloque pas requête)
- [ ] Bot detection implémentée dans `utils/bot-detection.ts`
- [ ] Cookie `session_id` setupé pour tracking cross-events
- [ ] Index DB `(event_name, occurred_at)` sur `tracking_events_log` vérifié
- [ ] Queries §5.1-5.10 testées sur staging (avec data fake)
- [ ] Endpoint `/api/admin/i18n/reports/weekly` créé (cron + email)
- [ ] Email template `i18n_weekly_report` créé dans Resend
- [ ] Founder briefé sur les insights business possibles (§6)
- [ ] RGPD : banner cookies mentionne usage analytics
- [ ] Cron de purge events > 12 mois configuré

---

→ Vous avez fini la doc monitoring. Retour au [`README.md`](./README.md) ou exploration [`11-test-execution/`](../11-test-execution/).
