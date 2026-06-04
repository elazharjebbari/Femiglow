# Stratégie de test — audit analytics

Hérite des conventions de `docs/coupon-loyalty-qa-ui-2026-06-03/00-overview/` (types U/I/C/M/E/A/V,
schéma `test-cases.csv`, cycle MSW par fichier, `cd apps/web`). Spécificités analytics ci-dessous.

## Principe directeur — « tester sur des événements réalistes »
Le bug central est un **désalignement entre les événements réellement émis/stockés et ceux que
l'agrégation attend**. La batterie doit donc être pilotée par des **fixtures d'événements calquées sur
la prod** (cf. `00-overview/event-taxonomy.csv` + `evidence-db-2026-06-04.txt`) : on sème dans le
`memoryStore` un jeu d'événements *réaliste* (view_item, begin_checkout, add_to_cart, lead_capture,
generate_lead, purchase, address_completed… **sans** page_view/cta_impression/cta_click) et on vérifie
le comportement observable de chaque métrique.

## Deux familles de tests par finding
1. **Test de reproduction (rouge avant fix)** : avec le dataset réaliste actuel, la métrique renvoie la
   valeur ERRONÉE constatée (bounce=null, funnel checkout=0, dropoff=100%, CTA vide…). Marqué `// AVANT-FIX`.
2. **Test de spécification (vert après fix)** : avec le même dataset, après correction, la métrique
   renvoie la valeur CORRECTE attendue. C'est l'oracle cible.
Tant que le fix n'est pas livré, (2) est en `it.fails`/`todo` explicite référencé au finding ; (1) est vert.

## Couches
- **U/I (Vitest + memoryStore)** : cœur de l'audit — les fonctions d'agrégation (overview/funnel/cta/
  checkout/insights) testées sur fixtures d'événements. C'est là que se prouvent AN-01..AN-06.
- **A00 Taxonomie (I)** : l'ingestion `POST /api/track` — prouver que `pack_cta_click` est **rejeté**
  (unknown_event) et que `page_view`/`cta_click` n'ont pas d'émetteur ; vérifier le stockage verbatim.
- **C + MSW** : dashboards (Funnel/CTA/Checkout/Overview/Insights) via `analytics-handlers` MSW — états
  vide/erreur/peuplé + réactivité des filtres (AN-09).
- **E (Playwright)** : parcours opérateur sur `/admin/analytics/*` — non-régression bout-en-bout après fix.

## MSW
Créer `src/test/msw/analytics-handlers.ts` : handlers paramétrables pour
`/api/admin/analytics/{overview,funnel,funnel/sankey,cta,checkout,insights/*}` (réponses peuplées /
vides / 500 / latence). Cycle par fichier.

## Schéma `test-cases.csv` (identique)
`id,feature_id,titre,type,priorite,couche,preconditions,etapes,donnees,resultat_attendu,oracle,risque_couvert,fichier_test_cible`
- `id` = `ANNN-XSSS` (ex. `A03-I004`). `risque_couvert` référence un `AN-*`.

## Anti-flaky
Horloge figée (`NOW` fixe), faker seedé, MSW reset par fichier. Vitest anti-flaky = boucle 3× (pas de
`--repeat-each`, flag Playwright). Playwright `--repeat-each=2`.
