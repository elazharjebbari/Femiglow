# 10 — Monitoring i18n

> Tout ce qui se mesure, se pilote. Ce dossier définit **comment FemiGlow observe sa stratégie i18n** : KPIs, dashboards, alertes, analytics de détection de locale.

## 1. TL;DR (lecture 2 min)

L'i18n n'est pas un projet "ship and forget". Sans monitoring continu :
- Les **traductions manquantes** se cumulent silencieusement → fallback FR partout en AR/EN
- Les **bundle sizes** dérivent → LCP dégradé sur mobile 3G marocain
- Les **switchers** ne sont pas utilisés → on dépense en traduction inutilement
- Les **redirects locale** cassent → impact SEO sans bruit immédiat

**Notre approche** :
1. **Sentry** = erreurs runtime + missing keys (déjà en prod)
2. **Tracking events table** = `tracking_events_log` (déjà en prod) — events locale custom
3. **Vercel Analytics** = Web Vitals par locale (déjà en prod)
4. **GA4** = funnel + conversion par locale (déjà en prod)
5. **Meta CAPI** = attribution (déjà en prod, pas spécifique i18n)
6. **Dashboard custom** `/admin/i18n/dashboard` (cf. [`03-backend/api-routes.md`](../03-backend/api-routes.md) §3.1) — vue interne pour la fondatrice + tech lead

**Pas de nouvelle stack** : on capitalise sur l'existant.

## 2. Fichiers du dossier

| Fichier | Contenu | Audience | Lecture |
|---|---|---|---|
| [`README.md`](./README.md) | Ce fichier — index + TL;DR + dashboards primaires | Tous | 5 min |
| [`kpis.md`](./kpis.md) | Catalogue KPIs (adoption, coverage, quality, perf, UX, SEO, business) + formules + alertes | Lead tech + founder | 20 min |
| [`dashboards.md`](./dashboards.md) | Spec 4 dashboards (Health, Adoption, SEO, Performance) + widgets + queries | Lead tech | 20 min |
| [`alerts.md`](./alerts.md) | 6 alertes critiques + conditions + runbooks + escalation | Lead tech + on-call | 15 min |
| [`locale-detection-analytics.md`](./locale-detection-analytics.md) | Analytics spécifiques détection locale (events, schema, queries SQL) | Data analyst + tech | 25 min |

## 3. Stack monitoring — vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (visiteur fr/ar/en)                                     │
│  - Web Vitals beacon → Vercel Analytics                         │
│  - GA4 events (purchase, view_item)                             │
│  - Custom events (locale_changed) → /api/tracking/events        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Next.js (Vercel)                                                │
│  - middleware.ts → emit locale_detected event                   │
│  - Sentry SDK → erreurs JS + missing keys                       │
│  - /api/tracking/events → insert tracking_events_log            │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────────┐
        ▼            ▼            ▼                ▼
┌──────────────┐ ┌────────┐ ┌──────────────┐ ┌──────────────────┐
│ Sentry       │ │ GA4    │ │ tracking_    │ │ Vercel Analytics │
│ - errors     │ │ - funn │ │ events_log   │ │ - LCP/CLS/INP    │
│ - missing_   │ │ - conv │ │ (Postgres)   │ │ - par route      │
│   key events │ │ - rev  │ │  - custom    │ │ - par locale     │
└──────┬───────┘ └────┬───┘ └──────┬───────┘ └────────┬─────────┘
       │              │            │                   │
       └──────────────┴────────────┴───────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ /admin/i18n/dashboard       │
              │  - Coverage par locale      │
              │  - Missing keys list        │
              │  - Adoption par locale      │
              │  - Web Vitals par locale    │
              └─────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Slack #i18n + email founder │
              │ - Alertes automatiques      │
              └─────────────────────────────┘
