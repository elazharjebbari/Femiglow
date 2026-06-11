# F11 — Scénarios métier réalistes (supervision)

## BM-F11-1 — Le CRM tombe : des webhooks échouent
**Contexte :** l'endpoint webhook externe renvoie 500 pendant 1 h.
**Attendu :** les effets `order_webhook` passent en retry (backoff) puis `dead`
après max ; l'opérateur **détecte** les `dead` (vue admin ou requête) et les
**rejoue** une fois le CRM rétabli → `done`. **Aucune commande perdue côté CRM.**
**Bug recherché (RSK-15) :** les `dead` restent invisibles → commandes jamais
remontées, sans alerte.

## BM-F11-2 — Backlog qui gonfle (worker à l'arrêt)
**Contexte :** le timer cron est arrêté.
**Attendu :** `pending` monte ; une **alerte** (seuil) prévient ; au redémarrage du
worker, le backlog se draine.
**Bug recherché :** backlog silencieux, effets en retard sans visibilité.

## BM-F11-3 — Deux workers concurrents (scaling)
**Attendu :** `FOR UPDATE SKIP LOCKED` garantit qu'un effet n'est traité **qu'une
fois** (pas de double webhook).
**Bug recherché :** double livraison (RSK-16/RSK-21).

## BM-F11-4 — Rejeu manuel d'un effet dead
**Parcours opérateur :** repérer un `dead`, vérifier `last_error`, **rejouer**.
**Attendu :** l'effet repart `pending` → `done` ; idempotent (le CRM dédupe par
`dedupeKey=orderId`).
