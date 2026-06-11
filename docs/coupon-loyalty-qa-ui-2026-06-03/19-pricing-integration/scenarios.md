# F19 — Scénarios (Gherkin FR)

Personas : **Yasmine** (cliente, visiteuse `treatment`), **Nadia** (cliente, visiteuse `holdout` —
groupe contrôle), **Karim** (opérateur qui a publié le coupon welcome 90 MAD).
Couche `I` : on raisonne sur la **résolution** (`resolveProductPricing`) mais chaque « Alors » décrit
ce que la cliente **verrait** ou **subirait** dans l'UI (montant, blocage 422).

## Scénario F19-S1 — Yasmine voit et paie le même prix (happy, INV-PRICE)
Contexte: un coupon welcome `fixed_amount` 90 MAD est actif et éligible, holdout 0, kit à 199 MAD.
Étant donné que Yasmine est en bucket `treatment`
Quand le prix est résolu à l'affichage `/kit`, au snapshot du wizard, puis au recalcul de la commande
Alors les trois résolutions renvoient exactement 109 MAD (active, coupon `treatment`)
Et `expectedTotalCents` envoyé (10900) est accepté
Et aucune erreur 422 n'est levée — Yasmine est débitée de 109 MAD, le montant qu'elle a vu.

## Scénario F19-S2 — Nadia (holdout) voit le prix plein mais reste taguée (edge, INV-BUCKET)
Contexte: le même coupon est passé en holdout 100, Nadia a un `visitorKey` stable.
Étant donné que Nadia est en bucket `holdout`
Quand le prix est résolu
Alors le prix reste plein à 199 MAD (active=false)
Et la référence coupon est conservée avec `bucket='holdout'` (pour mesurer l'incrémentalité)
Et le bucket de Nadia est identique à l'affichage et au checkout — aucun mismatch de prix.

## Scénario F19-S3 — Coupon réservé Meta, visiteuse hors source (edge, éligibilité contexte)
Contexte: un coupon n'est éligible que pour `trafficSource='meta'`.
Étant donné qu'une visiteuse arrive sans source de trafic identifiable
Quand `selectCoupon` filtre les candidats dans le contexte checkout
Alors aucun coupon n'est retenu (on ne devine pas l'éligibilité)
Et le prix affiché et facturé est le prix plein 199 MAD.

## Scénario F19-S4 — Deux coupons éligibles, un seul s'applique (edge, INV-NONCUMUL)
Contexte: deux coupons prix sont éligibles, priorités 10 et 5.
Étant donné que la cliente est en `treatment`
Quand le moteur sélectionne
Alors seul le coupon de priorité 10 est appliqué (tie-break priority>age>id)
Et le récap n'affiche qu'une seule ligne « économie » (non-cumul).

## Scénario F19-S5 — UI périmée tente un mauvais total (edge, INV-422)
Contexte: l'onglet de la cliente affiche un ancien prix (199 MAD) alors qu'un coupon est désormais actif (109 MAD), et elle soumet `expectedTotalCents=19900`.
Étant donné que le serveur recalcule le prix via la source unique (109 MAD)
Quand il compare au `expectedTotalCents` reçu (199 MAD)
Alors il lève `PriceMismatchError`
Et la réponse est HTTP 422 `price_mismatch`
Et la cliente est bloquée plutôt que débitée d'un montant erroné.