```

## 4. Dashboards primaires

### 4.1 Vue d'ensemble (4 dashboards)

| # | Dashboard | URL | Audience | Refresh |
|---|---|---|---|---|
| 1 | **i18n Health** | `/admin/i18n/dashboard?tab=health` | Tech lead + traducteur | 60s |
| 2 | **i18n Adoption** | `/admin/i18n/dashboard?tab=adoption` | Founder + marketing | 5 min |
| 3 | **i18n SEO** | `/admin/i18n/dashboard?tab=seo` | Marketing + SEO | 1h (GSC cache) |
| 4 | **i18n Performance** | `/admin/i18n/dashboard?tab=perf` | Tech lead | 5 min |

→ Détails complets : [`dashboards.md`](./dashboards.md)

### 4.2 Layout principal (`/admin/i18n/dashboard`)

```
┌──────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — FemiGlow                            [⟳ Refresh] │
├──────────────────────────────────────────────────────────────────┤
│ [Health] [Adoption] [SEO] [Performance]              7d ▼  Live ●│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │ Coverage             │  │ Missing keys (24h)   │              │
│  │ FR 100% ████████████ │  │ ⚠ marketing.cta_v2   │              │
│  │ AR  78% █████████▒▒▒ │  │   3 occurrences      │              │
│  │ EN  45% █████▒▒▒▒▒▒▒ │  │ ⚠ wizard.label.foo   │              │
│  └──────────────────────┘  └──────────────────────┘              │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │ Adoption (7d)        │  │ Quality score        │              │
│  │ FR ████████████ 72%  │  │ Reviewed AR  56%     │              │
│  │ AR ████▒▒▒▒▒▒▒▒ 19%  │  │ Reviewed EN  34%     │              │
│  │ EN ████▒▒▒▒▒▒▒▒  9%  │  │ Fallback rate 2.3%   │              │
│  └──────────────────────┘  └──────────────────────┘              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Sources de données

### 5.1 Inventaire complet

| Source | Donnée | Latence | Coût | Rétention |
|---|---|---|---|---|
| **Sentry** | Erreurs JS + missing_key events | <1 min | Plan Team (existant) | 90j |
| **`tracking_events_log` (Postgres)** | Events custom (locale_detected, locale_changed) | <5s | Inclus DB | 12 mois |
| **Vercel Analytics** | Web Vitals (LCP/CLS/INP/FCP/TTFB) | <2 min | Plan Pro (existant) | 30j |
| **GA4** | Pageviews, funnel, transactions par locale | 24h (BigQuery export) | Free tier | 14 mois |
| **Google Search Console** | Impressions, CTR, position par locale | 48h | Free | 16 mois |
| **`i18n_translation_keys` + `_values`** | Coverage, missing, reviewed status | Live | Inclus DB | Permanent |

### 5.2 Tags / dimensions communes

Pour pouvoir croiser les sources, on impose ces dimensions partout :

| Dimension | Valeurs | Source de vérité |
|---|---|---|
| `locale` | `fr` / `ar` / `en` | Cookie `NEXT_LOCALE` ou path `/[locale]/...` |
| `route` | `/[locale]/kit`, `/[locale]/checkout/lead` | Pathname Next.js |
| `device` | `mobile` / `tablet` / `desktop` | User-Agent parsing |
| `country` | `MA`, `FR`, `US`... | `request.geo.country` (Vercel Edge) |
| `referrer_type` | `direct` / `organic` / `paid` / `social` | UTM + referrer |

**Pourquoi imposer** : sans `locale` tagué sur **toutes** les sources, impossible de répondre "le LCP en AR est-il pire qu'en FR ?".

## 6. Frequency / cadence

### 6.1 Cadence d'observation

