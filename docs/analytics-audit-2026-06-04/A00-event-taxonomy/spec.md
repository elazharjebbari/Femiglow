# A00 — Taxonomie des événements : émis → stocké → attendu (ingestion `POST /api/track`)

## Rôle & surface
Contrat de **nommage** des événements analytics, vu du point d'ingestion. Surface : route
`apps/web/src/app/api/track/route.ts` (validation `incomingEventSchema` → `getValidator(event.event)`
→ persistance `logEvent`) et le registre de schémas `apps/web/src/lib/tracking/schemas.ts`
(`eventSchemas`, `getEventSchema`, `getEventCategory`). C'est la **frontière** où un nom d'événement
est soit accepté et stocké *verbatim* dans `tracking_events_log.event_name`, soit **rejeté**
(`tracking.ingest.unknown_event`). Toute la chaîne analytics (funnel/CTA/checkout/overview) agrège
ensuite sur ces noms : un nom rejeté ou mal aligné = colonne morte dans les dashboards.

Cette feature est **transverse** : elle est la cause racine commune de AN-01/AN-02/AN-03/AN-04. Elle
n'a pas de fonction d'agrégation propre ; les tests prouvent le **comportement d'ingestion** (accept /
reject / stockage verbatim) qui détermine ce que les autres features peuvent voir.

## Fonctionnement optimal (ce qui DOIT se passer)
1. Tout événement réellement émis par le front a un schéma dans `eventSchemas` ⇒ `getValidator` non
   nul ⇒ accepté (HTTP 202, `accepted += 1`), `event_name` stocké **verbatim** (`logEvent({ eventName:
   event.event, … })`, route L279) et `is_conversion` positionné si `event.event ∈ CONVERSION_EVENTS`.
2. Le nom stocké est **exactement** celui attendu par l'agrégation cible (alignement émis↔attendu) :
   - vue produit `/kit` ⇒ `view_item` (✓ aligné, funnel `view`).
   - clic CTA d'achat ⇒ un nom **reconnu** par `funnel.classifyStage` (`add_to_cart` ou `cta_click`
     avec `cta_intent='purchase'`) ET par `cta.ts` (`cta_click` pour les clics, `cta_impression` pour
     les affichages).
   - conversion lead ⇒ `generate_lead` ET/OU `lead_capture` reconnus et marqués conversion.
3. Les compteurs de retour (`{ accepted, rejected, duplicates }`, route L330) reflètent fidèlement le
   sort de chaque event ⇒ un nom inconnu doit faire `rejected += 1` (jamais accepté en silence).
4. `CONVERSION_EVENTS` (route L36-42) couvre **tous** les événements de conversion réellement utiles
   au tunnel COD : `purchase`, `generate_lead`, `sign_up`, `begin_checkout`, `lead_capture`.

## Contrat I/O
- Entrée : `POST /api/track` body `{ events: [{ event, event_id, consent, page, user, params?, … }] }`
  (`batchSchema`, min 1 / max 50). `event` ∈ string(1..80).
- Validation : `getValidator(event.event)` = `eventSchemas[event.event] ?? null`. Si `null` →
  `result.rejected += 1` + `logger.warn('tracking.ingest.unknown_event', { event_name })` + `continue`
  (route L173-178). Sinon `validator.safeParse(params)` ; échec → `rejected` + `invalid_params`.
- Sortie : `202` `{ ok:true, accepted, rejected, duplicates }`. Stockage : `logEvent` ⇒
  `tracking_events_log.event_name = event.event` **sans transformation**, `event_category =
  getEventCategory(event.event)` (défaut `'custom'`), `is_conversion = CONVERSION_EVENTS.has(event.event)`.

## Cas limites & non-happy-path (preuves DB, fenêtre 90j, 1005 events, 100% granted)
- **`pack_cta_click` / `video_cta_click` / `composition_post_cta_click` : ABSENTS de `eventSchemas`**
  ⇒ `getValidator` renvoie `null` ⇒ **REJETÉS** (`unknown_event`). DB : count **0** pour les trois.
  Les vrais clics CTA sont donc émis sous ces noms (cf. `CommanderAnchorButton`) et **n'arrivent jamais
  en base** → onglet CTA vide + funnel `cta` non alimenté par les clics (AN-03).
