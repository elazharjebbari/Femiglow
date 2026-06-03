# F20 — Scénarios (Gherkin FR)

Personas : **Yasmine** (cliente qui commande puis revient utiliser son code), **Latifa** (cliente
habitant une ville à livraison « 48 à 72 h »), **Karim** (opérateur qui a configuré le template
`post_purchase`). Couche `I` : on raisonne sur `computeActivatesAt` / `issueGrant` / `validateGrant`,
mais chaque « Alors » correspond à ce que la cliente **lit** ou **subit** (date d'activation affichée,
message « pas encore actif » / « expiré », même code rendu).

## Scénario F20-S1 — Latifa reçoit un code activable +4 jours (happy, INV-ACTIVATION)
Contexte: Latifa commande le JJ ; sa ville a `delivery_eta = « 48 à 72 h »` ; template `post_purchase` 20 MAD.
Étant donné que la commande est créée avec succès
Quand le serveur calcule `computeActivatesAt(orderDate, '48 à 72 h')`
Alors `maxDeliveryDays` vaut 3 et l'activation est fixée à orderDate + 4 jours (3 livraison + 1 buffer)
Et un grant `issued` est émis avec un code mémorable « FG-ATLAS-0042 »
Et `expiresAt` vaut activation + 60 jours
Et la fin de commande affiche « code utilisable à partir du JJ+4 ».

## Scénario F20-S2 — Yasmine saisit son code trop tôt (edge, not_yet_active)
Contexte: le code de Yasmine s'active dans 4 jours.
Étant donné qu'elle saisit le code aujourd'hui (now < activatesAt)
Quand `validateGrant` est appelé
Alors le résultat est invalide avec `reason='not_yet_active'`
Et la date d'activation est renvoyée pour l'affichage
Et à l'instant exact de l'activation (now === activatesAt) le code devient valide (borne incluse).

## Scénario F20-S3 — Yasmine revient après 60 jours (edge, expired, INV-VALIDITY)
Contexte: le code de Yasmine était actif mais elle l'a oublié.
Étant donné que `now > activatesAt + 60 jours`
Quand elle saisit son code
Alors le résultat est invalide avec `reason='expired'`
Et à l'instant exact de l'expiration (now === expiresAt) le code est encore valide (borne incluse).

## Scénario F20-S4 — Latifa repasse commande, un seul code actif (edge, INV-IDEMP-PHONE)
Contexte: Latifa a déjà un grant `issued` pour son téléphone, et passe une seconde commande.
Étant donné une seconde émission depuis un `sourceOrderId` différent mais le même `phoneE164`
Quand `issueGrant` s'exécute
Alors il renvoie le grant existant (même code) au lieu d'en créer un nouveau
Et `listGrants({phoneE164})` ne contient qu'un seul code (anti-farming).

## Scénario F20-S5 — Re-jeu de la même commande (edge, INV-IDEMP-ORDER)
Contexte: la route order est rejouée (idempotency) pour le même `sourceOrderId`.
Étant donné une seconde `issueGrant` avec le même `sourceOrderId`
Quand elle s'exécute
Alors le même grant est renvoyé (même `id`, même `code`)
Et aucun doublon n'est créé.