| Fréquence | Quoi | Qui |
|---|---|---|
| **Temps réel (live)** | Alertes Sentry (missing_key spike), erreurs 5xx par locale | On-call tech |
| **Toutes les 5 min** | Refresh dashboard `/admin/i18n/dashboard` | Tech lead pendant ship |
| **Daily (9h, async)** | Digest Slack #i18n : coverage, missing keys du jour, top events | Tech lead |
| **Weekly (lundi 10h)** | Revue KPIs adoption + conversion par locale | Founder + tech lead |
| **Monthly** | Revue SEO (GSC) + bilan business par locale + décisions (ouvrir ES ?) | Founder + marketing |
| **Quarterly** | Audit complet i18n : retours, ROI, roadmap langues | Founder + lead tech |

### 6.2 Rituels associés

- **Lundi 10h** : "i18n review" — 30 min sur dashboard adoption + SEO
- **Vendredi 16h** : "Translation sync" — coverage check + push CSV aux traducteurs
- **Sprint review (bi-weekly)** : revue alertes triggered + suivi runbooks

## 7. Owner matrix

| Domaine | Owner principal | Backup | Escalation |
|---|---|---|---|
| Coverage / missing keys | Lead tech | Traducteur | Founder |
| Sentry alerts | Tech lead | Dev | Founder |
| Performance par locale | Tech lead | — | Founder |
| Adoption / business KPIs | Founder | Marketing | — |
| SEO impressions / hreflang | Marketing | Tech lead | Founder |
| Switcher UX | UX designer | Founder | — |

→ Détails escalation par alerte : [`alerts.md`](./alerts.md) §3.

## 8. Pièges monitoring courants

| Piège | Symptôme | Remède |
|---|---|---|
| **"On track tout, on regarde rien"** | 80 KPIs, 0 décision | Choisir 5 KPIs nord-étoile (cf. §4 dans [`kpis.md`](./kpis.md)) |
| **Alertes en silence** | Slack bruyant → mute → ratent les vraies | Severity ladder + page test mensuel |
| **Locale non taguée sur Web Vitals** | Impossible de comparer LCP fr vs ar | Imposer `locale` en custom dimension Vercel Analytics |
| **Missing key affiche la clé brute en prod** | `marketing.hero.cta_v2` visible sur le site | Fallback FR systématique (cf. naming-conventions) |
| **Coverage à 100% mais pas reviewed** | Traductions auto via DeepL pas relues → fautes | Distinguer `translated` vs `reviewed` (cf. data-model `i18n_translation_values.reviewed`) |
| **Bundle size mesuré global, pas par locale** | AR + chargé inutilement par utilisateur FR | Mesurer `.next/static/chunks/messages-*.js` par locale |
| **GA4 sans `locale` custom dimension** | Conversion par locale impossible à calculer | Setup dans GA4 admin (1 fois, immutable) |
| **Sentry inonde sur 1 erreur** | 1000 events same fingerprint | Sentry sampling + grouping rules |

## 9. État initial (T0 — avant ship Phase 1)

À la fin de la phase 0 (étude validée), on devrait avoir :

- [x] Cette doc validée par founder
- [ ] Sentry custom tag `locale` configuré (zero code change, juste config Sentry init)
- [ ] GA4 custom dimension `locale` créée
- [ ] Vercel Analytics : Web Vitals annotation `locale` (via beacon custom)
- [ ] Endpoint `/api/i18n/coverage` shippé (cf. `03-backend/api-routes.md` §3.1)
- [ ] Endpoint `/api/i18n/missing-keys` shippé
- [ ] Slack channel `#i18n` créé
- [ ] Page `/admin/i18n/dashboard` créée avec 4 tabs vides

## 10. Roadmap monitoring (cohérent avec `08-plan-action/`)

