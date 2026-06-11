# F10 — Scénarios (Gherkin FR)

Persona : **Yasmine** (cliente qui voit le récap panier pendant tout le tunnel). Composant pur : les
montants et libellés arrivent en props (pas de réseau).

## Scénario F10-S1 — Crédit fidélité appliqué : total à 0, ligne crédit visible (happy / frontière)
Contexte: panier 199 MAD, Yasmine a un crédit de 199 MAD exactement.
Étant donné que le récap reçoit appliedCreditCents = 19900
Quand il s'affiche
Alors le total affiche « 0 MAD »
Et une ligne « Crédit fidélité −199 MAD » apparaît
Et le total ne descend jamais sous zéro.

## Scénario F10-S2 — Coexistence accueil + fidélité (edge / INV-NONCUMUL)
Contexte: geste d'accueil actif (économie 90 MAD) ET crédit fidélité de 20 MAD.
Étant donné que welcomeCoupon.active = true, compareAt = 289 MAD, appliedCreditCents = 2000
Quand le récap s'affiche
Alors la ligne « Économie 90 MAD » (terracotta) est présente
Et la ligne « Crédit fidélité −20 MAD » est présente, sur une ligne distincte
Et les deux remises ne sont jamais fusionnées en un seul montant.

## Scénario F10-S3 — Crédit négatif : ignoré (edge / clamp)
Contexte: un appliedCreditCents négatif arrive par erreur.
Étant donné appliedCreditCents = -500
Quand le récap s'affiche
Alors le total reste « 199 MAD »
Et aucune ligne crédit n'apparaît.

## Scénario F10-S4 — Affichage en arabe : devise localisée (edge / i18n)
Contexte: Yasmine navigue en arabe, currencyLabel = « درهم ».
Étant donné un crédit de 20 MAD et un prix barré « 289 MAD »
Quand le récap s'affiche
Alors le total, la ligne crédit et le prix barré contiennent « درهم »
Et n'affichent plus « MAD ».

## Scénario F10-S5 — Panier vide (edge / garde)
Contexte: le panier n'a aucun article.
Étant donné cart.items = []
Quand le récap est rendu
Alors il ne rend rien (null).
