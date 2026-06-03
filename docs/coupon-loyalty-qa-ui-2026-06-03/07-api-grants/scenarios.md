# Scénarios F07 — `GET grants`

## Scénario F07-S1 — Karim consulte les codes émis, téléphone masqué (happy)
Contexte: Karim ouvre la section « Codes de fidélité émis ».
Étant donné un crédit émis pour le numéro `+212612345678`
Et une session admin avec `coupons:read`
Quand Karim envoie `GET /api/admin/coupons/grants`
Alors la réponse est `200`
Et `items[0].code` commence par `FG-`
Et `items[0].phone` est masqué (`+212…78`) et ne contient jamais `612345`
Et `total === items.length`.

## Scénario F07-S2 — Filtrer les codes déjà utilisés (edge status)
Contexte: Karim veut voir qui a consommé son code.
Étant donné 2 crédits `issued` et 1 crédit `redeemed`
Et une session admin
Quand Karim envoie `GET .../grants?status=redeemed`
Alors la réponse est `200`
Et chaque `items[i].status === "redeemed"`
Et la liste ne contient que le crédit consommé.

## Scénario F07-S3 — Croiser téléphone et statut (edge combiné)
Contexte: une cliente a deux commandes ; un code émis, un déjà consommé.
Étant donné un grant `issued` et un grant `redeemed` pour le même `+212600000001`
Quand Karim envoie `GET .../grants?phone=+212600000001&status=issued`
Alors la réponse ne contient que le grant `issued` (intersection AND).

## Scénario F07-S4 — Recherche sans résultat (edge vide)
Contexte: Karim tape un numéro inconnu dans le filtre.
Étant donné des grants existants pour d'autres numéros
Quand Karim envoie `GET .../grants?phone=+212699999999`
Alors la réponse est `200` avec `items: []` et `total: 0` (jamais d'erreur).

## Scénario F07-S5 — Compte sans droit de lecture (edge RBAC)
Contexte: un rôle inconnu tente de lister les grants (PII).
Étant donné une session dont le rôle n'a pas `coupons:read`
Quand `GET .../grants` est appelé
Alors la réponse est `403 forbidden` et aucun téléphone (même masqué) n'est exposé.