| Phase | Monitoring | Effort |
|---|---|---|
| **Phase 1 — Foundation** | Sentry tag locale + dashboard health (coverage seulement) | 0.5 j |
| **Phase 2 — Content extraction** | Ajouter tab "Missing keys" + alerte Sentry missing_key | 1 j |
| **Phase 3 — CMS multilingue** | Ajouter coverage CMS components | 0.5 j |
| **Phase 4 — RTL + AR** | Tab adoption + locale_detection events | 1 j |
| **Phase 5 — Workflow translateur** | Coverage emails + reviewed % | 0.5 j |
| **Phase 6 — Tests + QA** | Dashboard QA temporaire (regressions visuelles) | 0.5 j |
| **Phase 7 — Deploy + obs 30j** | Toutes les 6 alertes actives, runbooks rodés | 1 j |
| **Total monitoring** | | ~5 j sur 11 sem |

## 11. Cross-références internes

- [`02-design-conception/locale-detection.md`](../02-design-conception/locale-detection.md) §9 — Events à tracker (source décision)
- [`03-backend/api-routes.md`](../03-backend/api-routes.md) §3.1-3.2 — Endpoints `coverage` et `missing-keys`
- [`03-backend/translation-store.md`](../03-backend/translation-store.md) — Schéma DB i18n
- [`08-plan-action/phases.md`](../08-plan-action/phases.md) — Plan rollout
- [`09-runbook/`](../09-runbook/) — Runbooks référencés par les alertes

## 12. Cross-références externes (outils existants)

| Outil | URL projet | Compte / Plan |
|---|---|---|
| Sentry | `https://sentry.io/organizations/femiglow/issues/` | Team plan |
| Vercel Analytics | `https://vercel.com/femiglow/web/analytics` | Pro (inclus) |
| GA4 | `https://analytics.google.com/analytics/web/#/p<XXX>` | Free tier |
| Google Search Console | `https://search.google.com/search-console?resource_id=sc-domain:femiglow.ma` | Free |
| Slack #i18n | `slack://channel?team=T<XXX>&id=C<XXX>` | Workspace existant |
| Postgres (`tracking_events_log`) | `postgres://...` (var `DATABASE_URL`) | Neon prod |

## 13. Checklist — avant ship Phase 1

