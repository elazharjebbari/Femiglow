# F13 — Scénarios (Gherkin FR)

État pur (pas d'UI). Persona implicite : **Yasmine** dont les choix doivent survivre à un refresh sans
jamais réappliquer un crédit obsolète. On agit sur le store et on observe l'état + le storage
`femiglow.wizard.v1`.

## Scénario F13-S1 — Le code de fidélité émis est mémorisé (happy)
Contexte: le backend a émis un code pour la commande de Yasmine.
Étant donné un store frais
Quand on appelle setLoyalty({ code:'FG-SAUGE-7212', valueCents:2000, activatesAt:'2026-06-10' })
Alors getState().loyalty.code vaut « FG-SAUGE-7212 »
Et l'objet est persisté sous femiglow.wizard.v1.

## Scénario F13-S2 — Le crédit n'est jamais persisté (edge / INV-422)
Contexte: Yasmine applique un code valant 20 MAD.
Étant donné setCoupon('FG-SAUGE-7212', 2000)
Quand on lit le JSON persisté
Alors state.couponCode vaut « FG-SAUGE-7212 »
Et state.creditCents est absent (undefined)
Et donc, après refresh, le crédit devra être re-validé via /api/coupons/redeem.

## Scénario F13-S3 — Crédit arrondi à l'entier (edge / normalisation)
Contexte: une valeur fractionnaire arrive.
Étant donné setCoupon('FG-X', 1999.6)
Quand on lit l'état
Alors creditCents vaut 2000 (Math.round).

## Scénario F13-S4 — clearCoupon vide le code persisté (edge)
Contexte: Yasmine retire son code.
Étant donné un store où setCoupon a été appelé
Quand on appelle clearCoupon()
Alors getState().couponCode vaut null et creditCents vaut 0
Et state.couponCode persisté vaut null.

## Scénario F13-S5 — Whitelist de persistance respectée (edge / contrat)
Contexte: on veut éviter tout leak de champ volatile.
Étant donné une action quelconque sur le store
Quand on inspecte les clés du state persisté
Alors couponCode, loyalty et addressDraft sont présents
Et creditCents et hydrated sont absents.