- **`page_view` : schéma présent (`eventSchemas.page_view`, L45) mais count DB = 0** ⇒ aucun émetteur
  générique ne le déclenche. Le schéma existe, l'émission n'existe pas. (AN-01 : casse bounce + topPages.)
- **`cta_impression` : AUCUN schéma dans `eventSchemas`** (grep négatif) ⇒ même s'il était émis il serait
  rejeté ; et il n'est de toute façon pas émis (DB=0). Double absence. (AN-02 engage + AN-03 impressions.)
- **`scroll_depth_50` : pas de schéma** (seul `scroll_depth` existe, avec `percent_scrolled ∈ {25,50,75,90}`).
  Le funnel `isEngageEvent` attend pourtant le nom dérivé `scroll_depth_50` (funnel.ts L113) → désalignement :
  même un `scroll_depth { percent_scrolled:50 }` stocké ne déclencherait pas `engage`. DB : `scroll_depth=0`
  ET `scroll_depth_50=0`. (AN-02.)
- **`checkout_intent` / `purchase_server` / `view_cart` : pas de schéma OU jamais émis** ⇒ DB=0.
- **`CONVERSION_EVENTS` n'inclut PAS `checkout_intent`** (ni `add_to_cart`) : ces events, s'ils
  arrivaient, seraient stockés avec `is_conversion=false`. Gap documenté pour cohérence (`checkout_intent`
  est une variante de `begin_checkout` qui, lui, EST dans `CONVERSION_EVENTS`).
- Stockage **verbatim** : un nom valide (`view_item`, `begin_checkout`, `address_completed`…) est
  écrit tel quel, sans mapping/normalisation à l'ingestion. Conséquence : tout désalignement émis↔attendu
  doit être corrigé soit côté émetteur, soit côté agrégation — **pas** à l'ingestion (état actuel).

## Invariants couverts
- INV (taxonomie) : `event_name` stocké = `event.event` émis, verbatim (pas de normalisation ingest).
- INV (rejet) : nom hors `eventSchemas` ⇒ `rejected`, jamais persisté.
- Lacunes d'audit adressées : **AN-03** (pack_cta_click rejeté), **AN-01** (page_view sans émetteur),
  **AN-02** (cta_impression/scroll_depth_50 inconnus ou absents), gap **CONVERSION_EVENTS/checkout_intent**.

## Critères d'acceptation (observables)
- `POST /api/track` avec `event:'pack_cta_click'` ⇒ réponse `rejected:1, accepted:0` et **aucune** ligne
  dans `memoryStore.trackingEventsLog` ; `getEventSchema('pack_cta_click') === null`.
- `getEventSchema('cta_impression') === null` ; `getEventSchema('scroll_depth_50') === null`.
- `POST /api/track` avec `event:'view_item'` ⇒ `accepted:1` et une ligne `event_name:'view_item'` verbatim.
- `CONVERSION_EVENTS.has('checkout_intent') === false` (gap) ; `CONVERSION_EVENTS.has('begin_checkout') === true`.
- `[SPEC après-fix]` `getEventSchema('cta_click') !== null` et un `event:'cta_click'` est `accepted` + stocké ;
  `pack_cta_click` soit accepté soit normalisé vers `cta_click` à l'ingestion (selon fix retenu AN-03).

## Points à vérifier — tous points de vue
- **Backend** : `getValidator`/`eventSchemas` (présence des noms `cta_click`, `cta_impression`,
  `scroll_depth_50`/`scroll_depth+percent`) ; `CONVERSION_EVENTS` complet ; pas de normalisation silencieuse.
- **Frontend** : émetteurs réels — `page_view` jamais fire ; clics CTA sous `pack_cta_click` & co.
  (`CommanderAnchorButton`) au lieu de `cta_click` ; `cta_impression` jamais fire.
- **UI/UX/design** : conséquence opérateur — dashboards vides interprétés comme « pas de trafic ».
- **Data** : `tracking_events_log.event_name` verbatim ; `is_conversion` dérivé de `CONVERSION_EVENTS` ;
  `event_category` via `getEventCategory` (défaut `custom`).
- **A11y / i18n** : sans objet (couche ingestion, pas d'UI).
