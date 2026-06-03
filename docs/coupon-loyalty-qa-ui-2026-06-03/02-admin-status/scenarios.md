# F02 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur (droit `publish`). État coupon stateful côté MSW.

## Scénario F02-S1 — Karim met une promo en ligne puis la met en pause (happy)
Contexte: un coupon « Geste d'accueil » est en brouillon.
Étant donné que Karim voit la ligne avec le statut « Brouillon » et un bouton « Activer »
Quand il clique sur « Activer »
Alors un POST /api/admin/coupons/cpn_1/status part avec { status: 'active' }
Et après le refresh, le statut affiche « Actif »
Et le bouton « Pauser » apparaît tandis que « Activer » disparaît
Quand il clique ensuite sur « Pauser »
Alors le statut affiche « En pause » et « Activer » réapparaît.

## Scénario F02-S2 — Archivage terminal (edge lock)
Contexte: un coupon « Actif » que Karim veut retirer définitivement.
Étant donné qu'il voit le bouton « Archiver » sur la ligne
Quand il clique sur « Archiver »
Alors le statut affiche « Archivé »
Et il ne reste sur la ligne que le bouton « Stats »
Et aucun bouton « Activer »/« Pauser »/« Archiver » n'est plus proposé.

## Scénario F02-S3 — Permission de publication refusée (edge 403)
Contexte: Karim n'a pas le droit `publish`, MSW renvoie 403 sur transition.
Étant donné qu'il voit un coupon en « Brouillon »
Quand il clique sur « Activer »
Alors le statut reste « Brouillon »
Et un message « Transition refusée (HTTP 403). » s'affiche via role="alert".

## Scénario F02-S4 — Coupure réseau pendant l'activation (edge network)
Contexte: le réseau tombe pendant la transition.
Étant donné qu'il clique sur « Activer »
Quand le fetch est rejeté
Alors le message « Erreur réseau. » s'affiche via role="alert"
Et le statut reste inchangé
Et les boutons redeviennent cliquables.
