# ADR-0006 — Idempotence & ordonnancement de bout en bout

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Réf exigences :** FR-04, NFR-03

## Contexte

Avec un envoi de fond + retry + beacon + reprise après reload, **la même mutation
peut être envoyée plusieurs fois** et **dans le désordre**. Sans garantie
d'idempotence et de convergence, on risque doublons, états incohérents, doubles
événements de tracking.

## Décision

Trois niveaux de garantie, complémentaires :

1. **Clé d'idempotence applicative** (existante) : `Idempotency-Key = (scope, leadId)`
   gérée en `sessionStorage` (`client/idempotency-key.ts`), persistée serveur dans
   `checkout_idempotency`. Rejeu même clé + même hash payload ⇒ **replay** de la
   réponse ; clé connue + hash différent ⇒ **409 conflict** (mutation déjà figée).
2. **Convergence par upsert** (ADR-0002) : l'état métier est **idempotent par
   construction** — appliquer `address_update` deux fois donne le même row. L'ordre
   n'altère pas l'état final tant que chaque champ est « last-writer-wins » par scope
   (les scopes écrivent des colonnes disjointes : capture / adresse / paiement).
3. **Ordonnancement FIFO par leadId** (ADR-0003) côté client : limite le désordre en
   conditions normales ; l'upsert + idem-key couvre les cas résiduels (beacon, reload).

Effets de bord (tracking serveur, webhook) : **dédupliqués par `event_id` / clé
d'outbox** (`UNIQUE(type, leadId, dedupe_key)`), de sorte qu'une double-insertion
d'event outbox soit absorbée (réutilise la stratégie `event_id` du tracking).

Anti-régression conversion : `order_create` reste protégé par `scope='order_create'`
(idempotent) → un double-clic ou un rejeu ne crée jamais deux commandes.

## Conséquences

- **+** Propriété « N rejeux ⇒ 1 effet » prouvable et testée (TST-I-01..04, TST-I-05..08).
- **+** Tolérance au désordre sans verrou distribué.
- **−** Discipline requise : chaque nouveau scope doit écrire des colonnes disjointes OU définir explicitement sa règle de merge ; documenté dans [`../../02-data-flow/data-model.md`](../../02-data-flow/data-model.md).
- **−** La règle « hash différent ⇒ 409 » impose au client de **purger** la clé après succès (déjà fait) pour autoriser une correction ultérieure légitime (back navigation + edit).

## Règles de merge par scope (résumé)

| Scope | Colonnes écrites | Règle |
|---|---|---|
| `lead_create` | phone, firstName, consent*, source, cart_snapshot, utm/gclid/fbp/fbc | create-or-fill (ne pas écraser par null) |
| `address_update` | city, address*, postal, country, notes, address_completed_at | last-writer-wins |
| `payment_select` | payment_method, payment_selected_at | last-writer-wins |
| `order_create` | order (table séparée) + mark_purchased_at | once (idempotent strict) |
