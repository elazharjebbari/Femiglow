# Scénarios F06 — `GET [id]/stats`

## Scénario F06-S1 — Karim lit l'incrémentalité d'une promo (happy)
Contexte: Karim veut savoir si la promo `cpn_rescue` apporte des conversions au-delà du hasard.
Étant donné un coupon `cpn_rescue` actif
Et des événements semés : 120 expositions treatment / 80 holdout, 24 conversions treatment / 8 holdout
Et une session admin avec `coupons:read`
Quand Karim envoie `GET /api/admin/coupons/cpn_rescue/stats`
Alors la réponse est `200`
Et `stats.upliftAbsolute` est positif (taux treatment 0.20 > taux holdout 0.10)
Et `stats.noControl === false` et `stats.lowSample === false`.

## Scénario F06-S2 — Promo sans groupe contrôle (edge noControl)
Contexte: une promo a été lancée à 0 % de holdout (tout le monde traité).
Étant donné un coupon actif avec 150 expositions treatment et 0 holdout
Quand Karim demande les stats
Alors `stats.noControl === true`
Et `stats.upliftAbsolute === null` et `stats.conversionRate.holdout === null`
Et l'UI (F03) doit afficher « pas de groupe témoin » plutôt qu'un chiffre trompeur.

## Scénario F06-S3 — Échantillon trop faible (edge lowSample)
Contexte: la promo vient d'être activée, peu de trafic.
Étant donné un coupon actif avec 30 expositions treatment et 20 holdout (somme 50 < 100)
Quand Karim demande les stats
Alors `stats.lowSample === true`
Et l'UI doit signaler une lecture prématurée.

## Scénario F06-S4 — Permission de lecture refusée (edge RBAC)
Contexte: un compte au rôle inconnu tente d'accéder aux stats.
Étant donné un coupon actif
Et une session dont le rôle n'a pas `coupons:read`
Quand `GET .../stats` est appelé
Alors la réponse est `403` avec `error.code === "forbidden"`
Et aucun calcul d'agrégation n'est exposé.
