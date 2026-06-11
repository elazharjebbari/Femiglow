# F04 — Scénarios (Gherkin FR)

Personas : **Karim** (opérateur, droit `read`), **Yasmine** (cliente dont le code a été émis).
Le serveur masque le téléphone en sérialisation — l'UI ne démasque jamais.

## Scénario F04-S1 — Karim consulte les codes émis (happy)
Contexte: la section « Codes de fidélité émis » est repliée (grants non chargés), un grant existe pour Yasmine.
Étant donné que Karim voit le bouton « Charger » et aucun tableau de grants
Quand il clique sur « Charger »
Alors un GET /api/admin/coupons/grants est émis
Et le tableau apparaît avec une ligne pour le code « FG-SAUGE-7212 »
Et le téléphone de Yasmine s'affiche masqué « 0612…78 »
Et la valeur affiche « 20 MAD »
Et le bouton devient « Rafraîchir ».

## Scénario F04-S2 — Le téléphone n'est jamais en clair (edge PII / INV-PII)
Contexte: plusieurs grants chargés.
Étant donné que Karim a chargé la liste
Quand il parcourt chaque ligne
Alors aucune cellule téléphone ne contient six chiffres consécutifs ou plus
Et chaque téléphone contient un masque (« … » ou « * »).

## Scénario F04-S3 — Code émis non encore activé (edge dates null)
Contexte: un grant « issued » dont l'activation n'a pas de date connue.
Étant donné que Karim a chargé la liste
Quand il regarde les colonnes Activation et Expiration de cette ligne
Alors elles affichent « — »
Et le statut affiché est « issued ».

## Scénario F04-S4 — Aucun code émis (edge liste vide)
Contexte: aucun grant en base.
Étant donné que Karim clique sur « Charger »
Alors le tableau s'affiche avec la ligne « Aucun code émis. »
Et aucune ligne de données n'est présente.

## Scénario F04-S5 — Permission refusée (edge 403)
Contexte: Karim n'a pas le droit `read` sur les grants, MSW renvoie 403.
Étant donné qu'il clique sur « Charger »
Quand la réponse est en erreur
Alors aucun tableau de grants n'apparaît
Et le bouton reste « Charger »
Et aucune alerte n'est affichée.
