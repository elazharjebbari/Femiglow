# F08 — Scénarios (Gherkin FR)

Persona : **Yasmine** (cliente revenante qui a reçu un code de fidélité après une première commande).
La validation est une **prévisualisation** : le code n'est consommé qu'au paiement. MSW
(`redeemHandlers`) simule le backend.

## Scénario F08-S1 — Yasmine applique un code valide (happy)
Contexte: Yasmine a noté son code « FG-SAUGE-7212 » qui vaut 20 MAD ; le backend MSW le reconnaît.
Étant donné que le champ d'invitation est en état repos avec le bouton « Appliquer »
Quand Yasmine saisit « FG-SAUGE-7212 » et clique « Appliquer »
Alors un POST /api/coupons/redeem est émis avec ce code
Et le message « Crédit de 20 MAD appliqué — déduit au paiement. » s'affiche
Et le bouton est remplacé par une coche sauge
Et le parent reçoit onValid('FG-SAUGE-7212', 2000).

## Scénario F08-S2 — Code introuvable (edge refus)
Contexte: Yasmine se trompe et saisit « FG-NOPE » que le backend ne connaît pas.
Étant donné qu'elle a cliqué « Appliquer »
Quand la réponse renvoie { valid:false, reason:"not_found" }
Alors une alerte « Code introuvable ou expiré. » s'affiche (role=alert)
Et aucun crédit n'est remonté (onValid non appelé)
Et le bouton « Appliquer » reste disponible pour réessayer.

## Scénario F08-S3 — Code trop court (edge garde <3)
Contexte: Yasmine commence à taper « FG ».
Étant donné qu'elle a saisi seulement deux caractères
Quand elle tente de cliquer « Appliquer »
Alors le bouton est désactivé
Et aucune requête réseau n'est émise.

## Scénario F08-S4 — Anti-stale : elle corrige un code déjà validé (edge)
Contexte: Yasmine a validé un code (crédit remonté), puis se ravise.
Étant donné que le champ est en état « validé » avec la coche
Quand Yasmine modifie un caractère du code
Alors l'état repasse en repos
Et onClear est appelé (le crédit précédemment appliqué est invalidé)
Et le bouton « Appliquer » réapparaît (re-validation requise).

## Scénario F08-S5 — Coupure réseau (edge robustesse)
Contexte: la connexion de Yasmine est instable ; MSW renvoie une erreur réseau.
Étant donné qu'elle a cliqué « Appliquer » sur un code
Quand la requête échoue (network)
Alors l'alerte « Code introuvable ou expiré. » s'affiche sobrement
Et aucun crédit n'est remonté
Et elle peut réessayer.

## Scénario F08-S6 — Parcours en arabe (edge i18n RTL)
Contexte: Yasmine navigue en arabe.
Étant donné que le champ s'affiche avec l'étiquette « رمز الدعوة » et le bouton « تطبيق »
Quand elle valide un code reconnu
Alors le message de succès contient « درهم »
Et le rendu reste lisible en RTL.
