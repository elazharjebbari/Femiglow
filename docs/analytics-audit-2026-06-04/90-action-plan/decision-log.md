# Journal de décision & affinages — audit analytics

| id | date | sujet | décision/constat | source |
|---|---|---|---|---|
| D01 | 2026-06-04 | Preuve par introspection DB | 1005 events / 100% granted ; page_view=0, cta_*=0, view_cart=0 ; begin_checkout=97/purchase=13 présents mais non comptés | scripts/_analytics-introspect.ts |
| D02 | 2026-06-04 | AN-08 (revenu ÷100) | NON reproductible en agrégation : `readValueCents` multiplie déjà ×100 ; tout résidu est en couche affichage → reclassé non-régression | lecture cta.ts + cta.test.ts |
| D03 | 2026-06-04 | AN-09 (filtres figés) | DÉJÀ CORRIGÉ : `useAnalyticsFilters` dérive de `useSearchParams` (useMemo) + refetch ; reclassé non-régression | lecture useAnalyticsFilters + *.refetch.test.tsx |
| D04 | 2026-06-04 | AN-10 (fuseau) | DÉJÀ CORRIGÉ : `ANALYTICS_TIMEZONE='Africa/Casablanca'` + startOfDay via Intl ; reclassé non-régression | lecture filters.ts |
| D05 | 2026-06-04 | scroll_depth double désalignement | Le funnel attend `scroll_depth_50` mais l'ingestion ne connaît que `scroll_depth{percent_scrolled}` → fix sur 2 couches | lecture funnel.ts + schemas.ts |
| D06 | 2026-06-04 | checkout submit≡purchase | Pas d'event `submit` émis ; le code pose submit=true à l'arrivée du purchase → l'étape submit n'est pas un vrai signal de soumission | lecture checkout.ts |
| D07 | 2026-06-04 | Stratégie fix taxonomie | Préférer la NORMALISATION à l'ingestion (pack_cta_click→cta_click, etc.) pour ne pas perdre l'historique et rester rétro-compatible | action-plan W1 |

## Bugs produit confirmés (registre = findings-register.csv)
AN-01, AN-02, AN-03, AN-04, AN-05, AN-06, AN-07, AN-11 (P0/P1 actifs). AN-08/09/10 = déjà corrigés (non-régression).

## Bilan d'exécution (W-A → W-D, 2026-06-04)
Corrections livrées (agrégation d'abord — zéro risque tracking prod) :
- **W-A** — `funnel.ts` : modèle **monotonic** (le jalon le plus avancé implique les précédents) +
  `classifyStage` élargi (checkout = begin_checkout/checkout_intent/add_shipping_info/address_completed/
  add_payment_info ; purchase = purchase **OR** generate_lead) ⇒ AN-02, AN-06. `overview.ts` : `view_item`
  reconnu comme page-vue (bounce/topPages/series/pageViews) + filtre consentement ⇒ AN-01, AN-07.
  `checkout.ts` : `address_completed`→add_shipping, `checkout_intent`→begin_checkout ⇒ AN-04.
- **W-B** — `filters.ts` : device défaut **all** (schema + DEFAULT_FILTERS) ⇒ AN-11.
- **W-C** — ingestion : schémas `cta_click`/`cta_impression` + normalisation `*_cta_click`→`cta_click`
  (payload `_src_event` conservé) ⇒ AN-03 (clics CTA désormais acceptés/stockés/comptés en funnel cta).
- **AN-05** (insights vides) = **action ops** (refresh matviews), pas un défaut de code → runbook §3.
- **AN-08/09/10** = déjà corrigés (non-régression).

Tests : funnel 21, overview/checkout/cta/audit + perimeter **466 tests + 7 todo verts** ; ingestion
non-régression 30 ; typecheck 0 ; lint 0.

## Dette résiduelle / suites (émission client — follow-up)
- **page_view** : on a aligné l'agrégation sur `view_item` (lecture). Émettre un vrai `page_view`
  générique reste souhaitable (cohérence GA4/providers) — décision produit.
- **CTA tab** : les clics sont désormais ingérés en `cta_click` ; pour peupler les **lignes par
  composant** + les **impressions**, émettre `component_id` sur les clics et un `cta_impression`
  (IntersectionObserver). La normalisation rend l'historique futur exploitable.
- **view_cart** / **checkout_submit** : à émettre pour compléter les 1ʳᵉ/avant-dernière étapes checkout.
- **Insights** : déclencher / vérifier le cron de refresh des matviews en prod (runbook §3).
