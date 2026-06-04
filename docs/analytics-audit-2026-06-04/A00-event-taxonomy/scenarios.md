# Scénarios — A00 Taxonomie des événements (ingestion)

Persona opérateur : **Karim** (gère `/admin/analytics`, constate des dashboards vides).
Persona dev/QA : **Sara** (instrumente le front et lit les logs d'ingestion).

## Scénario A00-S1 — Le clic CTA réel est rejeté à l'ingestion (reproduction AN-03, GREEN now)
Contexte: en prod, les boutons d'achat (`CommanderAnchorButton`) émettent `pack_cta_click`, pas `cta_click`.
Étant donné que `eventSchemas` (schemas.ts) ne contient **aucun** schéma `pack_cta_click`
Et que la route `/api/track` appelle `getValidator(event.event)` qui renvoie `null` pour ce nom (L173)
Quand Sara poste un batch `{ events: [{ event: 'pack_cta_click', params: { cta_intent: 'purchase' } }] }`
Alors la réponse est `202` avec `{ accepted: 0, rejected: 1 }`
Et un `logger.warn('tracking.ingest.unknown_event', { event_name: 'pack_cta_click' })` est émis (route L176)
Et **aucune** ligne n'apparaît dans `tracking_events_log` (DB prod : count 0 sur 90j)
Et par conséquent l'onglet CTA de Karim reste vide (aucun `cta_click` à agréger).

## Scénario A00-S2 — La vue produit, elle, passe verbatim (contre-exemple sain)
Contexte: les sections `/kit` émettent `view_item`, qui EST au catalogue.
Étant donné que `eventSchemas.view_item = ecommerceParams` existe (schemas.ts L89)
Quand Sara poste `{ event: 'view_item', params: { currency: 'MAD', value: 320 } }`
Alors la réponse est `202` avec `{ accepted: 1, rejected: 0 }`
Et la ligne stockée a `event_name === 'view_item'` (verbatim, route L279, aucun mapping)
Et c'est pourquoi `view_item` compte **339** en base alors que `cta_click` compte **0**.

## Scénario A00-S3 — L'étape engage attend un nom qui n'existe nulle part (edge AN-02)
Contexte: `funnel.isEngageEvent` (funnel.ts L113) attend `scroll_depth_50`.
Étant donné que `eventSchemas` ne définit que `scroll_depth` (avec `percent_scrolled ∈ {25,50,75,90}`), pas `scroll_depth_50`
Quand Sara tente de poster `{ event: 'scroll_depth_50' }`
Alors il est **rejeté** (`unknown_event`) — DB confirme `scroll_depth_50 = 0` ET `scroll_depth = 0`
Et même si un `scroll_depth { percent_scrolled: 50 }` était stocké, le funnel ne le reconnaîtrait pas
(désalignement nom dérivé vs nom + paramètre) → aucune session ne franchit `engage`.

## Scénario A00-S4 — Gap de conversion sur checkout_intent (edge AN-04)
Contexte: le wizard émet une variante `checkout_intent` au lieu de `begin_checkout`.
Étant donné que `CONVERSION_EVENTS` (route L36-42) contient `begin_checkout` mais **pas** `checkout_intent`
Quand un `checkout_intent` serait ingéré (s'il avait un schéma)
Alors il serait stocké avec `is_conversion = false`, contrairement à `begin_checkout`
Donc la sémantique de conversion diverge selon le nom émis, sans intention métier.

## Scénario A00-S5 — Après le fix, le clic CTA est accepté (spécification, RED→GREEN)
Contexte: le fix AN-03 ajoute un schéma `cta_click` (component_id + cta_intent) et/ou normalise `pack_cta_click`.
Étant donné que `getEventSchema('cta_click') !== null`
Quand Sara poste `{ event: 'cta_click', params: { cta_intent: 'purchase' }, source: { component_id: 'c1' } }`
Alors la réponse est `{ accepted: 1, rejected: 0 }`
Et la ligne stockée a `event_name === 'cta_click'` et `component_id === 'c1'`
Et l'onglet CTA de Karim se remplit enfin (impressions/clics/attribution).
