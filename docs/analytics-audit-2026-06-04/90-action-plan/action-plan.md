# Plan d'action — correction du module Analytics

> Méthode par vagues + porte de qualité + boucle de correction (cf.
> `docs/coupon-loyalty-qa-ui-2026-06-03/90-action-plan`). Tout depuis `apps/web/`.
> Doctrine : chaque finding P0/P1 a un **test de reproduction (rouge avant)** et un **test de spec (vert après)**.
> Ordre choisi : **on répare l'amont (émission/ingestion) avant l'agrégation, l'agrégation avant l'UI.**

## Vagues

| Vague | Objet | Findings | Couche | Gate |
|---|---|---|---|---|
| **W0** | Fondations test : MSW analytics-handlers + fixtures réalistes + **tests de reproduction** (prouvent les bugs) | tous | M+I | reproduction verte (bugs prouvés) |
| **W1** | **Émission + ingestion** (taxonomie) | AN-01, AN-03, AN-02(engage) | client+ingest | events critiques émis & stockés |
| **W2** | **Agrégation** (mappings + modèle funnel + consentement) | AN-02, AN-04, AN-06, AN-07 | lib/analytics/queries | tests de spec verts |
| **W3** | **Insights + filtres** | AN-05, AN-11 | insights + filters | insights peuplé ; device=all |
| **W4** | **Composants + E2E + durcissement** | transverse | C+E | dashboards peuplés ; anti-flaky ; typecheck/lint 0 |

## Détail

### W0 — Fondations & preuve
- `src/test/msw/analytics-handlers.ts` : handlers `/api/admin/analytics/{overview,funnel,funnel/sankey,cta,checkout,insights/*}` (peuplé/vide/500/latence).
- Fixtures d'événements **réalistes** (event-taxonomy.csv) : helper `seedRealisticEvents()` (view_item, begin_checkout, add_to_cart, lead_capture, generate_lead, add_payment_info, address_completed, purchase — **sans** page_view/cta_*/scroll_depth).
- **Tests de reproduction** (verts maintenant) : prouvent bounce=null, topPages=[], funnel checkout/purchase=0, dropoff=100%, CTA vide, checkout add_shipping=4 (address_completed ignoré), ingest rejette pack_cta_click.

### W1 — Émission + ingestion (le plus en amont)
- **AN-01** : émettre `page_view` à chaque navigation (ou décider que `view_item`+page_route est la source et aligner overview/bounce/topPages). Choix recommandé : émettre un vrai `page_view` générique (schéma déjà présent) côté layout client.
- **AN-03** : ajouter schémas `cta_click` + `cta_impression` (avec `component_id`) ; émettre depuis `CommanderAnchorButton`/CTAs (remplacer/compléter `pack_cta_click`) **OU** normaliser `pack_cta_click→cta_click` + `*_cta_click→cta_click` à l'ingestion. Recommandé : normalisation à l'ingestion (rétro-compatible, ne perd pas l'historique d'émission).
- **AN-02 (engage)** : aligner `scroll_depth_50` ↔ `scroll_depth{percent_scrolled:50}` (double couche : schéma ingestion + reconnaissance dans `isEngageEvent`). Émettre `scroll_depth` et/ou `cta_impression`.

### W2 — Agrégation
- **AN-02 (modèle)** : assouplir le funnel cumulatif strict — compter chaque étape par OR de signaux disponibles (ne pas exiger toute la cascade amont), ou rendre « engage » optionnel. Objectif : begin_checkout(97)/purchase(13) **comptés**.
- **AN-04** : `classifyEvent` checkout → mapper `address_completed→add_shipping`, `lead_capture/checkout_intent→begin_checkout` ; définir `view_cart`/`submit`.
- **AN-06** : étape funnel `purchase = purchase OR generate_lead` (config sémantique COD).
- **AN-07** : ajouter `analytics_storage='granted'` au `fetchEvents` d'overview (cohérence inter-onglets).

### W3 — Insights + filtres
- **AN-05** : déclencher le refresh des matviews (cron/endpoint) ; dans l'UI distinguer « matview non rafraîchie » de « aucun trafic ».
- **AN-11** : `DEFAULT_FILTERS.device='all'` + `AnalyticsFiltersSchema.device.default('all')`.

### W4 — Composants + E2E + durcissement
- Tests de spec verts (après fixes). Composants dashboards via MSW (peuplé). E2E `/admin/analytics/*`. Anti-flaky 3×, typecheck+lint 0, traçabilité.

## Boucle de correction
Identique aux dossiers précédents : écrire test repro (vert, prouve le bug) → livrer le fix → le test de spec passe au vert → non-régression du périmètre analytics → anti-flaky. Tout finding révélé en plus → `decision-log.md`.

## Note de cadrage (risque)
La couche d'émission/ingestion (W1) touche le tracking **de production** (revenu pub/ROAS en dépend). Toute modif passe par : test repro → fix → test spec → vérif introspection DB (`scripts/_analytics-introspect.ts`) sur preview avant prod. Voir `99-runbook/runbook.md`.
