# Alertes i18n — Configuration et runbooks

> 6 alertes critiques pour la stratégie i18n FemiGlow. Chaque alerte = condition + channel + severity + runbook + owner.

## 1. TL;DR (lecture 3 min)

| # | Alerte | Severity | Channel | Owner | Runbook |
|---|---|---|---|---|---|
| 1 | Missing key rate > 1% | P1 | Slack #i18n | Tech lead | [§4.1](#41-runbook-missing-key-spike) |
| 2 | Fallback FR usage > 5% | P2 | Email founder | Tech lead | [§4.2](#42-runbook-fallback-fr-élevé) |
| 3 | Bundle size locale > target +20% | P2 | Email tech lead | Tech lead | [§4.3](#43-runbook-bundle-size-bloat) |
| 4 | 5xx error rate locale > baseline | P0 | PagerDuty | On-call | [§4.4](#44-runbook-5xx-spike-par-locale) |
| 5 | Translation coverage drop > -5% | P2 | Slack #i18n | Tech lead | [§4.5](#45-runbook-coverage-drop) |
| 6 | SEO impressions locale drop > -20% WoW | P2 | Slack #marketing | Marketing | [§4.6](#46-runbook-seo-impressions-drop) |

**Severity ladder** (cohérent avec le reste du projet) :

| Severity | Définition | SLA réponse | Canal default |
|---|---|---|---|
| **P0 — Critical** | Site cassé, prod down, perte CA | 5 min | PagerDuty + Slack |
| **P1 — High** | UX dégradée significative, risk perte CA | 30 min | Slack ping |
| **P2 — Medium** | Dérive qualité, à corriger sous 24h | 4h business | Email |
| **P3 — Low** | Info, à traiter dans le sprint | 1 semaine | Slack #i18n |

## 2. Configuration des alertes

### 2.1 Canaux et tooling

| Canal | Outil | Usage | Setup |
|---|---|---|---|
| **Slack #i18n** | Slack incoming webhook | Alertes routine | `SLACK_I18N_WEBHOOK` env var |
| **Slack #marketing** | Slack incoming webhook | SEO + adoption | `SLACK_MARKETING_WEBHOOK` env var |
| **Email founder** | Resend (déjà en prod) | Décision business | Template `i18n_founder_alert` |
| **Email tech lead** | Resend | Bug bloquant | Template `i18n_tech_alert` |
| **PagerDuty** | PagerDuty service "FemiGlow Prod" | P0 only | Service routing key existant |

**Pourquoi pas Sentry alerts seul** : Sentry est bon pour error tracking, mais pour KPIs business (coverage, fallback) on a besoin de cron-based queries SQL → solution custom.

### 2.2 Architecture alertes

```
┌─────────────────────────────────────────────────────────────────┐
│ Source data                                                     │
│  - Sentry events (missing_key)                                  │
│  - tracking_events_log (page_view, locale_changed)              │
│  - i18n_translation_values (coverage)                           │
│  - Vercel Analytics (Web Vitals, errors)                        │
│  - GSC API (impressions)                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Alert evaluators                                                │
│  - Sentry alert rules (Sentry-native)                           │
│  - Cron job /api/admin/i18n/alerts/run (every 5 min)            │
│  - CI hooks (bundle size)                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Dispatcher                                                      │
│  - Filter (cooldown 1h, dedupe)                                 │
│  - Format payload                                               │
│  - Route by severity                                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   ┌─────────┐    ┌────────┐    ┌─────────┐    ┌───────────┐
   │ Slack   │    │ Email  │    │ PagerDty│    │ Dashboard │
   │ webhook │    │ Resend │    │ event   │    │ banner    │
   └─────────┘    └────────┘    └─────────┘    └───────────┘
```

### 2.3 Cron job pour alerts custom

**Endpoint** : `POST /api/admin/i18n/alerts/run` (déclenché par cron Vercel every 5 min)

**Logique simplifiée (référence — pas à implémenter ici)** :
```typescript
// apps/web/src/app/api/admin/i18n/alerts/run/route.ts (REF)
const evaluators = [
  evaluateFallbackRate,
  evaluateCoverageDrop,
  evaluateSeoImpressionsDrop,
  evaluateBundleSizeDrift,
];

for (const evaluate of evaluators) {
  const result = await evaluate();
  if (result.triggered && !isInCooldown(result.alertId)) {
    await dispatch(result);
    await setCooldown(result.alertId, '1h');
  }
}
```

### 2.4 Cooldown anti-spam

| Alert | Cooldown | Raison |
|---|---|---|
| Missing key rate spike | 30 min | Peut osciller pendant fix |
| Fallback FR rate | 4h | Slow-moving metric |
| Bundle size | 24h | 1 alerte par build |
| 5xx spike | 5 min | Doit re-alerter si pas résolu |
| Coverage drop | 24h | Slow-moving |
| SEO impressions | 7 jours | GSC très bruyant |

## 3. Liste détaillée des 6 alertes

### Alerte 1 — Missing key rate > 1%

#### 3.1 Description

Une clé est demandée par le code mais absente du dictionnaire de la locale → la valeur FR (fallback) ou la clé brute s'affiche.

#### 3.2 Condition exacte

```
COUNT(missing_key events) / COUNT(page_view events) > 0.01
sur fenêtre glissante 5 min
```

#### 3.3 Configuration Sentry

Sentry permet de configurer cette alerte nativement :

**Project** : `femiglow-web`
**Type** : Metric alert
**Metric** : `event.count()`
**Query** : `event.type:default message:"i18n.missing_key"`
**Trigger** :
- Critical : > 1% sur 5 min
- Warning : > 0.5% sur 5 min
**Resolve** : auto si < 0.1% sur 10 min

**Action** :
- Slack channel `#i18n` (intégration Sentry-Slack)
- Mention `@tech-lead`

#### 3.4 Payload Slack exemple

```
🚨 [P1] i18n missing key rate spike

Rate: 2.4% (threshold 1%)
Window: last 5 min
Top missing keys:
  - marketing.hero.cta_v2 (124 occurrences, locale=ar)
  - wizard.confirm.label_v3 (89 occurrences, locale=en)

Sentry: https://sentry.io/.../alert/123
Runbook: docs/i18n-strategy-2026-05/10-monitoring/alerts.md#41
Dashboard: /admin/i18n/dashboard?tab=health
```

#### 3.5 Severity

**P1 — High**. Pas critique (UI fonctionne, fallback FR), mais signale un bug intro depuis dernier deploy → corriger sous 30 min.

#### 3.6 Owner

Tech lead

#### 3.7 Escalation

Si non-résolu sous 1h → email founder.

---

### Alerte 2 — Fallback FR usage > 5%

#### 3.2.1 Description

Trop de clés en AR/EN tombent en fallback FR car non traduites → mauvaise expérience utilisateur AR/EN.

**Différence avec Alerte 1** : missing key = clé absente du catalog (bug code). Fallback = clé volontairement non traduite (en attente trad).

#### 3.2.2 Condition exacte

```sql
SELECT
  payload->>'locale' AS locale,
  100.0 * COUNT(*) FILTER (WHERE event_name = 'i18n_fallback_used') /
    NULLIF(COUNT(*) FILTER (WHERE event_name = 'i18n_render'), 0) AS fallback_rate
FROM tracking_events_log
WHERE occurred_at > NOW() - INTERVAL '1 hour'
  AND payload->>'locale' IN ('ar', 'en')
GROUP BY locale
HAVING fallback_rate > 5;
```

#### 3.2.3 Configuration

**Type** : Custom cron-based (every 1h)
**Action** : email founder + tech lead

#### 3.2.4 Payload email exemple

```
Sujet : [FemiGlow i18n] Fallback FR usage > 5% en AR

Bonjour,

Sur la dernière heure, 8.3% des renders en AR ont basculé sur le fallback FR.

Top namespaces concernés :
  - marketing : 12.4% fallback
  - legal : 9.1% fallback

Cause probable : nouvelles clés ajoutées récemment, pas encore traduites.

Action attendue :
1. Push CSV traductions au traducteur (cf. runbook §4.2)
2. Re-mesurer dans 24h

Dashboard : https://femiglow.ma/admin/i18n/dashboard?tab=health
Runbook : docs/i18n-strategy-2026-05/10-monitoring/alerts.md#42

Bien à vous,
Système d'alertes FemiGlow
```

#### 3.2.5 Severity

**P2 — Medium**. UX dégradée mais pas cassée. À corriger sous 24h.

#### 3.2.6 Owner

Tech lead (technique). Email founder pour décision : pousser MT auto ou attendre trad humaine.

---

### Alerte 3 — Bundle size locale > target +20%

#### 3.3.1 Description

Le bundle JS contenant les messages d'une locale dépasse la baseline de +20% → impact LCP.

#### 3.3.2 Condition exacte

```
size_current > size_baseline * 1.20
```

Avec `size_baseline` = moyenne 10 derniers builds réussis.

#### 3.3.3 Configuration CI

**Tool** : GitHub Actions check + size-limit npm package

```yaml
# .github/workflows/bundle-i18n-check.yml (référence)
- name: Check messages bundle size
  run: |
    for LOC in fr ar en; do
      SIZE=$(stat -c%s .next/static/chunks/messages-$LOC.*.js)
      BASELINE=$(curl -s $API/baseline-size?locale=$LOC)
      THRESHOLD=$(echo "$BASELINE * 1.20" | bc)
      if [ "$SIZE" -gt "$THRESHOLD" ]; then
        echo "::error::Bundle messages-$LOC.js ($SIZE B) > baseline+20% ($THRESHOLD B)"
        exit 1
      fi
    done
```

**Trigger** : sur PR + merge to main.

**Action** :
- CI fail (PR ne peut pas merger)
- Email tech lead si merge force-pushed

#### 3.3.4 Payload exemple

GitHub PR comment :
```
Bundle size check failed

  ⚠ messages-ar.js : 35.2 KB (baseline: 24.0 KB, +47%)

Suggestions :
- Vérifier si imports lourds dans namespace 'marketing' (CKEditor?)
- Considérer lazy-load namespace 'admin' (pas utilisé en front)
- Check duplicate keys avec `npx i18n-dedup`
```

#### 3.3.5 Severity

**P2 — Medium**. Pas urgent en prod (CI bloque avant), mais nuit à la qualité.

#### 3.3.6 Owner

Tech lead

---

### Alerte 4 — 5xx error rate locale > baseline

#### 3.4.1 Description

Une locale produit plus d'erreurs 5xx que les autres → bug spécifique locale (ex : SSR crash sur RTL, parsing AR…).

#### 3.4.2 Condition exacte

```
error_rate(locale=X) > avg(error_rate(other locales)) * 2
ET error_rate(locale=X) > 0.5% (absolute min threshold)
sur fenêtre 10 min
```

#### 3.4.3 Configuration Sentry

**Project** : `femiglow-web`
**Type** : Metric alert (multi-condition)

```yaml
conditions:
  - threshold: error_rate > 0.5%
    window: 10m
    tags: { locale: ar }
  - threshold: error_rate(ar) > 2 * error_rate(fr)
    window: 10m
```

**Action** :
- PagerDuty `femiglow-prod-pager`
- Slack `#engineering` + `#i18n`
- Dashboard banner red

#### 3.4.4 Payload PagerDuty exemple

```
[P0] 5xx error rate spike — locale AR

Error rate AR: 2.4% (baseline 0.1%)
Most common error: TypeError in /[locale]/kit/page.tsx:42
Affected sessions (10 min): 240

Sentry: https://sentry.io/issues/xxxx
Runbook: alerts.md#44
```

#### 3.4.5 Severity

**P0 — Critical**. Bloquant pour les utilisateurs AR.

#### 3.4.6 Owner

On-call rotation. Si pas de rotation : tech lead direct.

#### 3.4.7 Escalation

- 5 min sans ack → escalate to founder (SMS via PagerDuty)
- 30 min sans resolve → consider rollback or feature flag disable AR

---

### Alerte 5 — Translation coverage drop > -5%

#### 3.5.1 Description

Le pourcentage de coverage d'une locale a chuté de plus de 5 points en 24h.

**Causes typiques** :
- Nouvelle batch de clés ajoutées (légitime, mais à acter)
- Suppression accidentelle de traductions
- Bug import/export

#### 3.5.2 Condition exacte

```sql
WITH today AS (
  SELECT locale, metric_value AS today_pct
  FROM i18n_metrics_snapshots
  WHERE metric_name = 'coverage_pct'
    AND snapshot_date = CURRENT_DATE
),
yesterday AS (
  SELECT locale, metric_value AS yesterday_pct
  FROM i18n_metrics_snapshots
  WHERE metric_name = 'coverage_pct'
    AND snapshot_date = CURRENT_DATE - INTERVAL '1 day'
)
SELECT t.locale, t.today_pct, y.yesterday_pct, (y.yesterday_pct - t.today_pct) AS drop
FROM today t
INNER JOIN yesterday y ON y.locale = t.locale
WHERE (y.yesterday_pct - t.today_pct) > 5;
```

#### 3.5.3 Configuration

**Type** : Custom cron (daily 9h)
**Action** : Slack `#i18n`

#### 3.5.4 Payload Slack exemple

```
⚠ [P2] Coverage drop detected

Locale: AR
Yesterday: 88.4%
Today: 78.2%
Drop: -10.2pp

Possible causes:
  - New keys added: 47 (check git log)
  - Keys deleted: 0
  - Import error: 0

Last commit touching i18n: a3f2c1d (Founder, 2h ago)
"feat(i18n): add legal CGV v3 keys"

→ Push CSV to translator: https://femiglow.ma/admin/i18n/export?locale=ar&onlyMissing=true
→ Runbook: alerts.md#45
```

#### 3.5.5 Severity

**P2 — Medium**. Pas urgent, mais nécessite action.

#### 3.5.6 Owner

Tech lead (initial) → traducteur (action).

---

### Alerte 6 — SEO impressions locale drop > -20% WoW

#### 3.6.1 Description

Les impressions Google pour une locale ont chuté de >20% en 1 semaine.

**Causes typiques** :
- Hreflang cassé après deploy
- Sitemap manquant
- Penalité Google
- Saisonnalité (à filtrer)

#### 3.6.2 Condition exacte

```python
# Pseudo : GSC API
this_week = sum(impressions, period=last_7_days, filter=path_prefix=/ar/)
prev_week = sum(impressions, period=8_to_14_days_ago, filter=path_prefix=/ar/)
drop_pct = (prev_week - this_week) / prev_week
trigger = drop_pct > 0.20 AND prev_week > 100  # min volume to be significant
```

#### 3.6.3 Configuration

**Type** : Custom cron (daily 10h, après GSC update)
**Action** : Slack `#marketing` + email marketing

#### 3.6.4 Payload Slack exemple

```
📉 [P2] SEO impressions drop — locale AR

Last 7d: 850 impressions
Previous 7d: 1 220 impressions
Drop: -30.3%

Possible causes:
  - Last deploy touching hreflang: 5 days ago
  - Sitemap /ar/sitemap.xml: 200 OK
  - GSC errors: 0 new

Recommended actions:
  1. Check GSC International Targeting report
  2. Validate hreflang on 5 key pages
  3. Check if any robots.txt changes

GSC: https://search.google.com/search-console
Runbook: alerts.md#46
```

#### 3.6.5 Severity

**P2 — Medium**. Impact business potentiel, mais slow-moving.

#### 3.6.6 Owner

Marketing (initial) → tech lead si hreflang issue.

---

## 4. Runbooks

### 4.1 Runbook : Missing key spike

**Symptômes** : alerte 1 déclenchée, Sentry montre clés `i18n.missing_key`.

**Plan d'action (15 min)** :

1. **Identifier les clés** (2 min)
   - Sentry : ouvrir alerte → top "missing keys" sorted by occurrences
   - Noter top 5 clés

2. **Identifier la source** (3 min)
   ```bash
   # Pour chaque clé, grep dans le code
   git grep "marketing.hero.cta_v2" apps/web/src
   ```
   - Si trouvé : clé utilisée mais absente du dictionnaire → continuer step 3
   - Si pas trouvé : clé absente partout → fausse alerte (cooldown)

3. **Hot fix immédiat** (5 min)
   - Option A : ajouter fallback dans `messages/fr.json` (déploie en 1 min)
   - Option B : changer la clé pour une clé existante (revert si possible)
   - Option C : feature flag pour cacher le composant utilisant la clé

4. **Vérifier resolution** (5 min)
   - Sentry : metric retombe < 0.1% sous 10 min
   - Alerte se résout auto

5. **Post-mortem (async, sous 24h)**
   - Pourquoi cette clé est-elle entrée en prod sans traduction ?
   - Pre-commit hook ESLint manquant ? Tests E2E manquants ?
   - Add to backlog tests/i18n-extraction.test.ts

**Si non résolu sous 30 min** :
- Rollback du dernier deploy (cf. `09-runbook/rollback.md`)

---

### 4.2 Runbook : Fallback FR élevé

**Symptômes** : email "Fallback FR > 5% en AR".

**Plan d'action (sous 24h)** :

1. **Identifier les namespaces concernés** (5 min)
   - Email contient le breakdown par namespace
   - Confirmer dans dashboard `/admin/i18n/dashboard?tab=health` row 2 (heatmap)

2. **Exporter les missing keys AR** (1 min)
   ```bash
   curl 'https://femiglow.ma/api/admin/i18n/export?locale=ar&format=csv&onlyMissing=true' \
     -H 'Cookie: admin_session=...' \
     -o missing-ar-$(date +%Y%m%d).csv
   ```

3. **Décision : MT auto ou trad humaine ?** (founder decision, 5 min)
   - Si < 50 clés → trad humaine (envoyer CSV au freelance)
   - Si > 50 clés → MT auto via DeepL + review humaine ensuite (cf. `06-data-strategy/`)

4. **Push CSV au traducteur** (1 min)
   - Email avec CSV + délai (24h ou 72h selon volume)

5. **Import retour** (5 min après réception)
   ```bash
   curl -X POST 'https://femiglow.ma/api/admin/i18n/import' \
     -F 'file=@translated-ar.csv' \
     -F 'locale=ar' \
     -F 'dryRun=true' \
     -H 'Cookie: ...'
   # Valider counts → puis dryRun=false
   ```

6. **Vérifier dashboard** (5 min)
   - Fallback rate AR → doit retomber < 5%
   - Coverage AR augmente

---

### 4.3 Runbook : Bundle size bloat

**Symptômes** : CI fail "bundle size exceeded".

**Plan d'action (15 min)** :

1. **Identifier la cause** (5 min)
   ```bash
   # Compare bundles
   npx source-map-explorer .next/static/chunks/messages-ar.*.js
   ```
   - Visualiser quel namespace pèse le plus
   - Comparer vs build précédent

2. **Cas typiques**

   **Cas A — Nouveau namespace lourd ajouté**
   - Vérifier si namespace utilisé côté client (`'use client'`)
   - Si non utilisé client → lazy load via dynamic import

   **Cas B — Traductions très longues ajoutées**
   - Vérifier `ar` vs `fr` : ratio > 1.5 ?
   - Si AR a beaucoup de texte → c'est OK, ajuster baseline

   **Cas C — Doublons**
   - `npx i18n-dedup` (script custom à créer)
   - Merger clés équivalentes

3. **Fix** (5 min)
   - Refactor namespace usage (lazy load) OR
   - Update baseline (si croissance légitime)

4. **Re-run CI** (5 min)
   - Push commit fix
   - CI passe ✅

---

### 4.4 Runbook : 5xx spike par locale

**Symptômes** : PagerDuty alerte P0, Sentry rouge.

**Plan d'action (30 min max — P0)** :

1. **Triage immédiat (2 min)**
   - Sentry : ouvrir l'issue dominante (50+ events same fingerprint)
   - Noter : stack trace + locale + route

2. **Reproduce local (5 min)**
   ```bash
   # Run app avec locale AR
   NEXT_PUBLIC_LOCALE_OVERRIDE=ar pnpm dev
   # Naviguer sur route impactée
   ```

3. **Decision tree**

   **Cas A — Bug code spécifique RTL** (ex: regex breaks on arabic)
   - Fix immédiat + deploy hotfix
   - Estimated 10-20 min

   **Cas B — Bug data CMS** (ex: composant CMS sans variante AR cause crash)
   - Quick fix : ajouter fallback gracieux dans le code
   - Long fix : ajouter variante AR au CMS

   **Cas C — Bug edge case** (rare)
   - Feature flag : `LOCALE_AR_ENABLED=false`
   - Désactive temporairement AR, alerte se résout
   - Investigation async (4h+)

4. **Vérifier resolution (5 min)**
   - Sentry : error rate retombe à baseline
   - PagerDuty incident ack + resolve

5. **Post-mortem obligatoire (sous 48h)**
   - Pourquoi ce bug n'a pas été attrapé par les tests E2E AR ?
   - Add E2E test pour ce scénario
   - Cf. `07-tests/` pour structure tests

---

### 4.5 Runbook : Coverage drop

**Symptômes** : alerte Slack `Coverage drop -10pp en AR`.

**Plan d'action (sous 24h)** :

1. **Identifier la cause** (5 min)
   ```bash
   # Git log sur fichiers i18n
   git log --since="1 day ago" --oneline -- apps/web/messages/
   git log --since="1 day ago" --oneline -- apps/web/src
   ```

2. **Cas typiques**

   **Cas A — Nouvelles clés ajoutées (légitime)**
   - Founder a ajouté des features
   - Action : pousser au traducteur (cf. runbook 4.2)

   **Cas B — Suppression accidentelle**
   - Diff git montre traductions deleted
   - Action : `git revert` ou restore manual

   **Cas C — Import bugué**
   - Logs `/admin/i18n/import` → erreurs ?
   - Action : restore from backup

3. **Action selon cas** (10 min)

4. **Vérifier dans dashboard** (5 min)
   - Coverage AR retourne baseline ou continue update progressif

---

### 4.6 Runbook : SEO impressions drop

**Symptômes** : alerte Slack `Impressions AR -30% WoW`.

**Plan d'action (sous 48h)** :

1. **Identifier la cause (15 min)**
   - Ouvrir GSC : Settings → International Targeting
   - Vérifier hreflang errors (top items)
   - Coverage report : pages indexées par locale
   - Sitemap status

2. **Cas typiques**

   **Cas A — Hreflang cassé** (récent deploy)
   ```bash
   # Test sur 3 pages
   curl -s https://femiglow.ma/ar/kit | grep "hreflang"
   # Should see <link rel="alternate" hreflang="..."/>
   ```
   - Si manquant : bug code → tech lead
   - Si présent : continuer

   **Cas B — Désindexation**
   - GSC Coverage : pages "Excluded"
   - Vérifier `robots.txt` non régressé
   - Vérifier `<meta name="robots" content="noindex">` absent

   **Cas C — Saisonnalité**
   - Comparer même période N-1 mois
   - Si pattern saisonnier → fausse alerte, ajuster threshold

3. **Action** (30 min - 4h selon cas)
   - Hotfix code si hreflang cassé
   - Force re-index via GSC URL Inspection
   - Resubmit sitemap

4. **Suivi**
   - GSC met 7-14j à se mettre à jour
   - Ne pas paniquer si impressions ne remontent pas immédiatement

---

## 5. Test des alertes (chaos engineering)

### 5.1 Test plan trimestriel

Chaque trimestre, on **déclenche manuellement** chaque alerte pour vérifier que :
- L'alerte se déclenche
- Le payload est correct
- Le canal reçoit
- L'owner est notifié
- Le runbook est applicable

### 5.2 Test scripts

**Test alerte 1 (missing key)** :
```bash
# Sur staging
curl -X POST $STAGING_URL/api/test/inject-missing-key \
  -d '{"locale":"ar","key":"test.fake_key","count":200}'
# Wait 5 min, check Slack #i18n received
```

**Test alerte 4 (5xx spike)** :
```bash
# Trigger 50 errors on staging
for i in {1..50}; do
  curl $STAGING_URL/ar/test-error-page
done
# Wait 10 min, check PagerDuty received
```

### 5.3 Validation

| Alerte | Test | Expected outcome | Last tested |
|---|---|---|---|
| 1 | Inject 200 missing keys | Slack #i18n in <10 min | T0 |
| 2 | Push fake fallback events | Email in <1h (cron) | T0 |
| 3 | Push bundle 30 KB AR | CI fails | T0 |
| 4 | Inject 50 errors | PagerDuty in <10 min | T0 |
| 5 | Delete 100 AR translations on staging | Slack #i18n next day | T0 |
| 6 | (Hard to test — GSC) | Manual review trimestriel | T0 |

## 6. Pièges alertes

| Piège | Conséquence | Remède |
|---|---|---|
| **Trop d'alertes** | Slack mute → ratent les vraies | Max 6 alertes total. Severity ladder strict |
| **Pas de cooldown** | 50 messages identiques en 5 min | Cooldown min 5 min, max 24h |
| **Threshold trop sensible** | False positives | Démarrer haut, descendre progressivement |
| **Pas de baseline** | "Drop -20%" mais 100 → 80 = OK | Min absolute threshold (e.g. min 100 impressions) |
| **Runbook inexistant** | Alerté mais sait pas quoi faire | Runbook OBLIGATOIRE avec chaque alerte |
| **Owner inconnu** | Alerte tombe dans le vide | Owner explicite + email ou Slack mention |
| **Alerte PagerDuty pour P2** | Réveil 3h matin pour rien | Severity = canal. P0 only = PagerDuty |
| **Pas de test périodique** | "L'alerte fonctionne ?" Mystère | Test trimestriel obligatoire |
| **Source data unreliable** | Alertes intermittentes | Vérifier source up + sample size suffisant |
| **Dedupe absent** | Même alerte plusieurs canaux | Dedupe IDs + cooldown |

## 7. Évolution alertes par phase

| Phase | Alertes activées |
|---|---|
| Phase 1 — Foundation | Aucune (juste dashboard) |
| Phase 2 — Content extraction | Alerte 1 (missing key) |
| Phase 4 — RTL + AR | Alertes 1, 4 (missing key, 5xx) |
| Phase 5 — Workflow translateur | Alertes 1, 2, 4, 5 (+fallback, coverage drop) |
| Phase 6 — Tests + QA | Alerte 3 (bundle size CI) |
| Phase 7 — Deploy + obs | Toutes 6 actives |

## 8. Owners matrix

| Alerte | Primary | Backup | Escalation |
|---|---|---|---|
| 1. Missing key spike | Tech lead | Dev | Founder (si 1h) |
| 2. Fallback FR rate | Tech lead | Traducteur | Founder |
| 3. Bundle size | Tech lead | Dev | — |
| 4. 5xx spike | On-call / Tech lead | Founder (SMS) | Founder direct |
| 5. Coverage drop | Tech lead | Traducteur | Founder |
| 6. SEO impressions | Marketing | Tech lead | Founder |

## 9. Templates

### 9.1 Template Slack incoming webhook

```typescript
// apps/web/src/lib/alerts/slack.ts (REF)
interface SlackAlertPayload {
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  metrics: Record<string, string | number>;
  runbookUrl: string;
  dashboardUrl?: string;
  mentions?: string[]; // ['@tech-lead']
}

async function sendSlack(channel: 'i18n' | 'marketing', payload: SlackAlertPayload) {
  const webhook = channel === 'i18n' ? process.env.SLACK_I18N_WEBHOOK : process.env.SLACK_MARKETING_WEBHOOK;
  await fetch(webhook, {
    method: 'POST',
    body: JSON.stringify({
      text: `${severityEmoji[payload.severity]} [${payload.severity}] ${payload.title}`,
      blocks: [...],
    }),
  });
}
```

### 9.2 Template email (Resend)

```typescript
// REF
await resend.emails.send({
  from: 'alerts@femiglow.ma',
  to: 'founder@femiglow.ma',
  subject: `[FemiGlow i18n] ${alertTitle}`,
  react: <I18nAlertEmail payload={payload} />,
});
```

## 10. Checklist setup alertes

- [ ] Slack channel #i18n créé
- [ ] Slack channel #marketing créé (si pas déjà)
- [ ] Slack incoming webhook URL pour #i18n stocké en `SLACK_I18N_WEBHOOK`
- [ ] Slack incoming webhook URL pour #marketing stocké en `SLACK_MARKETING_WEBHOOK`
- [ ] PagerDuty service "FemiGlow Prod" routing key stocké en `PAGERDUTY_ROUTING_KEY`
- [ ] Sentry-Slack integration installée (officielle)
- [ ] Sentry alert "missing_key spike" configurée et testée
- [ ] Sentry alert "5xx spike" configurée et testée
- [ ] Cron Vercel `/api/admin/i18n/alerts/run` configuré (every 5 min)
- [ ] Table `i18n_metrics_snapshots` créée et populée daily
- [ ] CI workflow `bundle-i18n-check.yml` configuré
- [ ] Email template `i18n_founder_alert` créé dans Resend
- [ ] Tests alertes 1 & 4 exécutés sur staging
- [ ] Runbooks lus par tech lead + founder
- [ ] Owners briefés sur leurs alertes
- [ ] Backup owners briefés
- [ ] Test trimestriel ajouté au calendrier
- [ ] Document `09-runbook/escalation-i18n.md` mis à jour avec ces 6 alertes

## 11. KPIs des alertes (méta-monitoring)

| Méta-KPI | Target | Comment mesurer |
|---|---|---|
| Mean time to detect (MTTD) | < 5 min P0, < 1h P2 | Time first error → alert sent |
| Mean time to resolve (MTTR) | < 30 min P0, < 24h P2 | Time alert → resolve |
| False positive rate | < 10% | Manual review trimestriel |
| Alert response rate | > 95% sous SLA | PagerDuty ack stats |

→ Si false positive > 20% → revoir thresholds.
→ Si MTTR > 2× target → revoir runbooks.

## 12. Cross-références

- [`README.md`](./README.md) §7 — Owners matrix global
- [`kpis.md`](./kpis.md) §10 — Liste complète KPIs
- [`dashboards.md`](./dashboards.md) — Visualisation données pendant alerte
- [`09-runbook/`](../09-runbook/) — Runbooks détaillés (rollback, hotfix)
- [`07-tests/`](../07-tests/) — Tests qui devraient prévenir les alertes

---

→ Prochaine lecture : [`locale-detection-analytics.md`](./locale-detection-analytics.md)
