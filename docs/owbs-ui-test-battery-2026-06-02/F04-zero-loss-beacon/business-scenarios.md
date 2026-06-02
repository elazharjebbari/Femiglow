# F04 — Scénarios métier réalistes (zéro-perte)

## BM-F04-1 — Salma ferme l'onglet juste après avoir validé (distraction)
**Parcours :** remplit le lead, voit l'étape adresse, puis **ferme l'onglet** (ou
bascule sur une autre app) avant que la création de fond aboutisse.
**Attendu :** le lead est **quand même** capturé (beacon → `/sync`). L'opérateur le
voit en admin.
**Bug recherché :** lead perdu silencieusement (le pire — capture ratée).

## BM-F04-2 — iPhone met l'app en arrière-plan (bfcache)
**Contexte :** iOS Safari, `pagehide` + bfcache.
**Attendu :** beacon émis (R-07).
**Bug recherché :** sur iOS, `visibilitychange` seul ne suffit pas → perte. (Couvert par webkit S03.)

## BM-F04-3 — Réseau coupé puis Salma recharge la page
**Parcours :** réseau coupé pendant la création (envelope en file/miroir) → Salma
recharge.
**Attendu :** au rechargement, l'envelope est rejouée → **un** lead (pas deux).
**Bug recherché :** doublon de lead, ou perte après reload.

## BM-F04-4 — Opérateur vérifie « aucun lead perdu » sur une journée
**Attendu (transverse F10/F14) :** le nombre de leads capturés correspond aux
soumissions ; aucune envelope « droppée » sans trace (FR-11) ; les `dead` outbox
sont visibles (F11).