- [ ] Lu cette doc README en entier
- [ ] Lu [`kpis.md`](./kpis.md) (au moins TL;DR + KPIs nord-étoile)
- [ ] Lu [`alerts.md`](./alerts.md) (toutes les alertes — 15 min)
- [ ] Sentry custom tag `locale` configuré et testé en staging
- [ ] GA4 custom dimension `locale` créée et linked à events
- [ ] Vercel Analytics : custom property `locale` envoyée via `beforeSendEvent`
- [ ] Endpoints `/api/i18n/coverage` + `/api/i18n/missing-keys` reachable
- [ ] `/admin/i18n/dashboard` accessible (même vide)
- [ ] Slack `#i18n` créé + 2 humains dedans (tech lead + founder)
- [ ] Webhooks Slack configurés (incoming webhook URL stocké en var d'env `SLACK_I18N_WEBHOOK`)
- [ ] Alerte test "[TEST] hello from staging" déclenchée → reçue dans #i18n
- [ ] Runbooks lus par on-call ([`09-runbook/`](../09-runbook/))

## 14. Anti-objectifs (pas de monitoring i18n pour…)

Pour éviter le scope creep :

- **Sentiment analysis** sur reviews traduites — pas V1, trop tôt
- **A/B test automatique de traductions** — manuel via Vercel preview
- **Détection auto de fautes d'orthographe** dans messages — review humaine suffit V1
- **Monitoring par user (heatmaps par locale)** — Hotjar non installé, pas prio
- **Alerting LCP par device par locale par country** — granularité excessive V1, sample size trop bas
- **Logs trail complet des switchers (qui switche vers quoi, quand)** — RGPD + pas d'usage business V1

Ces sujets reviendront éventuellement en V2/V3 quand on aura les **vrais** problèmes mesurés.

## 15. Comparaison "avec / sans monitoring"

Pour convaincre la fondatrice du ROI du monitoring (effort ~5 j sur 11 sem) :

| Scénario | Sans monitoring | Avec monitoring |
|---|---|---|
| Une clé `marketing.cta_v2` manque en AR depuis 3 sem | Détecté par un client AR via mail "votre site bug" | Détecté en 5 min par Sentry, fix en 1h |
| Le bundle AR passe à 50 KB après un import bug | LCP AR dégradé, conversion AR chute en silence | CI fail au PR, jamais en prod |
| Les visiteurs marocains préfèrent AR mais sont servis FR | Bounce AR élevé sans cause identifiée | Query §5.4 dans `locale-detection-analytics.md` révèle le bug détection |
| Hreflang cassé par un deploy | -30% impressions en 2 sem, raison inconnue 1 mois | Alerte SEO en 24h, fix avant impact CA |
| AR conversion est 40% en dessous de FR | "Le marché AR est moins mature, normal" → on accepte | Identifié, audit copy + UX AR, conv remonte |
| Le switcher est dans le footer et personne ne le voit | Aucun feedback, impression d'inutilité | Switcher usage = 0.5% → décision UX (header ?) |

**ROI estimé** : 5 jours d'effort vs ~2 sem de perte productivité + revenue manqué chaque trimestre sans monitoring.

## 16. Quick wins — implémentation minimale viable

Si on doit shipper la doc minimale et y revenir plus tard :

### Quick win 1 — Sentry tag locale (effort : 1h)

Ajouter dans `Sentry.init()` :

```typescript
// REF — pas à shipper ici
Sentry.setTag('locale', getLocaleFromPath(window.location.pathname));
```

**Impact** : tous les events Sentry sont taggués par locale → on peut filtrer immédiatement.

### Quick win 2 — Coverage endpoint (effort : 4h)

Endpoint `/api/i18n/coverage` (cf. `03-backend/api-routes.md`) + page admin minimal `/admin/i18n/dashboard` avec 3 KPI cards.

**Impact** : visibilité coverage immédiate, founder peut piloter trad effort.

### Quick win 3 — Custom event locale_detected (effort : 2h)

Émettre l'event dans middleware. Pas de queries dashboard tout de suite.

**Impact** : on accumule du data. Quand on aura le dashboard adoption (Phase 4), on aura 3 mois d'historique.

**Total quick wins** : 7h = 1 jour, et on a 80% de la visibilité essentielle.

## 17. Glossaire monitoring (rappel)

| Terme | Définition rapide |
|---|---|
| **Coverage** | % de clés actives ayant une valeur dans une locale (peu importe la qualité) |
| **Reviewed** | Coverage + humain a validé la qualité |
| **Missing key** | Clé demandée par le code mais absente du dictionnaire — bug code |
| **Fallback** | Affichage de FR pour une clé AR/EN non traduite — pas un bug |
| **Locale detection** | Algo middleware qui résout la locale (cf. `02-design-conception/locale-detection.md`) |
| **Switcher** | UI permettant à l'utilisateur de changer la langue |
| **LCP** | Largest Contentful Paint — temps de chargement perçu (Web Vitals) |
| **CLS** | Cumulative Layout Shift — stabilité visuelle (Web Vitals) |
| **INP** | Interaction to Next Paint — réactivité (Web Vitals) |
| **p75** | 75e percentile — 75% des mesures sont meilleures que cette valeur |
| **pp** | Points de pourcentage (différence absolue entre 2 pourcentages) |
| **MoM** | Month over Month |
| **WoW** | Week over Week |
| **GSC** | Google Search Console |
| **TMS** | Translation Management System |
| **MTTD** | Mean Time To Detect (alerte → notification) |
| **MTTR** | Mean Time To Resolve (alerte → fix) |
| **P0/P1/P2/P3** | Severity ladder — P0 critical, P3 low |
| **Severity** | Niveau d'urgence d'une alerte |
| **Cooldown** | Délai après alerte pendant lequel elle ne se re-déclenche pas |
| **Dedupe** | Évitement de doublons d'alertes pour même event |
| **Runbook** | Procédure documentée à suivre quand une alerte arrive |

## 18. FAQ monitoring i18n

### Q1. Pourquoi pas Datadog / New Relic ?

A. Coût + setup. On a déjà Sentry + Vercel Analytics + GA4 (combined cost ~0$/mois en plan team). Datadog SaaS = ~200$/mois min. Le projet ne le justifie pas V1.

### Q2. Et si on grossit ? Migration possible ?

A. Oui. `tracking_events_log` est exportable. Sentry tags `locale` portable vers tout APM. Dashboards custom = code Next.js, jetable et reconstructible. Vendor lock-in minime.

### Q3. Comment on s'assure que `locale` est bien tagué partout ?

A. Test E2E dédié : `it('emits Sentry event with locale tag', ...)`. Cf. `07-tests/`.

### Q4. La fondatrice ne lit pas Sentry. Comment elle voit l'état ?

A. Dashboard `/admin/i18n/dashboard?tab=health` est fait pour elle. Plus le weekly digest email (Phase 5).

### Q5. Faut-il versionner les KPIs ?

A. Oui. Les targets V1 changeront en V2/V3. On garde la trace dans ce doc (cf. `kpis.md` §13).

### Q6. Que faire si une métrique est manquante (data hole) ?

A. Investigate root cause. Si data source down (Vercel/GSC), wait + back-fill. Si bug code (event pas émis), fix et redéployer. Ne pas falsifier les KPIs.

### Q7. Comment gérer les bots dans les analytics ?

A. Bot detection au middleware. Flag `isBot` dans payload. Filtrer `WHERE isBot = false` dans toutes les queries adoption/UX. Garder bots dans coverage/perf (ils consomment aussi).

### Q8. Que fait-on si Sentry est down ?

A. Cas peu fréquent (Sentry > 99.9% uptime). Si arrive : alertes 1 et 4 dégradées. Fallback : queries SQL manuelles sur `tracking_events_log` (qui héberge aussi error events si on en émet).

### Q9. Combien de temps avant d'avoir des KPIs significatifs ?

A. ~30 jours pour data Web Vitals stable. ~60 jours pour SEO (GSC). ~7 jours pour coverage/adoption (réagit vite).

### Q10. Les analytics RGPD sont-elles compliant ?

A. Oui pour usage interne. Cf. `locale-detection-analytics.md` §8. Pas d'opt-in nécessaire pour cookie `NEXT_LOCALE` (fonctionnel). `session_id` peudo-anonyme + IP hashée après 30j.

## 19. Notes pour la fondatrice

**TL;DR pour décideur non-tech** :

- Le monitoring i18n **coûte 5 jours sur 11 semaines** de projet i18n (~5% effort).
- Sans monitoring, **on découvre les problèmes via les clients** (mauvais ROI).
- Avec monitoring, **on détecte en 5 min**, on fix en 1h.
- 1 dashboard interne `/admin/i18n/dashboard` permet de **voir l'état en 1 clic**.
- Email hebdo avec les KPIs business (adoption, conversion par locale) **dès Phase 5**.
- Alertes Slack pour problèmes critiques, **pas de surchage**.
- **Décision V2** (ouvrir ES ? désactiver EN ?) **data-driven** au lieu d'au flair.

**Question à valider par founder** :

- [ ] OK pour créer Slack channel #i18n et m'y intégrer ?
- [ ] OK pour weekly digest email tous les lundis 9h ?
- [ ] OK pour data tracking via cookie technique (pas d'opt-in cookie banner) ?
- [ ] Targets V1 réalistes (AR=20%, EN=10% adoption) ou trop optimistes ?
- [ ] OK pour effort 5 jours sur le total 11 sem ?

---

→ Prochaine lecture : [`kpis.md`](./kpis.md)
