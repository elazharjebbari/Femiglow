# F02 — Scénarios métier réalistes

## BM-F02-1 — Salma va vite : tape l'adresse pendant que le lead se crée encore
**Contexte :** `/api/checkout/lead` bridé 6 s (création en file). Salma remplit le
lead, passe **immédiatement** à l'adresse, remplit et clique « Commander » avant
que la création de fond ait abouti.
**Attendu :** la conversion **attend le flush** (le lead est persisté), puis crée
la commande → thank-you. **Aucune** erreur « lead introuvable ».
**Bug recherché :** échec de conversion car le lead n'existait pas encore.

## BM-F02-2 — Double-tap impatient sur « Commander »
**Attendu :** **une** seule commande, **un** seul thank-you, **un** seul webhook.
**Bug recherché :** double commande / double webhook (dedupe orderId).

## BM-F02-3 — Rupture de stock au dernier moment
**Contexte :** `/order` renvoie 409 stock.
**Attendu :** Salma reste sur l'adresse, voit un message clair, peut réessayer.
**Bug recherché :** passage à thank-you malgré l'échec, ou message absent.

## BM-F02-4 — Coupure réseau pile à la conversion, puis reprise
**Parcours :** clic « Commander » → réseau coupé (erreur) → message → le réseau
revient → reclique.
**Attendu :** message d'erreur d'abord, puis **une** commande au retry (pas deux).
**Bug recherché :** double commande au retry, ou blocage définitif.

## BM-F02-5 — Conversion + supervision opérateur (transverse F10/F11)
**Attendu :** après la commande, l'opérateur voit le lead `purchased` en admin et
le webhook `order_webhook` traité (`done`) par le worker en < 90 s.
**Bug recherché :** webhook `dead` invisible (cf. F11 gap), lead resté `captured`.
