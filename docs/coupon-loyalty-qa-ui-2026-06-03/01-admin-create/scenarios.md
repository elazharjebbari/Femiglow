# F01 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur back-office FemiGlow (droit `write`). MSW = frontière de contrat.

## Scénario F01-S1 — Karim crée une promo d'accueil (happy)
Contexte: la liste des coupons est vide, le serveur MSW est stateful (create puis refresh reflètent le nouvel item).
Étant donné que Karim ouvre /admin/coupons et voit la section « Nouveau coupon d'accueil »
Et que le champ Libellé vaut « Geste d'accueil » et le champ Montant offert vaut 9000
Quand il clique sur « Créer (brouillon) »
Alors un POST /api/admin/coupons part avec status:'draft' et valueKind:'fixed_amount'
Et après le refresh GET, une nouvelle ligne apparaît avec le statut « Brouillon »
Et la valeur affichée est « 90 MAD ».

## Scénario F01-S2 — Permission refusée (edge 403)
Contexte: Karim a perdu le droit `write` (session viewer), MSW renvoie 403 sur create.
Étant donné que Karim remplit le formulaire
Quand il clique sur « Créer (brouillon) »
Alors aucune nouvelle ligne n'apparaît dans le tableau
Et un message d'alerte « Création refusée (HTTP 403). » s'affiche via role="alert"
Et le bouton « Créer (brouillon) » redevient cliquable.

## Scénario F01-S3 — Coupure réseau (edge network)
Contexte: le réseau tombe pendant l'envoi, le fetch est rejeté.
Étant donné que Karim a rempli le formulaire
Quand il clique sur « Créer (brouillon) »
Alors le message « Erreur réseau. » s'affiche via role="alert"
Et la liste reste inchangée
Et aucun refresh GET n'a été tenté.

## Scénario F01-S4 — Double-clic empêché pendant l'envoi (edge état transitoire)
Contexte: latence serveur de 50 ms simulée.
Étant donné que Karim clique sur « Créer (brouillon) »
Quand la requête est encore en vol
Alors le bouton porte l'attribut disabled (busy)
Et une fois la réponse reçue, le bouton redevient actif.
