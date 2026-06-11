# Scénarios F05 — `POST [id]/status`

## Scénario F05-S1 — Karim active une promo (happy)
Contexte: Karim (opérateur, rôle admin avec droit `publish`) vient de créer un coupon d'accueil en `draft`.
Étant donné un coupon `cpn_welcome` au statut `draft` en mémoire
Et une session admin dont le rôle possède `coupons:publish`
Quand Karim envoie `POST /api/admin/coupons/cpn_welcome/status` avec `{ "status": "active" }`
Alors la réponse est `200`
Et `coupon.status` vaut `active`
Et `revalidateTag` est appelé pour `coupons` et `products` (effet immédiat sur `/kit`)
Et un événement d'audit `coupons.status` est journalisé avec `{ from: "draft", to: "active" }`.

## Scénario F05-S2 — Nadia (viewer) tente d'activer (edge RBAC)
Contexte: Nadia consulte les promos mais n'a que le droit `read`.
Étant donné un coupon `cpn_welcome` en `draft`
Et une session dont le rôle n'a PAS `coupons:publish`
Quand Nadia envoie `POST .../status` avec `{ "status": "active" }`
Alors la réponse est `403` avec `error.code === "forbidden"`
Et aucune mutation ni `revalidateTag` n'a lieu.

## Scénario F05-S3 — Karim tente de réactiver une promo archivée (edge verrou)
Contexte: une ancienne promo a été archivée définitivement.
Étant donné un coupon `cpn_old` au statut `archived`
Et une session admin avec `publish`
Quand Karim envoie `POST .../status` avec `{ "status": "active" }`
Alors la réponse est `409` avec `error.code === "conflict"`
Et le coupon reste `archived`
Mais s'il renvoyait `{ "status": "archived" }`, la réponse serait `200` (idempotent).

## Scénario F05-S4 — Statut farfelu (edge validation)
Contexte: un client HTTP mal codé envoie une valeur libre.
Étant donné un coupon `cpn_welcome` en `draft` et une session admin avec `publish`
Quand le corps est `{ "status": "on" }`
Alors la réponse est `422` avec `error.code === "validation_failed"` et un `details` non vide
Et si le corps n'est pas du JSON valide, la réponse est `400 invalid_input`.
