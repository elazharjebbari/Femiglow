# Scénarios F14 — `POST /api/coupons/redeem`

## Scénario F14-S1 — Yasmine prévisualise son crédit valide (happy)
Contexte: Yasmine a reçu un code `FG-ATLAS-2048` (20 MAD), activé et non expiré.
Étant donné un grant `issued` actif pour ce code, `valueCents = 2000`
Quand elle envoie `POST /api/coupons/redeem` avec `{ "code": "FG-ATLAS-2048" }`
Alors la réponse est `200`
Et `body.valid === true` et `body.valueCents === 2000`
Et le grant N'EST PAS consommé (validation non mutante).

## Scénario F14-S2 — Code reçu mais pas encore livré (edge not_yet_active)
Contexte: Yasmine vient de commander, le code n'est utilisable qu'après livraison.
Étant donné un grant dont `activatesAt` est dans 10 jours
Quand elle tente `POST /api/coupons/redeem` avec son code
Alors la réponse est `200` avec `body.valid === false` et `body.reason === "not_yet_active"`.

## Scénario F14-S3 — Code périmé (edge expired)
Contexte: le code dort depuis plus de 60 jours après activation.
Étant donné un grant dont `expiresAt` est dépassé
Quand le code est soumis
Alors `body.reason === "expired"` en `200`.

## Scénario F14-S4 — Code déjà utilisé (edge already_redeemed)
Contexte: Yasmine a déjà payé avec ce code lors d'une commande précédente.
Étant donné un grant au statut `redeemed`
Quand le code est resoumis
Alors `body.reason === "already_redeemed"` en `200`.

## Scénario F14-S5 — Saisie trop courte (edge invalid_input)
Contexte: Yasmine tape « AB » par erreur.
Étant donné un corps `{ "code": "AB" }` (2 chars)
Quand la requête est envoyée
Alors la réponse est `422` avec `body.reason === "invalid_input"`
Et un corps non-JSON produit le même `422 invalid_input`.

## Scénario F14-S6 — Panne interne invisible pour la cliente (edge error)
Contexte: une exception survient pendant `validateGrant`.
Étant donné `validateGrant` qui lève une exception
Quand un code bien formé est soumis
Alors la réponse reste `200` avec `body.valid === false` et `body.reason === "error"`
Et aucune `500` n'est exposée à la cliente (best-effort public).
